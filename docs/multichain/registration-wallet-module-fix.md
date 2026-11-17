# Production wallet module delivery

Live verification found `/play/multichaintest/wallet-vendor.js` returned 404. The feature-preview builder included it, so preview tests did not expose the missing canonical production dependency. The registration app's static import could not initialize the wallet controls.

The registration page now carries its own unchanged wallet-vendor.js alongside app.js and core.js. The app imports `./wallet-vendor.js`. The preservation publisher adds that explicit asset and replaces only the pinned registration HTML/app.js against baseline 6afbabbe403a66af1c3147e8. All other site files, function records, schedules and configuration remain protected.

Verify all three module assets from the canonical domain, then click Connect wallet in the live browser and confirm the detection/help controller responds. Missing-wallet status is expected in the cloud browser; the user's Slush connection is not assumed tested.
