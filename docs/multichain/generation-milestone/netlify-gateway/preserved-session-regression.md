# Preserved r19 authenticated-session regression

November 25, 2026. Source/test milestone only; nothing published or activated.

The new `check-preserved-bnb-session-browser.mjs` exercises the captured r19 page
and isolated candidate without altering either bundle. It registers a synthetic
Wallet Standard wallet, intercepts every browser request, and fails on unexpected
requests. There are no private keys, real signatures, forwarded API calls or
chain transactions. The captured files, copied modules and candidate entry are
hash-checked against the candidate provenance before execution.

Seven checks passed: integrity plus three scenarios at 390px and 1000px. Each
scenario runs separately against both pages and compares rendered results:

- Message sign-in creates a fixture native session and mounts the game canvas.
  Switching to a different account removes the game/checkout and revokes the old
  session using its bearer token.
- Advancing the browser clock beyond expiry preserves r19's paused run, hides the
  game viewport and offers **Verify & resume run**. It does not replace that newer
  behavior with the older gateway's destructive expiry teardown.
- A saved native payment opens the original 20,000 TREE recovery dialog. Checking
  its receipt sends the exact saved offer/digest and bearer token to a local
  negative fixture. The recovery record stays saved, another payment button is
  absent, and changing accounts removes the checkout and revokes the session.

Every scenario asserts exactly one synthetic message signature, zero transaction
requests, no BNB review controls, no unexpected requests and no page exceptions.
The backend response is intentionally unverified; no successful payment or lives
restoration is claimed. Image/font requests and image fetches are stubbed; this
is not an artwork, pixel, game mechanics or real wallet-extension test.

## Reproduce

Follow `preserved-review.md` to prepare a fresh hash-pinned candidate and install
the existing pinned Playwright dependency. Then:

```sh
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-preserved-bnb-session-browser.mjs /tmp/new-bnb-preserved-candidate
node --test tests/multichain-preserved-bnb-review.test.mjs tests/multichain-native-frontend-release.test.mjs
```

The latter twelve offline tests also passed. Results and entry hashes are retained
in `preserved-session-tests.json`. Capture guards intentionally reject subsequent
canonical drift; do not weaken them to regenerate an obsolete release.

Current MystenLabs skills README, `frontend-apps/SKILL.md`, `react.md` and
`transactions.md` were fetched and read for Wallet Standard/dApp Kit guidance.
The actual captured runtime is authoritative for these regression expectations;
no SDK migration or game-source rewrite is part of this milestone.

## Next work

Exercise the opt-in BNB review lifecycle inside the preserved runtime, including
navigation during signing, and test successful native paid restoration using
local fixtures. Actual extensions, artwork and full game behavior still need
review. Before any canonical publication, recapture the full current production
inventory and deployment lock, preserving concurrent Tree Force releases.
Backend migration, trusted checkpoint evidence, legacy-writer drain,
cross-payment coordination and expired-session recovery remain payment launch
gates. Existing Sui gameplay is unchanged; BNB gameplay/payment activation remains
outside this milestone. Individual NFT identity/artwork/custody rules are unchanged.
