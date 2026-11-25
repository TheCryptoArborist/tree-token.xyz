// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IERC20Metadata} from '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {Policy} from './Policy.sol';
interface IBoundAdapter {
    function binder() external view returns (address);
    function endpoint() external view returns (address);
    function suiPeer() external view returns (bytes32);
    function route() external view returns (bytes32);
    function backingNFT() external view returns (bytes32);
}
/// @notice One approved original, at most one live generation. Source-only milestone.
contract TreeSuitePass is ERC721, ReentrancyGuard {
    using SafeERC20 for IERC20;
    enum State { Unconfirmed, Ready, Active, Locked, Retired }
    State public state;
    uint64 public generation; // Also the unique ERC721 token ID; never reused.
    uint256 public constant PRICE = 25 * 10**18;
    IERC20 public constant currency = IERC20(Policy.USDT);
    address public constant treasury = Policy.TREASURY;
    bytes32 public constant backingNFT = Policy.NFT;
    address public immutable adapter;
    address public immutable initialBuyer;
    address public immutable controller;
    bytes32 public immutable route;
    bytes32 public immutable currencyCodeHash;
    bytes32 public redemption;
    bytes32 public recipient;
    bool public purchasesPaused = true;
    error Invalid();
    event ReserveConfirmed(uint64 indexed generation);
    event PassPurchased(uint64 indexed generation, address indexed buyer, uint256 amount);
    event PurchasePauseChanged(bool paused);
    event RedemptionRequested(uint64 indexed generation, bytes32 indexed request, bytes32 recipient);
    event RedemptionFinalized(uint64 indexed generation, bytes32 indexed request);

    constructor(address verifier) ERC721('NFTree Suite Generation Pass', 'TREEGEN') {
        if (block.chainid != Policy.CHAIN_ID || Policy.USDT.code.length == 0 || verifier.code.length == 0 ||
            IERC20Metadata(Policy.USDT).decimals() != 18) revert Invalid();
        IBoundAdapter v = IBoundAdapter(verifier);
        if (v.binder() != msg.sender || v.endpoint() != Policy.ENDPOINT || v.suiPeer() == 0 ||
            v.route() == 0 || v.backingNFT() != backingNFT) revert Invalid();
        adapter = verifier;
        initialBuyer = msg.sender; // Private, controlled acceptance only; no public sale.
        controller = msg.sender;
        route = v.route();
        currencyCodeHash = Policy.USDT.codehash;
    }
    modifier onlyAdapter() { if (msg.sender != adapter) revert Invalid(); _; }

    function setPurchasesPaused(bool paused) external {
        if (msg.sender != controller) revert Invalid();
        purchasesPaused = paused;
        emit PurchasePauseChanged(paused);
    }
    function confirmReserve(uint64 next) external onlyAdapter {
        if (next == 0) revert Invalid();
        if (next == generation) return; // Never unlock, remint or reset a same-generation pass.
        if (next != generation + 1 || (state != State.Unconfirmed && state != State.Retired)) revert Invalid();
        generation = next;
        state = State.Ready;
        redemption = 0;
        recipient = 0;
        purchasesPaused = true; // Each generation needs separate controlled-sale review.
        emit ReserveConfirmed(next);
    }
    function buy() external nonReentrant {
        if (state != State.Ready || purchasesPaused || msg.sender != initialBuyer ||
            Policy.USDT.codehash != currencyCodeHash || IERC20Metadata(Policy.USDT).decimals() != 18) revert Invalid();
        state = State.Active;
        uint256 balance = currency.balanceOf(treasury);
        currency.safeTransferFrom(msg.sender, treasury, PRICE);
        if (currency.balanceOf(treasury) != balance + PRICE) revert Invalid();
        _safeMint(msg.sender, generation);
        emit PassPurchased(generation, msg.sender, PRICE);
    }
    function requestRedemption(bytes32 suiRecipient) external nonReentrant returns (bytes32) {
        if (state != State.Active || ownerOf(generation) != msg.sender || suiRecipient == 0) revert Invalid();
        state = State.Locked;
        recipient = suiRecipient;
        redemption = keccak256(abi.encode(uint8(3), block.chainid, address(this), route, backingNFT, generation, msg.sender, suiRecipient));
        emit RedemptionRequested(generation, redemption, suiRecipient);
        return redemption;
    }
    function acknowledge(uint64 gen, bytes32 request, bytes32 suiRecipient) external onlyAdapter nonReentrant {
        if (gen != generation || request == 0 || request != redemption || suiRecipient != recipient) revert Invalid();
        if (state == State.Retired) return;
        if (state != State.Locked) revert Invalid();
        state = State.Retired;
        _burn(generation);
        emit RedemptionFinalized(generation, request);
    }
    /// Contract-level lifecycle predicate, NOT authorization for the live Arcade.
    function canPlay(address wallet) external view returns (bool) {
        return state == State.Active && wallet != address(0) && _ownerOf(generation) == wallet;
    }
    function _update(address to, uint256 id, address auth) internal override returns (address) {
        if (id != generation || (state != State.Active && !(state == State.Retired && to == address(0)))) revert Invalid();
        return super._update(to, id, auth);
    }
}
