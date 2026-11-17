# Visible wallet connection control

The registration page previously rendered Connect buttons only for wallets already detected by dApp Kit. With no registered wallet, the connection area contained instructions but no Connect control. It now always shows Connect wallet and an Open in Slush mobile link.

Connect wallet connects only after an explicit click when one wallet is detected. Multiple wallets require an explicit choice. With no wallet detected it shows extension-permission/unlock help and a reload action. Late wallet registration updates the choices automatically. Opening this page or opening the wallet chooser never signs a transaction.

This fixes the missing control; it cannot install or unlock a user's extension, grant extension site access, or prove that their personal Slush connection succeeds. The user's wallet connection and signed receipt remain the final integration evidence.

Reviewed current MystenLabs/skills README, frontend-apps/SKILL.md and frontend-apps/non-react.md. Existing dApp Kit stores/actions and bundled wallet integration are reused. No registration transaction or contract configuration changes.

Publication replaces only the registration index.html and app.js, pinned by their exact previous SHA1 values in registration-connect-baseline.json. Baseline deploy: 6afba93401d3403c0850c7a6. Preserve all other files, 49 function packages, five schedules and configuration. Tests cover absent/late/multiple wallet detection, explicit connection without signing, and the existing registration/preservation suite.
