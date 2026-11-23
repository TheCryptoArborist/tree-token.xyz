# Private phone-review kit

The next step after the integrated r13 review is physical-phone listening and play. The current cloud environment exposes SSH but has no configured public HTTP preview endpoint. A portable private LAN kit is therefore prepared; nothing was deployed or exposed through a new public tunnel.

Download `/workspace/treeforce89-phone-review-r13.zip` (8,169,150 bytes). SHA-256: `6806c9cb7d7e1d140b18d6c41e4a81798dfc7fa11d6de77fe03890285540e778`.

1. Extract the ZIP on a computer with Node.js 22 or later.
2. In the extracted `treeforce89-phone-review-r13` folder, run `node start.mjs`.
3. Connect your phone to the same Wi-Fi and open the printed phone URL. If multiple addresses appear, choose the computer's Wi-Fi address. Allow local-network firewall access if prompted; guest-network isolation or a VPN can prevent access.
4. Tap **Play review**. Follow the checklist, then send notes or a short screen recording with your phone model and browser. Stop the server with Ctrl+C when finished.

The game runs entirely from the extracted kit. No npm install is needed. Keep the computer awake. The workspace's own private IP addresses are not phone preview URLs; run the extracted kit on your own computer to obtain a reachable address.

## Contents and boundaries

This packages the existing r13 game without changing its code, music or artwork. The practice page links back to a phone-friendly checklist instead of the authenticated application. The kit includes no backend or authenticated application entry page. Server-side writes return 405; API reads remain local and return 401. Practice cannot connect a wallet, save a score or pay for a continue. Do not publish this ungated harness or deploy it as a production replacement.

Packaging checks exposed dependencies absent from the earlier partial capture: `retro-achievements.css` and `dex-reward-token.jpeg`. They are now included in the kit. Both match fresh live bytes:

| File | SHA-256 |
| --- | --- |
| Achievement CSS | `af0a37bfbfad70ef7cd79ba7acf79ba70ca384ff6d0c645d7b2486152625ee0f` |
| DEX reward image | `ac5ace425daae04e86d9b9596fb1a3bf77f4c55665ad61c7ec0ca0a615ff28a5` |

The image also matches the standalone repository's public asset. Existing shared receipt modules are copied as dependencies; the harness does not invoke real receipt sharing. Production files, backend functions, schedules and access rules remain untouched.

## Verification

`node tests/treeforce-local/device-kit-browser.cjs` passes at 320/390/430px against the generated kit on port 4188. It checks the actual landing-to-title-to-play flow, portrait/landscape/portrait resizing, Auto Fire after resizing, no page errors, no missing assets and no external requests. The title's attempted leaderboard read is correctly denied locally and recorded separately. Writes and the absent authenticated entry page are also checked. See [results](treeforce89-device-kit-checks.json) and [390px screenshot](treeforce89-device-kit-390.png).

The ZIP passes its integrity check. All 37 recorded file hashes match after extraction. A separate extracted-kit smoke check starts its server and opens the game without repository dependencies. These are Chromium automation checks, not physical phones or Safari/WebKit certification. The environment does not have Playwright WebKit installed.

Rebuild into a fresh directory:

```sh
node scripts/treeforce-local/prepare-device-kit.mjs release/treeforce-integrated-review /tmp/treeforce-phone-review-new
node /tmp/treeforce-phone-review-new/start.mjs 4188
node tests/treeforce-local/device-kit-browser.cjs
```

The builder refuses an existing output directory and verifies every reviewed overlay hash before copying. It deliberately does not package repository configuration, credentials, functions or schedules.

## Still pending

Use this kit for speaker/headphone listening, thumb comfort, tutorial clarity, hero/boss visibility, enemy motion, pause/return and sustained performance. Real Slush, authenticated saves and receipt sharing still need a separately authorized authenticated device setup. Local HTTP also cannot certify HTTPS-only browser APIs. No real payment was attempted and task 8's phone checks remain incomplete until observed on hardware.
