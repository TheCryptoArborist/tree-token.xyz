# TREE Retro Arcade — NES preview

Destination: `/play/retro/` on tree-token.xyz. This feature is preview-only until a separately verified production release is prepared.

## First milestone

- Self-hosted, fixed JSNES 2.1.0 release, using Canvas 2D rendering. Original Apache-2.0 license retained.
- One built-in game: Falling by Jesse Williams, MIT licensed, original ROM and license retained.
- Local uncompressed `.nes` selection, capped at 16 MiB, with header/declared-length validation. Local files are passed to the player in memory and loaded through a blob URL.
- The player document blocks external connections through its own CSP. No global hosting headers or backend settings change.
- Manual progress saves in IndexedDB keyed by the full ROM SHA-256, independent of filename and source. Saves remain until explicitly replaced. No automatic resume or autosave overwrites a chosen restore point.
- JSON save export/import with ROM identity, emulator identity, byte limits, and state checksum. Raw third-party save states are deliberately not imported through TREE's backup controls.
- Pause, resume, native fullscreen with expanded-player fallback, and touch buttons and built-in keyboard/gamepad input.

## Preview integration

`scripts/retro-preview-files.mjs` is the explicit frontend file inventory. `build-feature-preview.mjs` adds only these files to the existing preview output. The production manifest, root arcade page, production build, function ZIPs, runtimes, routes, and five schedules remain byte-identical to the feature's base commit.

Use the repository Deploy Preview context with its existing public GET-only proxy. Never promote its proxy package to production. Production release requires validating the current live preserved-package baseline and then including the reviewed static additions. The historical manifest's deployment ID is not evidence of the current live deployment.

## Acceptance checks

1. Built-in game loads, starts, responds to controls, and displays live frames.
2. The same ROM selected locally plays; a renamed copy finds the same save.
3. Saving, closing/reloading, starting, and explicitly resuming restores the saved position.
4. Export/import round-trips; damaged files, different ROMs, and different engine versions fail before loading.
5. Invalid/truncated/oversized ROMs fail with useful messages.
6. Desktop and narrow layouts remain usable. Physical iPhone/iPad/Bluetooth testing remains distinct from desktop browser review.
7. Build inventory and every production file remain intact; no production function/schedule configuration changes.

## Follow-up scope

After the first milestone is reviewed: add more games with documented distribution rights, preview the lobby card linking from `/play/`, and prepare a preserved-backend static release. Shared leaderboards, rewards, cloud saves, more systems, and wallet access are separate features.
