# Exact function archive recovery — November 24, 2026

Recovered 11 of the 23 previously missing live ZIPs from original GitHub Actions
artifacts. All 11 bytes/hashes independently match the pinned live deployment.
Together with 38 existing tracked archives, **49 of 61** packages are available.
They are durable on `feat/bnb-generation-custody`, including archive commit
`8bae25c`. No application was rebuilt, no environment setting was changed, and
no Netlify deployment was created or published during recovery.

Successful recovery run:
https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/45471982264

The standard GitHub artifact action downloaded all 117 selected artifacts
successfully. The earlier custom transport retrieved none and made no changes.
`artifacts.json` identifies the inspected artifacts; `recovered.json` maps each
matching ZIP to its original artifact/run and archive entry. The recovery reads
ZIP contents without executing them and retains only exact live SHA-256 matches.
Recovery ZIPs are private server deployment material in the source repository;
never copy this directory into public/static website output.

Run `node scripts/check-bnb-function-archives.mjs` to independently hash every
tracked ZIP and reproduce `coverage.json`. It checks every recovered byte count
and hash against the pinned inventory. This is an archive check, not permission
to deploy an old baseline. Capture current production again before any release.

## Remaining gap

Twelve live packages have no exact match in the inspected release artifacts:
`treeforce89-dev`, `arcade-growth`, `canopy-access`, `arcade-social`,
`arcade-campaign`, `treeforce89-scores`, `arcade-streak-milestones`,
`treeforce-session-refresh`, `arcade-completed-runs`, `arcade-events`,
`arcade-bnb-test`, and `root-rage-access`.

For example, both upload steps in `.github/workflows/publish-bnb-backing.yml`
retain the BNB inspector's manifest and evidence but exclude its ZIP. Re-running
its build is not exact-package recovery. Do not rebuild these unrelated live
handlers merely to bypass preservation checks. Other archived environments may
still hold their original ZIPs; this result is limited to tracked files and the
117 inspected artifacts, not a claim that no copy exists anywhere.

## Next implementation option

Prepare a separately reviewed replacement of only `arcade-bnb-run-review`, with
an explicit generation-1-only review policy in that isolated package. Keep all
site-wide environment records unchanged, so the other 60 functions can retain
their current package/provider records. Test the policy and every denial path,
build and inspect its exact ZIP, capture a fresh baseline, and verify candidate
reuse before publication. Abort if Netlify still requests unrelated packages.
This option is documented only; it has not been implemented or deployed here.
Gameplay, payments, new generation admission and deposits remain disabled.

The final read-only check still found live deploy `6b053b8285e0ee251b84ad06`
ready/current and the canonical review response `review-disabled`, with false
gameplay. The cancelled enablement candidate remains historical evidence only.
