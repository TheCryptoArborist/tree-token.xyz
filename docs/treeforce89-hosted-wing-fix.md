# Hosted Arborwing firing correction

The owner approved correction `a7c1dca` and requested the next step: update the existing canonical graphics review, preserving the main game. Review: https://tree-token.xyz/play/treeforce89/review/arborwing/ .

Fresh read-only audit [46057383579](https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/46057383579) verified baseline `6b0799296da7108e51b1778b`, 828 static paths, 62 full backend records and five schedules. The r22 candidate changes the review HTML and adds three cycle-linked game modules plus the mount helper; artwork and all other files are reused. Expected result: 832 static paths, 827 prior paths byte-identical, one review entry changed. The main-game entry is unchanged.

38 preservation/source guards passed. Source comparison proves the only engine behavior changes are the reviewed glider mount coordinates and foreground projectile drawing depth. Wallet/API code is identical after module-name normalization. The earlier 50-case firing test verified counts, speed, damage, piercing and hitbox sizes; initial projectile paths intentionally change with the launch points.

Packaged browser checks at 390×844 and 1440×900 passed: actual mount method resolves all five new glider anchors, NFTree/wallet gate remains, expected canvas buffers, thirteen badges and no page errors/overflow. Browser automation blocks writes and makes no payment/signature. The release workflow repeats these checks against the exact candidate before publication and the canonical URL afterward, preserving complete backend/runtime and protected configuration.

This is a review update, not a main-game release. Owner assessment of firing appearance and device smoothness remains necessary.
