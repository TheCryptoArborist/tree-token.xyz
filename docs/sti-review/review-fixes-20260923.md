# PR #32 release review fixes — 2026-09-23

The approved badge, index price/NAV, basket visuals and native purchase modules remain byte-identical to preview commit `5e4f6094e1647ca1d5bace65d9fd5d41ee671f17`.

Two review findings were corrected before release:

- Preview Canopy exposure/badge aliases now map to fixed production snapshot GET endpoints. Local reads use the same mapping. Query parameters and credentials are not forwarded; writes and refresh routes remain blocked.
- Saved wallet restoration retries after late wallet registration, coalesces concurrent attempts, and stops when the user chooses another wallet or disconnects/forgets. Optional Slush loading still cannot block the wallet picker.

Validation: 56 source/unit/build inventory tests passed, including production snapshot integrity, STI protection rules, V3 combined volume and Knowledge Trial source safeguards. Production verification and full build passed. Six browser restoration scenarios passed: late registration, forgetting before registration, choosing another wallet before registration, forgetting during silent restoration, choosing another wallet during silent restoration, and concurrent restoration deduplication. Desktop/mobile picker responsiveness passed while Slush remained pending. No transaction was signed or submitted.

The release inventory pins the corrected wallet SHA-1 `a401cb82afb8de801eb9c9effbc961cdbbd0e46a`. It changes only the same eight frontend paths, retains all 189 baseline paths, and preserves all 37 running function packages/configurations and five schedules. This record describes a candidate; the actual publication is recorded separately in `production/current-release.json`.
