from pathlib import Path
import re

provider_path = Path('netlify/lib/turbos-tree-lp-provider.ts')
text = provider_path.read_text(encoding='utf-8')

old_methodology = "export const TURBOS_METHODOLOGY_VERSION = 'turbos-tree-principal-v1';"
new_constants = """export const TURBOS_METHODOLOGY_VERSION = 'turbos-tree-principal-pool-index-v2';
export const TURBOS_POOL_POSITION_VALUE_TYPE = `${TURBOS_PACKAGE}::pool::Position`;
export const TURBOS_TREE_POOL_IDS = [
  '0x4a8c450d393fee360fc8c2a2ed30bf6f9e4de5077024e9628cd3510e272bf490',
  '0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee',
  '0xc327fdc9b129602e91df9bd59cf3e4a921ce5509844a3b6c8adddc5ed320636d',
  '0xd5d7d9a614327feed096a437f416aa98f440393d9ac52d97c87e6e0dd6e719bb',
  '0xe1468ece8e4d2940b30dec776eaee9b235b23458868027da871bc42817263a12',
] as const;"""
if old_methodology not in text:
    raise SystemExit('Expected Turbos methodology constant was not found.')
text = text.replace(old_methodology, new_constants, 1)

# Remove the obsolete global GraphQL NFT query. The optimized provider follows the
# verified dynamic-field position index of each recognized TREE pool instead.
text, query_replacements = re.subn(
    r"\nconst NFT_SCAN_QUERY = `query ScanTurbosPositionNfts[\s\S]*?`;\n",
    "\n",
    text,
    count=1,
)
if query_replacements != 1:
    raise SystemExit('Expected Turbos global NFT query was not found.')

normalized_anchor = "const NORMALIZED_POSITION_TYPE = canonicalizeMoveType(TURBOS_POSITION_TYPE)!;"
normalized_replacement = normalized_anchor + "\nconst NORMALIZED_POOL_POSITION_VALUE_TYPE = canonicalizeMoveType(TURBOS_POOL_POSITION_VALUE_TYPE)!;"
if normalized_anchor not in text:
    raise SystemExit('Expected normalized-position anchor was not found.')
text = text.replace(normalized_anchor, normalized_replacement, 1)

scanner = r'''async function defaultScanNfts(
  grpcHost: string,
  maxPages: number,
  coverage: TurbosCoverage,
): Promise<TurbosNftScan> {
  const client = new SuiGrpcClient({
    network: 'mainnet',
    transport: new GrpcTransport({
      host: grpcHost.replace(/^https?:\/\//, ''),
      channelCredentials: ChannelCredentials.createSsl(),
    }),
  });
  const positionFieldIds: string[] = [];
  let pages = 0;
  let objectsScanned = 0;
  let malformedTypeObjects = 0;
  let malformedObjectIds = 0;
  let duplicateObjectIds = 0;

  for (const poolId of TURBOS_TREE_POOL_IDS) {
    let cursor: string | undefined;
    let reachedPoolEnd = false;
    for (let page = 0; page < maxPages; page += 1) {
      const result = await client.core.listDynamicFields({
        parentId: poolId,
        cursor,
        limit: 1_000,
      });
      coverage.requestAttempts += 1;
      pages += 1;
      const fields = Array.isArray(result.dynamicFields) ? result.dynamicFields : [];
      objectsScanned += fields.length;
      for (const field of fields) {
        if (canonicalizeMoveType(field.valueType) !== NORMALIZED_POOL_POSITION_VALUE_TYPE) continue;
        const fieldId = normalizeSuiAddress(field.fieldId);
        if (!fieldId) {
          malformedObjectIds += 1;
          continue;
        }
        positionFieldIds.push(fieldId);
      }
      if (!result.hasNextPage) {
        reachedPoolEnd = true;
        break;
      }
      if (typeof result.cursor !== 'string' || !result.cursor) break;
      cursor = result.cursor;
    }
    if (!reachedPoolEnd) {
      return {
        treeNodes: [],
        reachedEnd: false,
        pages,
        objectsScanned,
        malformedTypeObjects,
        malformedObjectIds,
        duplicateObjectIds,
      };
    }
  }

  const nftReferences: Array<{ nftId: string; poolId: string }> = [];
  const seenReferences = new Set<string>();
  for (let index = 0; index < positionFieldIds.length; index += 50) {
    const { objects } = await client.core.getObjects({
      objectIds: positionFieldIds.slice(index, index + 50),
      include: { json: true },
    });
    coverage.requestAttempts += 1;
    for (const object of objects) {
      if (object instanceof Error) throw object;
      const json = record(object.json);
      const nameValue = record(json.name).name;
      const name = typeof nameValue === 'string' ? nameValue.trim().toLowerCase() : '';
      const match = name.match(/^(?:0x)?([0-9a-f]{1,64})-/);
      if (!match) {
        malformedObjectIds += 1;
        continue;
      }
      const nftId = normalizeSuiAddress(`0x${match[1].padStart(64, '0')}`);
      const value = record(json.value);
      const poolId = normalizeSuiAddress(value.pool_id ?? value.poolId);
      if (!nftId) {
        malformedObjectIds += 1;
        continue;
      }
      const referenceKey = `${nftId}:${poolId || ''}`;
      if (seenReferences.has(referenceKey)) {
        duplicateObjectIds += 1;
        continue;
      }
      seenReferences.add(referenceKey);
      nftReferences.push({ nftId, poolId: poolId || '' });
    }
  }

  const treeNodes: JsonRecord[] = [];
  const seenLiveNfts = new Set<string>();
  for (let index = 0; index < nftReferences.length; index += 50) {
    const batch = nftReferences.slice(index, index + 50);
    const { objects } = await client.core.getObjects({
      objectIds: batch.map((item) => item.nftId),
      include: { json: true },
    });
    coverage.requestAttempts += 1;
    for (let offset = 0; offset < objects.length; offset += 1) {
      const object = objects[offset];
      const reference = batch[offset];
      if (object instanceof Error) {
        if (/not found/i.test(object.message)) continue;
        throw object;
      }
      const nftId = normalizeSuiAddress(object.objectId);
      if (!nftId || nftId !== reference.nftId) {
        malformedObjectIds += 1;
        continue;
      }
      if (seenLiveNfts.has(nftId)) {
        duplicateObjectIds += 1;
        continue;
      }
      seenLiveNfts.add(nftId);
      if (canonicalizeMoveType(object.type) !== canonicalizeMoveType(TURBOS_POSITION_NFT_TYPE)) {
        malformedTypeObjects += 1;
        continue;
      }
      const json = record(object.json);
      const poolId = normalizeSuiAddress(json.pool_id);
      if (!poolId || !TURBOS_TREE_POOL_IDS.includes(poolId as typeof TURBOS_TREE_POOL_IDS[number])) {
        malformedTypeObjects += 1;
        continue;
      }
      if (reference.poolId && reference.poolId !== poolId) {
        malformedTypeObjects += 1;
        continue;
      }
      const ownerRecord = record(object.owner);
      const ownerKind = typeof ownerRecord.$kind === 'string' ? ownerRecord.$kind : 'Unknown';
      const ownerValue = ownerRecord[ownerKind];
      const ownerAddressValue = typeof ownerValue === 'string' ? ownerValue : record(ownerValue).address;
      treeNodes.push({
        address: nftId,
        owner: {
          __typename: ownerKind,
          address: ownerAddressValue ? { address: ownerAddressValue } : undefined,
        },
        asMoveObject: { contents: { json } },
      });
    }
  }

  return {
    treeNodes,
    reachedEnd: true,
    pages,
    objectsScanned,
    malformedTypeObjects,
    malformedObjectIds,
    duplicateObjectIds,
  };
}'''

pattern = re.compile(r"async function defaultScanNfts\([\s\S]*?\n}\n\nfunction defaultObjectGetters")
match = pattern.search(text)
if not match:
    raise SystemExit('The existing Turbos global scanner block was not found.')
text = text[:match.start()] + scanner + "\n\nfunction defaultObjectGetters" + text[match.end():]

old_call = """const scan = await (options.scanNfts || (() => defaultScanNfts(
      options.graphqlUrl || DEFAULT_GRAPHQL_URL,
      options.fetchImpl || fetch,
      pageSize,
      maxPages,
      maxRetries,
      sleepImpl,
      coverage,
    )))();"""
new_call = """const scan = await (options.scanNfts || (() => defaultScanNfts(
      options.grpcHost || DEFAULT_GRPC_HOST,
      maxPages,
      coverage,
    )))();"""
if old_call not in text:
    raise SystemExit('The existing Turbos default-scanner invocation was not found.')
text = text.replace(old_call, new_call, 1)
provider_path.write_text(text, encoding='utf-8')

test_path = Path('tests/turbos-tree-lp-provider.test.ts')
test_text = test_path.read_text(encoding='utf-8')
test_text = test_text.replace(
    "  TURBOS_PACKAGE,\n  TURBOS_POSITION_TYPE,",
    "  TURBOS_PACKAGE,\n  TURBOS_POOL_POSITION_VALUE_TYPE,\n  TURBOS_POSITION_TYPE,\n  TURBOS_TREE_POOL_IDS,",
    1,
)
anchor = "const poolId = `0x${'9'.repeat(64)}`;"
checks = """assert.equal(TURBOS_TREE_POOL_IDS.length, 5);
assert.equal(new Set(TURBOS_TREE_POOL_IDS).size, 5);
assert.equal(TURBOS_POOL_POSITION_VALUE_TYPE, `${TURBOS_PACKAGE}::pool::Position`);

"""
if anchor not in test_text:
    raise SystemExit('Turbos test insertion anchor was not found.')
test_text = test_text.replace(anchor, checks + anchor, 1)
test_path.write_text(test_text, encoding='utf-8')
