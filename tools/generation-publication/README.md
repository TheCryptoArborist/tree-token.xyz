# Canonical desktop Slush handoff

Live URL: https://tree-token.xyz/play/generation-publication/

Use desktop Slush with the approved dev address. Connect, refresh the publication
review, then choose **Sign and publish in Slush**. Only the empty new package is
approved: new upgrade/admin capabilities stay in the dev wallet; maximum gas is
0.1 SUI. No NFT deposit, BNB deployment, route activation, sale or gameplay action
is included. Return the resulting transaction digest for independent verification.

The user clarified `www` is not required. The exact apex origin and page path are
enforced; external previews remain disabled. Do not bypass Slush warnings. Actual
wallet acceptance must be observed in the user's desktop extension.

The fixed GET-only service prepares fresh simulations or validates a receipt. It
never accepts signatures or submits transactions. The browser checks the pinned
commands, sender/gas policy, chain, freshness and exact simulation bytes; verifies
the returned signature and bytes; persists the expected digest before submitting
directly to Sui. No keys enter Cloud or the backend. The two-minute review window
is stricter than the chain's epoch validity. Changed bytes or stale evidence stop
submission. Refreshing requires a new signature.

If submission times out, use **Check publication receipt**. Do not clear storage
or use another device to publish again. The localStorage lock is per origin and
browser, not global. Receipt checking validates expected publication effects;
independent published-bytecode and current capability-owner verification follows.

The bundle is committed. Rebuild with `node tools/generation-publication/build.mjs`;
CI rejects bundle drift. Run `node --test tools/generation-publication/core.test.mjs`.
The historical preview copier remains dependency-free. The root dependency lock
is unchanged. No application wallet integration was migrated.

Release evidence: `docs/multichain/generation-milestone/canonical-live-verification.json`.
The new isolated service was packaged with the pinned Netlify packager; all 52
pre-existing complete backend records and 656 static paths were preserved.
