# TREE V3 Phase A

TREE V3 Phase A provides a native, read-only SuiDex V3 workspace inside the TREE Command Center.

## Included

- Verified SUI/TREE V3 pool identity and on-chain pool object parsing.
- Current pool price, reserves, tick, liquidity units, and an explicitly labeled TVL estimate when current USD reference prices are available.
- Internal `Pools`, `My Positions`, and `Swap` views.
- Connected-wallet public position discovery through a complete Sui GraphQL scan of the verified SuiDex V3 `position::Position` type.
- Complete-only position publication. Partial scans display no positions.
- Read-only liquidity-range planning with leading-decimal input support.
- The internal Swap view routes back to the native best-route TREE swap.

## Not yet enabled

The following controls remain disabled until their exact SuiDex V3 Move calls, shared objects, coin handling, slippage behavior, simulation results, wallet signing, and finality handling are independently verified:

- Create position
- Increase liquidity
- Remove liquidity
- Collect fees
- Claim rewards
- Close position

## Analytics terminology

Pool reserves, current price, tick, and liquidity units are read from the verified Sui Mainnet pool object. The TVL figure is labeled as an estimate because it combines current on-chain reserves with external USD reference prices. Twenty-four-hour volume, fees, APR, and reward emissions are not published until a reliable source is integrated and validated.

## Verified identifiers

- SuiDex V3 package: `0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56`
- SUI/TREE V3 pool: `0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf`
- TREE coin type: `0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`
- SUI coin type: `0x2::sui::SUI`

Production remains unchanged until the stacked navigation, swap, and V3 pull requests are reviewed and explicitly approved for rollout.
