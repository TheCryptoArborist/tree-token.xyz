// Smoke-test the actual extracted deployment, not a separately compiled source.
// Usage: node tests/arcade-growth-packaged.mjs UNPACKED_FUNCTION_DIR ISOLATED_DEPENDENCY_DIR
// The second argument may be the isolated build directory or its node_modules.
// All keys and storage are ephemeral fixtures; no transaction or network call is made.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const [unpackedArgument, dependencyArgument, ...extra] = process.argv.slice(2);
assert.ok(unpackedArgument && dependencyArgument && extra.length === 0,
  'Usage: node tests/arcade-growth-packaged.mjs UNPACKED_FUNCTION_DIR ISOLATED_DEPENDENCY_DIR');
const unpacked = realpathSync(resolve(unpackedArgument));
const entry = resolve(unpacked, 'netlify/functions/arcade-growth.mjs');
assert.ok(existsSync(entry), 'The extracted deployment entry is missing.');
const dependencyRoot = resolve(dependencyArgument);
const signerPackage = [resolve(dependencyRoot, 'node_modules/@mysten/sui'), resolve(dependencyRoot, '@mysten/sui')]
  .find((path) => existsSync(resolve(path, 'dist/keypairs/ed25519/index.mjs')));
assert.ok(signerPackage, 'The isolated pinned SDK is missing.');
const signerVersion = JSON.parse(readFileSync(resolve(signerPackage, 'package.json'), 'utf8')).version;
assert.equal(signerVersion, '2.26.1', 'Use the SDK version pinned by the function dependency lock.');

// Check package-local resolution before running the real lazy imports. A missing
// dependency must not silently succeed through a parent workspace installation.
const packagedRequire = createRequire(pathToFileURL(entry));
for (const specifier of ['@mysten/sui/verify', '@mysten/sui/grpc']) {
  const file = realpathSync(packagedRequire.resolve(specifier));
  assert.ok(file.startsWith(unpacked + sep), `${specifier} resolved outside the extracted deployment.`);
}
const packedSdk = resolve(unpacked, 'node_modules/@mysten/sui/package.json');
assert.equal(JSON.parse(readFileSync(packedSdk, 'utf8')).version, signerVersion,
  'The packaged verifier and isolated signer must use the same pinned SDK.');

const originalFetch = globalThis.fetch;
let networkAttempts = 0;
globalThis.fetch = async () => {
  networkAttempts += 1;
  throw new Error('This packaged-runtime test forbids network access.');
};

try {
  const { createArcadeGrowthHandler } = await import(pathToFileURL(entry).href);
  assert.equal(typeof createArcadeGrowthHandler, 'function', 'The actual package does not export its handler factory.');
  const { Ed25519Keypair } = await import(pathToFileURL(resolve(signerPackage, 'dist/keypairs/ed25519/index.mjs')).href);
  const owner = Ed25519Keypair.generate();
  const otherSigner = Ed25519Keypair.generate();
  const wallet = owner.getPublicKey().toSuiAddress();
  assert.notEqual(wallet, otherSigner.getPublicKey().toSuiAddress());
  const origin = 'https://tree-token.xyz';
  const hash = (value) => createHash('sha256').update(value).digest('hex');

  function fixture(fourGamePassport = false) {
    let challenge;
    let session;
    let tokenHash;
    let sessionWrites = 0;
    const unexpected = async () => { throw new Error('An unrelated store operation was called.'); };
    const store = {
      publicRules: unexpected,
      async createChallenge(input) {
        assert.equal(input.wallet, wallet);
        assert.equal(input.origin, origin);
        challenge = { challengeId: input.challengeId, wallet: input.wallet, origin: input.origin,
          dateKey: input.dateKey, message: input.message, expiresAt: input.expiresAt, consumed: false };
        return structuredClone(challenge);
      },
      async readChallenge(id) {
        assert.equal(id, challenge?.challengeId);
        return structuredClone(challenge);
      },
      async createSession(input) {
        assert.equal(input.challengeId, challenge.challengeId);
        assert.equal(input.wallet, wallet);
        assert.equal(input.origin, origin);
        assert.equal(challenge.consumed, false);
        challenge.consumed = true;
        sessionWrites += 1;
        tokenHash = input.tokenSha256;
        session = { wallet: input.wallet, origin: input.origin, expiresAt: input.expiresAt, revoked: false };
        return structuredClone(session);
      },
      async snapshot(passedHash, passedOrigin, enabledGames) {
        assert.equal(passedHash, tokenHash);
        assert.equal(passedOrigin, origin);
        const dateKey = new Date().toISOString().slice(0, 10);
        const eligibleGames = [...enabledGames, 'treeforce89'];
        return { wallet, dateKey, monthKey: dateKey.slice(0, 7), enabledGames: fourGamePassport ? eligibleGames : [...enabledGames],
          eligibleGames,
          checkins: [], quests: [], gamesByDay: [], badges: [] };
      },
      readSession: unexpected,
      revokeSession: unexpected,
      checkIn: unexpected,
      recordEvents: unexpected,
    };
    const dependencies = {
      env: { ARCADE_GROWTH_ENABLED: 'true', ARCADE_GROWTH_RATE_LIMIT_SECRET: 'packaged-smoke-fixture-only-secret' },
      store,
      ownership: async (address) => ({ address, network: 'sui-mainnet', nftreeCount: 1 }),
    };
    assert.equal(Object.hasOwn(dependencies, 'verifySignature'), false,
      'The packaged signature verifier must execute without an override.');
    const handler = createArcadeGrowthHandler(dependencies);
    async function call(action, body) {
      const response = await handler(new Request(`${origin}/api/arcade-growth?action=${action}`, {
        method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }), { ip: '192.0.2.10' });
      return { status: response.status, data: await response.json() };
    }
    return { call, sessionWrites: () => sessionWrites, tokenHash: () => tokenHash };
  }

  const outcomes = [];
  for (const scenario of ['valid', 'valid-four-game-passport', 'wrong-account', 'wrong-message']) {
    const fourGamePassport = scenario === 'valid-four-game-passport';
    const f = fixture(fourGamePassport);
    const issued = await f.call('challenge', { wallet });
    assert.equal(issued.status, 200, `${scenario}: the actual handler did not issue a challenge.`);
    const challenge = issued.data.challenge;
    assert.equal(challenge.wallet, wallet);
    assert.match(challenge.message, /TREE Arcade Daily Growth/);
    assert.ok(challenge.message.includes(`Wallet: ${wallet}`));
    assert.ok(challenge.message.includes(`URI: ${origin}/play/`));
    const signer = scenario === 'wrong-account' ? otherSigner : owner;
    const message = scenario === 'wrong-message' ? `${challenge.message}\nDifferent message` : challenge.message;
    const { signature } = await signer.signPersonalMessage(new TextEncoder().encode(message));
    // Keep the claimed account and issued challenge correct in both negative
    // cases, so rejection must reach the real cryptographic verification path.
    const result = await f.call('session', { wallet, challengeId: challenge.challengeId, signature });
    if (scenario === 'valid' || fourGamePassport) {
      assert.equal(result.status, 200, `Valid personal signature failed: ${result.data.error || 'unknown error'}`);
      assert.equal(result.data.authenticated, true);
      assert.equal(result.data.session.wallet, wallet);
      assert.match(result.data.session.token, /^[a-f0-9]{64}$/);
      assert.equal(f.tokenHash(), hash(result.data.session.token));
      assert.equal(f.sessionWrites(), 1);
      assert.equal(result.data.progress.checkedInDays, 0);
      assert.equal(result.data.progress.questDays, 0);
      assert.equal(result.data.progress.passport.enabledGames.length, fourGamePassport ? 4 : 3);
      assert.deepEqual(result.data.progress.passport.optionalGames.map(game => game.id), fourGamePassport ? [] : ['treeforce89']);
    } else {
      assert.equal(result.status, 401, `${scenario}: the cryptographic mismatch was not rejected.`);
      assert.equal(result.data.error, 'invalid-signature');
      assert.equal(f.sessionWrites(), 0, `${scenario}: an invalid signature created a session.`);
      assert.equal(result.data.session, undefined);
    }
    outcomes.push({ scenario, status: result.status });
  }
  const driverPath = realpathSync(packagedRequire.resolve('pg'));
  assert.ok(driverPath.startsWith(unpacked + sep), 'PostgreSQL driver resolved outside the deployment.');
  const driverPackage = JSON.parse(readFileSync(resolve(unpacked, 'node_modules/pg/package.json'), 'utf8'));
  assert.equal(driverPackage.version, '8.23.1');
  const { default: pg } = await import(pathToFileURL(driverPath).href);
  const pool = new pg.Pool({ max: 1, connectionTimeoutMillis: 100 });
  assert.equal(typeof pool.query, 'function'); await pool.end();
  const runId = 'grove-' + 'a'.repeat(32), gameToken = 'b'.repeat(64);
  const dateKey = new Date().toISOString().slice(0, 10);
  let participationWrites = 0;
  const participationHandler = createArcadeGrowthHandler({ env: { ARCADE_GROWTH_ENABLED: 'true' },
    treeforceSession: async ({ tokenSha256, runId: actualRun }) => {
      assert.equal(tokenSha256, hash(gameToken)); assert.equal(actualRun, runId);
      return { wallet, runId, sessionExpiresAt: new Date(Date.now() + 60000).toISOString(), verifiedAt: new Date().toISOString() };
    },
    ownership: async (address) => ({ address, network: 'sui-mainnet', nftreeCount: 1 }),
    store: { async recordTreeforcePlay(input) {
      assert.equal(input.wallet, wallet); assert.equal(input.runId, runId); participationWrites++;
      return { snapshot: { wallet }, participation: { saved: true, runId, sourceId: `run:${runId}:${wallet}`,
        dateKey, recordedAt: new Date().toISOString(), alreadyRecorded: false } };
    } },
  });
  const played = await participationHandler(new Request(`${origin}/api/arcade-growth?action=treeforce-play`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer ${gameToken}` },
    body: JSON.stringify({ runId }),
  }));
  assert.equal(played.status, 200); assert.equal((await played.json()).participation.saved, true);
  assert.equal(participationWrites, 1);
  outcomes.push({ scenario: 'authenticated-first-wave-report', status: played.status });
  assert.equal(networkAttempts, 0, 'An unexpected external request was attempted.');
  console.log(JSON.stringify({ result: 'PASS', packagedRuntime: true, sdkVersion: signerVersion,
    actualLazyVerifierAndGrpcImports: true, pgVersion: driverPackage.version, outcomes, networkAttempts, transactions: 0 }));
} finally {
  globalThis.fetch = originalFetch;
}
