# NFT artwork belongs in the bottom badge picker

The NFT panel is after the other badge collections. It lists actual NFTrees owned
by the connected wallet. Selection updates the round bottom medallion, never the
uploaded profile photo. Labels explicitly separate uploading a profile photo,
picking a border and choosing a bottom badge. The top wallet area is compact;
extra NFT navigation/global refresh buttons and long instructions are removed.
Wallet choices clear immediately after selection, rather than after all holdings
finish loading. Local sign-in and the existing shared Arcade session remain.

The screenshot wallet's previous lookup failed because Kiosk items are owned by
dynamic-object-field wrappers rather than directly by the Kiosk address. The new
reader starts with canonical directly owned NFTs and owned KioskOwnerCaps, then
traverses each owned Kiosk's Item field value. It requires the canonical NFT type,
a valid field address, matching Item ID/value object ID and matching metadata ID.
It skips unrelated collections and never authorizes an unverified object.

Kiosk scans use at most four workers. Verified items appear progressively on the
first load; same-wallet refresh preserves the prior selection until verification
finishes. Failed Kiosks cannot erase independently verified items; partial lookup
is explicitly reported in the NFTs panel. Export still waits for and rechecks
current ownership, and missing/transferred artwork is revoked.

Read-only live lookup of the exact screenshot wallet completed: three canonical
NFTrees, two directly owned and one in a Kiosk, no partial errors,30 GraphQL calls.
The direct NFT #300 image returned HTTP200 and Access-Control-Allow-Origin: *.
Seventeen focused tests passed, including real-shaped dynamic-field/value links,
partial lookup failures, forged links, photo preservation and bottom medallion
placement, plus existing session/sign-in/account/expiry/transfer regressions.
No real-wallet connection, signature, payment or user's photo upload performed.
