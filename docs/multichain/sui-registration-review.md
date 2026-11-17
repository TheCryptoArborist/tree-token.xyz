# Sui LayerZero pilot registration

This release adds only `/play/multichaintest/setup/sui/register/` to the current preserved site. It registers the existing disposable pilot; it does not bind its peer, release its NFT, send a LayerZero message, take a stablecoin payment or enable game access.

## Transaction

One call to the verified deployed package's `bridge::register` using the read-only Bridge, the dev wallet's matching AdminCap, the mutable LayerZero EndpointV2, and an empty `vector<u8>` of OApp execution metadata. The TxContext is injected by Sui. The returned address has `drop` and requires no transfer command. The stored package CallCap identifies this application as the original pilot package, not as the Bridge/OApp object address.

LayerZero's endpoint source explicitly permits empty metadata at registration and later `set_oapp_info`. Executor receive metadata, messaging-library/DVN configuration and peer binding remain separate work. The actual MessagingChannel ID must be read from the signed transaction's registration event; simulation IDs are never used as live configuration.

## Simulation and signing

The checked-in evidence is unsigned and simulation-only. At checkpoint 346038338 (2026-11-17 01:02:22 UTC), checks and actual gas selection were enabled. Estimated net gas: 4,668,124 MIST (0.004668124 SUI). The Bridge remains read-only, and the nested NFT, OApp and peer state do not change. A shared messaging channel and registry record are created. The admin remains owned by the dev wallet.

The browser re-reads typed pilot objects and verifies ownership/identity before a new checked simulation. A failure or existing registration stops the request. It passes an unresolved-gas Transaction instance to the existing dApp Kit wallet integration; Slush selects final gas. A Web Lock and durable pending marker prevent duplicate prompts across tabs. An ambiguous provider outcome leaves the marker in place for manual receipt verification. Only explicit rejection or a known failed transaction clears it. There is no signature timeout/retry.

## Build and verification

Human-readable core: `scripts/sui-registration-core.mjs`.
Browser bundle: `play/multichaintest/setup/sui/register/core.js`.
Built with the already installed `@mysten/sui` 2.26.1 and esbuild:

```
esbuild scripts/sui-registration-core.mjs --bundle --format=esm --platform=browser --minify --outfile=play/multichaintest/setup/sui/register/core.js
```

The existing `wallet-vendor.js` is reused unchanged. No dependency manifest or wallet integration is upgraded. Tests cover transaction shape and gas ownership, pilot ownership changes, simulation changes, explicit consent, account/network changes, successful receipts, known failures, ambiguous outcomes, failed storage and concurrent tabs.

## Current guidance consulted

Live MystenLabs/skills README, `ptbs/SKILL.md`, `ptbs/building.md`, `ptbs/commands.md`, `accessing-data/SKILL.md`, `accessing-data/graphql.md`, `frontend-apps/SKILL.md`, `frontend-apps/non-react.md`, and `frontend-apps/transactions.md` were read for this stage. GraphQL and gRPC are generally available; new code does not use deprecated Sui JSON-RPC.

LayerZero source reviewed: the pinned `endpoint-v2/sources/endpoint_v2.move` registration method and `endpoint-v2/sources/internal/oapp_registry.move`, plus the deployed pilot's `move-lz/sources/bridge.move`. The sources permit registration with empty metadata, enforce one registration per package capability identity and create the messaging-channel shared object.

## Preservation

Expected locked live baseline: `6afb733aaa3097a7e3d3c698`. The publisher adds exactly three registration files, reuses all 49 function packages and preserves all five schedules, runtime configuration, environment fingerprints, snippets and every existing static file. It refuses baseline drift or concurrent production publication.
