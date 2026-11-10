# Profile Studio local sign-in

Studio shares the existing Arcade storage key, same wallet adapter and same
challenge/session/status API. Valid saved sessions restore silently and do not
request another signature. Studio-created sessions store the server's exact expiry
and are reusable by the Arcade. Expired sessions can restore wallet identity only;
a new message signature is required for authenticated monthly badges.

The local Sign in here control never navigates to Arcade. Without a connected
wallet it opens the local wallet choices. It signs only after an explicit click,
using the server's wallet-bound challenge and the existing signPersonalMessage
adapter. No check-in or payment request is made. Repeated clicks, including while
collections refresh is pending, are coalesced to a single signature.

Identity is checked before and after challenge, signing and session creation.
Cancelled/rejected messages, mismatched wallet responses and account changes do not
persist a new session or grant badge access. Existing one-hour server expiry is
unchanged; no backend, wallet SDK, dependencies or payment modules change.

The previously connected Studio wallet is remembered as a restore hint, alongside
an existing/expired Arcade session identity. A restore hint is not authentication.
Monthly awards still require authenticated server status for the current wallet;
NFT artwork requires current canonical direct/Kiosk holdings and export rechecks.

Fourteen focused tests cover local sign-in, shared-session reuse, expiry, rejection,
account changes, rapid/pending-refresh duplicate clicks, ownership/transfer/outage,
Kiosks, focus preservation and presentation. Real-wallet signing is not exercised
by the automated/browser checks. Desktop and340-CSSpx signed-out UI checked.
