# BNB wallet-link and checkout review controls

November 24, 2026 (America/Chicago). Undeployed source component; no live route.

`browser/bnb-checkout-review.mjs` exports a state controller and DOM mount function.
The user requests a message, reads it, explicitly signs with the Sui wallet,
explicitly signs with the BNB wallet, then verifies the link and reviews terms.
There is no transaction send, token approval, payment or game restoration action.
The proposed continue costs 1 USDT on BNB; existing Sui owners do not deposit their
NFT or acquire another backed pass to use this payment option.

The controller reconstructs the exact server link format against the expected
native context, including the hashed bearer, mapped account/run, sequence,
wallets, v2 delivery protocol, nonce and expiry. It checks context before and
after asynchronous operations. Signature cancellation needs an explicit retry;
no second wallet opens automatically. An unknown verification outcome blocks
repeat submission in that controller. Signatures remain memory-only and are
cleared after verification or teardown. Errors never display wallet/provider text.
Review terms require the fixed token, treasury, amount and no-activation flags.

## Host integration contract (still pending)

Supply `createNativeContinueTransport` and a `getContext()` snapshot containing:
`sessionToken`, `suiWallet`, lowercase `payer`, mapped `accountId`, mapped `runId`,
`sequence`, `chainId:56`, `network:'sui:mainnet'`, nonempty `epoch`, and native
session `expiresAt` in milliseconds. Account/run/sequence must come from the
reviewed authenticated native binding, not user input or parsed untrusted link
text. Supplying that authenticated context to the UI remains host integration
work; this component does not introduce a context endpoint.

The host must increment epoch on wallet/network/session changes (including
switching away and back). The two injected adapters are personal-message-only:

- `signSuiMessage({address,message:Uint8Array})` returns a serialized signature.
- `signBnbMessage({address,message:string,chainId:56})` returns a 65-byte hex signature.

Adapters must select/check the requested account and reject mismatches. Do not
substitute transaction signing, `eth_sign`, token approval or transaction sending.
Existing wallet integrations/dependencies are preserved; no SDK upgrade or new
wallet discovery mechanism was introduced. Server verification remains decisive.

`mountBnbCheckoutReview({root,review})` renders text with textContent, four buttons,
a live status region and busy-state guards. Call destroy on teardown. The host
must connect its existing wallet controls and canonical session transport; this
component is not mounted into the published game or a separate preview site.

## Evidence and setup

Current MystenLabs skills README and `frontend-apps/SKILL.md`, `transactions.md`
(personal message signing) and `non-react.md` were consulted. Existing dependency
locks remain unchanged. Signing adapters follow the Uint8Array/personal-message
boundary; no actual extension was exercised.

```sh
node --test tests/multichain-bnb-checkout-review.test.mjs tests/multichain-native-host.test.mjs tests/multichain-native-composition.test.mjs
CHROMIUM_PATH=/usr/bin/chromium node scripts/multichain/check-bnb-checkout-review-browser.mjs
```

Use the existing pinned `vendor/continue-browser-test` Playwright dependency and
installed Chromium. Results: 50 unit tests (nine new review-controller tests) and
six Chromium checks passed. Browser tests run the real DOM/controller with
injected wallet/endpoint fixtures. All browser requests are intercepted under a
canonical `/play/` test URL; no live page, wallet or chain is contacted. Evidence:
`bnb-review-ui-tests.json`. CI runs both new test files.

Remaining: authenticated mapped-context delivery, actual wallet adapter wiring
and E2E, pending-payment journal/cross-payment coordination, expired-session
reconciliation, trusted checkpoint production source, and reviewed deployment.
A successful review does not authorize payment or gameplay. Each original NFT's
identity, individual artwork and global one-to-one custody allocation remain
separate inventory/contract launch gates.
