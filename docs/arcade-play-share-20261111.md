# Play then share — isolated review

Community is removed from the preview navigation. Its share activity follows the Daily gameplay quest. Weekly voting and official social links move to the Arcade home outside tab panels. Friend challenge is removed from this new flow; historical progress remains in the existing service.

Fresh saved results for Garden Bot, PvP and Arborist Trials unlock a constrained result share builder. Only games in today's completed result list appear. Tree Force first-wave participation, monthly-only stamps, stale/loading data, sign-out and prior UTC days do not unlock sharing. Identity changes discard the prior result selection. Opening a composer or downloading an image never grants credit. An X post URL still enters the existing review queue.

## Outstanding backend work before replacing the main Arcade

The existing social API awards reviewed share-score stamps weekly, not daily. The page states this limit. The frontend gating is a guided experience, not new server enforcement: the existing endpoint still accepts its original weekly mission payload. A true second daily quest requires server validation and per-day receipt-bound storage/review/idempotency, plus migration preserving all historical stamps. No daily social completion is claimed here.

The growth endpoint exposes a game ID for saved completions, not a run ID or score receipt. Result captions confirm completion without inventing a score. Exact score/result cards require a server-provided wallet-bound run receipt. Tree Force reports start-run only and remains excluded from the share unlock. Its existing first-wave Daily/Passport behavior remains unchanged in this review. Finish-only gameplay tracking must be added before presenting every game as a completion quest.

Review URL after successful release: https://tree-token.xyz/play/quests/preview/. Main /play/ and existing JS remain unchanged. The preservation release adds only the isolated page plus five new modules and asserts complete live backend/runtime/configuration parity. Updates are restricted to these named review-only paths.

Validation: ten result-gating/message/navigation tests, session navigation regressions, signed-out voting, badge markup parity, production snapshot verification. No wallet transaction or real social post was sent. Local browser launch was blocked by runtime socket restrictions; desktop/mobile visual review is still required before promotion.
