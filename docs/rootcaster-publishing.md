# Publish TreeRootCaster

The manually dispatched workflow `Publish TreeRootCaster` adds exactly three new `/rootcaster/` paths atop an explicitly selected current live deployment. It does not run the historical root build, rebuild functions, edit site configuration, or upload backend packages. It requires the current 46-function/five-schedule inventory, exact package/provider/runtime and protected environment comparisons, and an already locked baseline. A different current count or deployment stops for review.

## One-time setup

The workflow must be merged into the default branch before GitHub displays its Run workflow button. Store an authorized Netlify credential as repository Actions secret `NETLIFY_AUTH_TOKEN` under Settings → Secrets and variables → Actions. Never paste credentials in chat, source, issues or workflow inputs. Existing Netlify app authorization does not automatically populate this GitHub secret. Only maintainers trusted to deploy production should control this credential and workflow.

## Run

Actions → Publish TreeRootCaster → Run workflow → main. Enter the actual currently published deploy ID. Leave `publish` false for a candidate-only review; that run cannot publish. The run summary contains the candidate page link and screenshot artifacts. To publish, dispatch another run with the still-current baseline and `publish` true; it creates and validates a fresh candidate before publishing it. A reused or already published gallery path stops this one-time workflow rather than replacing it.

The workflow reads all static paths and full backend records, compares API-visible environment fingerprints, uploads only missing gallery bytes, checks the complete hosted candidate inventory, then checks desktop and phone rendering. Publication uses only the newly created and verified candidate. Any queued Git deploy blocks publication. Publication is rechecked for its lock and complete static/backend/environment inventory. Future Git builds must not replace this preserved snapshot with the old build; the released candidate remains locked.

Raw baseline and plan data remain ephemeral on the runner and are not uploaded as artifacts. Only a public summary and page screenshots are retained. Netlify-masked secret values and deployment-only environment overrides cannot be independently proved by these APIs; the release follows the existing site's package-reuse approach. No credential or environment value is logged. If a request is interrupted or a run fails during publication, inspect the actual Netlify publication before rerunning. Do not unlock or restore an older deploy.

This workflow does not publish creative entries automatically, enable X replies, or change the desktop runner.
