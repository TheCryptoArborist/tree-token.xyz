# Grove Chess NFTree finishes

Two trial games per browser include Classic Gold. After those games, current NFTree ownership is required for further play. Each currently held rarity unlocks exactly its matching
finish: Common/Birch Silver, Rare/Sapphire Stream, Epic/Amethyst Grove,
Legendary/Ancient Amber, Mythic/Rose Canopy, 1-of-1/Opal Crown. Bases and outer
contours change; existing illustrated art files and chess rules are unchanged.
Birch keeps pale bases, Pine dark bases. Both local sides share the connected
wallet's collection and can select different finishes. This is shared-device
local play, not remote multiplayer or separate player wallet accounts.

`finish-access.js` reuses the existing `/assets/arcade/arcade-growth-wallet.js`
bridge and `/scripts/profile-studio-access-v4.js` mainnet direct/kiosk reader.
There are no signatures, payments, server writes or financial benefits. A saved
choice is a preference, never ownership evidence. Checks expire after two minutes,
refresh on focus, fail closed, and discard stale responses after wallet changes.
Only verified NFT records from partial scans can unlock their exact rarity.

The selector shows all finishes and disables unowned options. Connecting a wallet
is optional. An unavailable provider locks holder access; an already-started free game remains playable. CSS cosmetics
are client-side presentation, not a security boundary for monetary entitlements.

Validation covers guests, six rarity choices, two distinct side finishes, expired
access, wallet switch/disconnect, lookup failure, stale responses, small-screen
layouts and original chess/cabinet behavior. Browser holder checks use intercepted
wallet and reader fixtures; they do not represent a real-wallet signing session.
The existing wallet bridge, ownership reader, lobby and backend stay byte-exact.

## Trial access

A trial starts on its first legal move and can be resumed without spending another
slot. Restarting and making a move spends the next slot; undo does not refund it.
A completed trial cannot be reopened with undo. Both computer and local play use
the same two-game browser allowance. Holder games do not spend trial slots.
Disconnect or expired evidence pauses holder-only gameplay until verification.

This is an anonymous browser trial, saved in localStorage. Clearing site data or
using another browser starts a fresh allowance. Client-side game access is not
a server-enforced anti-abuse boundary; there are no financial rewards attached.
The gate is applied on the direct game route and move handlers, not just the
Arcade cabinet. The cabinet now states the two-game/NFTree access policy.
