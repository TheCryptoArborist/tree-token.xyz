# BNB Tree Force '89 access — isolated foundation (not deployed)

Update, November 21: the authentication portion is now published. The production
eligibility predicate below remains a mock-tested design boundary: its
hypothetical EVM registry is not a deployed contract. The concrete read-only
inspector of the actual Sui Registry/Vault and completed BNB trial is described
in [`bnb-backing-check.md`](./bnb-backing-check.md). It always denies production
eligibility. New production custody/generation/pass contracts remain required.

## Scope

The original NFTree #2720 round trip completed successfully. The disposable
one-token BNB pass (0x1d3da001E586a7DEFD397B77FADB29eD6F039c13) is
Retired/burned and cannot confer game access. The live Sui Arcade authentication,
TREE payments, leaderboard, Tree Force '89 game bundle and its Netlify functions
remain entirely unchanged.

This stage adds only a reviewed source module and tests. It does **not** add a
public endpoint, issue a session, accept a payment or deploy a page. There is no
production original-backed BNB pass/registry approved yet, so positive gameplay
access intentionally remains disabled. A mocked positive proof in the tests is
not a real entitlement.

## Foundation contract

- EIP-4361-compatible fixed human-readable login message: official domain,
  canonical test URI, chain 56, exact wallet address, 32-byte recommended
  server nonce, issued-at and five-minute expiration, and explicit non-payment
  purpose. The proposed server must persist the challenge before returning it.
- Verification reconstructs the message from the stored record, checks all
  fields, verifies the signature using viem publicClient.verifyMessage (EOA
  and ERC-1271-capable), and requires an atomic one-time nonce consumption.
  It returns an identity proof, not a playable session.
- Session scope is eip155:56:treeforce89-test:v1. No Sui wallet is required.
  The eventual session store must bind token hash, wallet, chain, origin,
  expiry and revocation, with HttpOnly secure cookies or equivalent guarded
  bearer-session design. Never accept a browser-supplied identity as an
  authenticated server session.
- Every access decision pins a single BNB block and checks the exact reviewed
  pass, adapter and onchain registry runtime hashes; state Active, ERC-721
  ownerOf, canPlay, both sides of the adapter binding, NFT object ID, route and
  Sui peer. A *trusted, verified on-chain registry reader* must prove one
  current original NFT locked as the unique backing for this generation,
  with no pending redemption. Missing policy/reader, wrong chain, wrong code,
  retired/locked/transferred pass and any read outage fail closed.
- Server must rerun this check before each start/run creation and each paid
  action. Cached sign-in or localStorage eligibility cannot grant access.

## Integration still required

1. Publish and independently audit the production multi-NFT custody, unique
   generation registry, BNB pass and route before setting a production access
   policy. Complete the existing original collection inventory reconciliation
   before expanding beyond one explicitly allowed original ID.
2. Add an isolated server handler with durable atomic nonce/session storage,
   origin/CSRF checks, rate limits and session revocation. Implement
   readRegistryRecord against the exact reviewed on-chain registry ABI, not an
   HTTP/client-supplied assertion. Test contract-account signatures, RPC errors,
   concurrent nonces, and transfers between signature and action.
3. Add the BNB wallet experience to a dedicated /play/multichaintest/game/bnb/
   test page. Make the existing Tree Force backend honor server-enforced
   chain-qualified sessions, including at run start and paid continues.
   Do not change existing Sui sign-in or tournament eligibility.
4. Ship first to an isolated preview, test retired pass denial, then separately
   fund and buy a reviewed active backed entitlement for positive live testing.
   Capture the entire current Netlify inventory before any production release,
   preserving all existing functions and five schedules.

Reference: docs/multichain/original-collection/integration-review.md.
Current MystenLabs/skills README, accessing-data/SKILL.md, graphql.md,
frontend-apps/SKILL.md, move-security/SKILL.md and best-practices.md were
checked live on November 20, 2026. BNB message format follows ERC-4361;
signature verification uses viem's public-client verifyMessage action.
