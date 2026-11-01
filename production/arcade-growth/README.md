# Daily Growth function archive

`arcade-growth.zip` is the exact isolated new function package for the October
31, 2026 Daily Growth release. It is not part of the historical 38-function
recovery baseline and must not be mixed into that archived manifest.

SHA-256: `9cb883fd1f22de64d4c3c6b6fc82a34ae1929cd927afdbb63201317cae12dc0b`

The package contains 245 entries and no symlinks. Node runtime: `nodejs22.x`;
invocation mode: `stream`; route: GET/POST `/api/arcade-growth`.

See `docs/arcade-growth-function.json` for pinned source inputs and package
configuration, `docs/arcade-growth.md` for rules and validation, and
`docs/arcade-growth-published.json` for the published provider identity.

To restore only this new local package for a subsequent preserved release,
copy it to `.netlify/arcade-growth-functions/arcade-growth.zip` and copy the
corresponding manifest to that directory. Verify its SHA-256 and source inputs
before use. Existing games and scheduled jobs must retain their exact deployed
packages and full provider records.
