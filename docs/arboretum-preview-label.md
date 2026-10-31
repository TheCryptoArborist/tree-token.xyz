# Arboretum preview label

The owner clarified that Arboretum does not currently offer a playable test game and is still being prepared for its final release. Its arcade poster now uses **PREVIEW** as the status and **VIEW PREVIEW** as the action. The existing preview status styling is reused. The lineup note and Open Graph description now refer to previews instead of test versions.

The link remains `https://treegrow.xyz/`. The game's description, artwork, position, and all other posters remain unchanged. The eight-poster layout still groups TREE FORCE ’89, Arboretum, and two future standalone slots above the four Garden Battles modes. TREE FORCE ’89 retains its red LIVE label.

## Release scope

Only `/play/index.html` changes from locked baseline `6ae621b628540d6446e7ad84`. The bounded release preserves all 232 public paths, the other 231 static files, all 39 complete function records, five schedules, the runtime context and isolated game database binding, enabled paid continues, and the publication lock. No stylesheet, backend, wallet, dependency, or migration changes are included.

Source branch: `feature/arboretum-preview-label-20261031`. The current MystenLabs/skills README remains blob `8be2c5d51d94c953a007e286f63df38372faa8d0`. The diff and release script syntax passed. The exact candidate received a focused browser check: the preview badge and VIEW PREVIEW action render correctly, the existing destination is preserved, the desktop grid remains four columns, and no horizontal overflow is present. No new automated tests were added for this small copy correction.

## Published release

Source `5c7e407a487d6283a7400459afe532d2123a440a` was published as locked deployment `6ae630e786bec27734f72e9e` on October 31, 2026 at 1:19:20 p.m. CDT (`2026-10-31T18:19:20.833Z`). The release verified all 232 public paths, the other 231 static files unchanged, all 39 complete backend function records, all five schedules, runtime/database settings, enabled paid continues, no migrations, and the publication lock.

The canonical arcade page was checked after publication. Arboretum displays PREVIEW and VIEW PREVIEW, its link remains `https://treegrow.xyz/`, and no test-version wording remains in the visible page. Eight posters remain in the existing groups, and TREE FORCE ’89 retains its red LIVE badge. The complete release record is in `arboretum-preview-label-published.json`; the live screenshot is `review/arboretum-preview-label-live-6ae630e7.jpg`.
