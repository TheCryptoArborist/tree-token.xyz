# Grove Chess online multiplayer

Online mode creates a shareable room with two fixed seats. The server validates
moves with the same vendored chess.js engine, then compares the room revision
inside a database transaction. Spectators are read-only. Reloads preserve the
seat through a Secure, HttpOnly browser cookie. Undo is disabled online; players
can resign. Invitations expire in 15 minutes; inactive matches expire in 24 hours.

Guest allowances are shared with the existing browser trial ledger. Waiting does
not consume a game; joining debits each guest once in the room transaction.
After two games, a valid signed Arcade session and canonical server NFTree
ownership check are required. Holder seats remain bound to that verified wallet.
This uses the existing free Arcade sign-in message; no payments or stakes.
Anonymous trials remain resettable by clearing browser data.

`private.grove_chess_players`, `private.grove_chess_rooms`, and the isolated
`grove_chess_v1` RPC use RLS and service-role-only grants. No other game tables or
RPCs change. The public invitations feed exposes only open room IDs and expiry
metadata. The game response never includes wallet addresses or cookie hashes.

The existing @NFTreeHolderBot is hosted by the Garden Battles Railway service,
project `hopeful-abundance`, service `gardenbattles`. Its existing notifier polls
TREE FORCE results. The companion Grove Chess poller uses this same credential,
chat, and topic 115319. It posts only explicit Find an opponent requests, with
`/play/grove-chess/assets/grove-chess-cover.png` and a direct join button. Private
matches do not produce notifications. Attempts are persisted before sending to
avoid duplicate alerts after ambiguous Telegram timeouts; an uncertain delivery
is not automatically retried. No startup or test announcement is added.

Tests cover database access grants, seats, revisions, allowances, signed-holder
verification, illegal/out-of-turn moves, and separate browser contexts for moves,
reconnect, spectating and resignation. Telegram tests use a mocked sender.
Deploy with the dedicated preservation workflow, preserving all existing static
paths outside its allowlist, backend/provider records, settings and schedules.
