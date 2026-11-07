import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.includes('/src/') && !context.parentURL.includes('/node_modules/') &&
    specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier) ? `${specifier}.ts` : specifier, context);
}});
const { CONFIG } = await import('../src/config.ts');
const { SUI_MAINNET_CHAIN_IDENTIFIER, readAutomaticHolderSnapshot } = await import('../src/snapshotClient.ts');
const { createHolderSnapshotFromNFTrees, fetchHolderSnapshot, holderSnapshotPayoutBlockers, parseHolderSnapshotImport } = await import('../src/holderSnapshot.ts');

const id = number => `0x${number.toString(16).padStart(64, '0')}`;
const wallet = id(101);
const kiosk = id(201);
const capId = id(301);
const capType = '0x2::kiosk::KioskOwnerCap';
const personalType = '0x0cb4bcc0560340eb1a1b929cabe56b33fc6449820ec8c1980d69bb98b649b802::personal_kiosk::PersonalKioskCap';
const checkpoint = 1234;

function object(objectId, type, owner, kind = 'AddressOwner', json) {
  return {
    address: objectId, version: 4, digest: `digest-${objectId}`,
    owner: { __typename: kind, ...(owner ? { address: { address: owner } } : {}) },
    asMoveObject: { contents: { type: { repr: type }, json } },
  };
}

function fixture(t, options = {}) {
  const calls = [];
  const nfts = options.nfts || [
    object(id(1), CONFIG.nftreeType, CONFIG.adminAddress),
    object(id(2), CONFIG.nftreeType, wallet),
    object(id(3), CONFIG.nftreeType, kiosk, 'ObjectOwner'),
  ];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const { query, variables } = JSON.parse(init.body);
    calls.push({ query, variables });
    if (query.includes('NFTreeSnapshotScope')) return Response.json({ data: {
      chainIdentifier: options.chainIdentifier || SUI_MAINNET_CHAIN_IDENTIFIER,
      serviceConfig: { maxPageSize: 50, availableRange: {
        first: { sequenceNumber: 1200 },
        last: { sequenceNumber: checkpoint, timestamp: '2026-11-07T18:00:00.000Z', digest: 'checkpoint-digest' },
      } },
    } });
    if (options.graphqlError) return Response.json({ data: { checkpoint: {} }, errors: [{ message: 'Indexer unavailable' }] });
    assert.equal(variables.cp, checkpoint, 'Every inventory, custody and capability query uses the same checkpoint');
    if (query.includes('NFTreeKioskCreationCaps')) return Response.json({ data: { checkpoint: {
      sequenceNumber: checkpoint, query: { object: { previousTransaction: { effects: {
        checkpoint: { sequenceNumber: 1201 },
        objectChanges: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [
          { address: capId, idCreated: true, outputState: object(capId, capType, CONFIG.adminAddress, 'AddressOwner', { for: kiosk }) },
        ] },
      } } } },
    } } });
    if (query.includes('NFTreePinnedObjects')) {
      let nodes;
      if (variables.filter.type === CONFIG.nftreeType) nodes = variables.after ? nfts.slice(2) : nfts.slice(0, 2);
      else if (variables.filter.type === capType && !options.noCap && !options.personalCap) nodes = [object(capId, capType, wallet, 'AddressOwner', { for: kiosk })];
      else if (variables.filter.type === personalType && options.personalCap) nodes = [object(capId, personalType, wallet, 'AddressOwner', { cap: { vec: [{ for: kiosk }] } })];
      else nodes = [];
      const next = variables.filter.type === CONFIG.nftreeType && !variables.after && nfts.length > 2;
      return Response.json({ data: { checkpoint: {
        sequenceNumber: options.wrongCheckpoint ? checkpoint + 1 : checkpoint,
        query: { objects: {
          pageInfo: { hasNextPage: next, endCursor: next && !options.missingCursor ? 'page-2' : null },
          nodes,
        } },
      } } });
    }
    assert.ok(query.includes('NFTreePinnedOwner'));
    const ownerObject = options.objects?.[variables.id] ?? (variables.id === kiosk
      ? object(kiosk, '0x2::kiosk::Kiosk', undefined, 'Shared', { owner: wallet }) : null);
    return Response.json({ data: { checkpoint: { sequenceNumber: checkpoint, query: { object: ownerObject } } } });
  });
  return calls;
}

test('automatic snapshots use one checkpoint, verify kiosk cap, exclude treasury and produce stable evidence', async t => {
  const calls = fixture(t);
  const snapshot = await fetchHolderSnapshot({ excludedWallets: [] });
  assert.equal(snapshot.complete, true);
  assert.equal(snapshot.checkpoint, String(checkpoint));
  assert.equal(snapshot.checkpointDigest, 'checkpoint-digest');
  assert.equal(snapshot.totalNFTrees, 3);
  assert.equal(snapshot.excludedProjectWalletNFTrees, 1);
  assert.equal(snapshot.eligibleNFTrees, 2);
  assert.equal(snapshot.eligibleHolderWallets, 1);
  assert.equal(snapshot.unresolvedNFTrees, 0);
  assert.match(snapshot.manifestHash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(holderSnapshotPayoutBlockers(snapshot), []);
  assert.ok(calls.some(call => call.variables.filter?.type === capType));
  const again = await fetchHolderSnapshot({ excludedWallets: [] });
  assert.equal(again.manifestHash, snapshot.manifestHash);
  assert.equal(again.snapshotId, snapshot.snapshotId);
});

test('personal kiosk wrappers require an exact matching capability owned by the recipient wallet', async t => {
  fixture(t, { personalCap: true });
  const snapshot = await fetchHolderSnapshot({ excludedWallets: [] });
  assert.equal(snapshot.resolvedNFTrees, 1);
  assert.equal(snapshot.unresolvedNFTrees, 0);
  assert.equal(snapshot.nftrees.find(nft => nft.nftreeObjectId === id(3)).ownerAddress, wallet);
});

test('stale kiosk owner hints use current creation-capability ownership, never the historical recipient', async t => {
  const currentKiosk = object(kiosk, '0x2::kiosk::Kiosk', undefined, 'Shared', { owner: CONFIG.adminAddress });
  currentKiosk.owner.initialSharedVersion = 4;
  fixture(t, { noCap: true, objects: {
    [kiosk]: currentKiosk,
    [capId]: object(capId, capType, wallet, 'AddressOwner', { for: kiosk }),
  } });
  const snapshot = await fetchHolderSnapshot({ excludedWallets: [] });
  assert.equal(snapshot.unresolvedNFTrees, 0);
  assert.equal(snapshot.nftrees.find(nft => nft.nftreeObjectId === id(3)).ownerAddress, wallet);
  assert.match(snapshot.nftrees.find(nft => nft.nftreeObjectId === id(3)).resolutionPath.join(' '), /creation capability/);
});

test('verified treasury TradePort listings are excluded using exact NFT and store ancestry', async t => {
  const listing = id(401);
  const wrapper = id(402);
  const store = '0xf96f9363ac5a64c058bf7140723226804d74c0dab2dd27516fb441a180cd763b';
  const pkg = '0xff2251ea99230ed1cbe3a347a209352711c6723fcdcd9286e16636e65bb55cab';
  const options = { nfts: [object(id(1), CONFIG.nftreeType, listing, 'ObjectOwner')], objects: {
    [listing]: object(listing, `${pkg}::tradeport_listings::SimpleListing<${CONFIG.nftreeType}>`, wrapper, 'ObjectOwner', { nft_id: id(1), seller: CONFIG.adminAddress }),
    [wrapper]: object(wrapper, '0x2::dynamic_field::Field<0x2::dynamic_object_field::Wrapper<0x2::object::ID>,0x2::object::ID>', store, 'ObjectOwner', { name: { name: id(1) }, value: listing }),
    [store]: object(store, `${pkg}::tradeport_listings::Store`, undefined, 'Shared'),
  } };
  fixture(t, options);
  const snapshot = await fetchHolderSnapshot({ excludedWallets: [] });
  assert.equal(snapshot.totalNFTrees, 1);
  assert.equal(snapshot.excludedProjectWalletNFTrees, 1);
  assert.equal(snapshot.unresolvedNFTrees, 0);
  assert.equal(snapshot.eligibleNFTrees, 0);
  options.objects[listing].asMoveObject.contents.json.nft_id = id(999);
  const unverified = await fetchHolderSnapshot({ excludedWallets: [] });
  assert.equal(unverified.unresolvedNFTrees, 1);
  assert.equal(unverified.excludedProjectWalletNFTrees, 0);
});

test('unverified kiosk owner hint remains unresolved and blocks all direct payments', async t => {
  fixture(t, { noCap: true });
  const snapshot = await fetchHolderSnapshot({ excludedWallets: [] });
  assert.equal(snapshot.totalNFTrees, 3);
  assert.equal(snapshot.eligibleNFTrees, 1);
  assert.equal(snapshot.unresolvedNFTrees, 1);
  assert.match(snapshot.unresolved[0].reason, /no matching wallet-owned KioskOwnerCap/);
  assert.ok(holderSnapshotPayoutBlockers(snapshot).some(reason => /Every NFTree owner/.test(reason)));
});

test('unknown shared custody and missing custody objects never become wallet recipients', async t => {
  fixture(t, { nfts: [
    object(id(1), CONFIG.nftreeType, id(901), 'ObjectOwner'),
    object(id(2), CONFIG.nftreeType, undefined, 'Shared'),
  ] });
  const snapshot = await fetchHolderSnapshot({ excludedWallets: [] });
  assert.equal(snapshot.totalNFTrees, 2);
  assert.equal(snapshot.unresolvedNFTrees, 2);
  assert.equal(snapshot.holders.length, 0);
});

test('an object address with a verified owner chain pays its controlling wallet, not the object ID', async t => {
  fixture(t, { nfts: [object(id(1), CONFIG.nftreeType, id(901), 'AddressOwner')],
    objects: { [id(901)]: object(id(901), '0x99::container::OwnedContainer', wallet) } });
  const snapshot = await fetchHolderSnapshot({ excludedWallets: [] });
  assert.deepEqual(snapshot.holders.map(holder => holder.ownerAddress), [wallet]);
  assert.equal(snapshot.resolvedNFTrees, 1);
});

test('ownership cycles stay unresolved', async t => {
  fixture(t, { nfts: [object(id(1), CONFIG.nftreeType, id(901), 'ObjectOwner')], objects: {
    [id(901)]: object(id(901), '0x99::container::OwnedContainer', id(902), 'ObjectOwner'),
    [id(902)]: object(id(902), '0x99::container::OwnedContainer', id(901), 'ObjectOwner'),
  } });
  const snapshot = await fetchHolderSnapshot({ excludedWallets: [] });
  assert.equal(snapshot.unresolvedNFTrees, 1);
  assert.match(snapshot.unresolved[0].reason, /cycle/);
});

test('partial GraphQL responses, wrong network and changed checkpoint fail closed', async t => {
  for (const [options, message] of [
    [{ graphqlError: true }, /Indexer unavailable/],
    [{ chainIdentifier: 'another-network' }, /not the Sui mainnet/],
    [{ wrongCheckpoint: true }, /checkpoint changed/],
  ]) {
    await t.test(JSON.stringify(options), async st => {
      fixture(st, options);
      await assert.rejects(readAutomaticHolderSnapshot({ nftreeType: CONFIG.nftreeType }), message);
    });
  }
});

test('missing page cursors, duplicate NFT IDs and unexpected object types cannot produce a payout snapshot', async t => {
  for (const [options, message] of [
    [{ missingCursor: true }, /no valid cursor/],
    [{ nfts: [object(id(1), CONFIG.nftreeType, wallet), object(id(1), CONFIG.nftreeType, wallet)] }, /repeated object/],
    [{ nfts: [object(id(1), '0x99::fake::NFT', wallet)] }, /unexpected collection object/],
  ]) await t.test(message.source, async st => {
    fixture(st, options);
    await assert.rejects(readAutomaticHolderSnapshot({ nftreeType: CONFIG.nftreeType }), message);
  });
});

test('manual and invalid-owner imports are never advertised as verified automatic payout snapshots', () => {
  const imported = parseHolderSnapshotImport(JSON.stringify({ nftrees: [
    { nftreeObjectId: id(1), ownerAddress: wallet },
    { nftreeObjectId: id(2) },
  ] }), []);
  assert.equal(imported.totalNFTrees, 2);
  assert.equal(imported.unresolvedNFTrees, 1);
  assert.equal(imported.complete, false);
  assert.ok(holderSnapshotPayoutBlockers(imported).length > 0);
  const conflicting = createHolderSnapshotFromNFTrees({
    source: 'indexer-graphql', complete: true, excludedWallets: [],
    nftrees: [{ nftreeObjectId: id(1), ownerAddress: wallet, label: 'tree' }],
    unresolved: [{ nftreeObjectId: id(1), reason: 'Conflicting custody evidence' }],
  });
  assert.equal(conflicting.eligibleNFTrees, 0);
  assert.equal(conflicting.unresolvedNFTrees, 1);
  assert.equal(conflicting.totalNFTrees, 1);
});
