// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {TreeSuitePass} from './TreeSuitePass.sol';
import {Policy} from './Policy.sol';
import {ILayerZeroEndpointV2, MessagingParams, MessagingFee, MessagingReceipt, Origin} from '@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol';
import {ILayerZeroReceiver} from '@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroReceiver.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
/// @notice New immutable route. Only authenticated v3 state transitions; retries carry fixed payloads.
contract TreePassAdapter is ILayerZeroReceiver, ReentrancyGuard {
    uint32 public constant SUI_EID = Policy.SUI_EID;
    ILayerZeroEndpointV2 public constant endpoint = ILayerZeroEndpointV2(Policy.ENDPOINT);
    bytes32 public constant backingNFT = Policy.NFT;
    bytes32 public immutable suiPeer;
    bytes32 public immutable route;
    address public immutable binder;
    TreeSuitePass public pass;
    uint128 public receiveGas = 30_000_000;
    mapping(bytes32 => bytes32) public delivered;
    error Invalid();
    event PassBound(address indexed pass);
    event MessageApplied(bytes32 indexed guid, uint8 kind, uint64 generation);
    event MessageSent(bytes32 indexed guid, uint8 kind, uint64 generation);
    event ReceiveGasRaised(uint128 gas);

    constructor(bytes32 peer, bytes32 routeId) {
        if (block.chainid != Policy.CHAIN_ID || Policy.ENDPOINT.code.length == 0 || peer == 0 || routeId == 0 || endpoint.eid() != Policy.BNB_EID) revert Invalid();
        suiPeer = peer;
        route = routeId;
        binder = msg.sender;
        endpoint.setDelegate(msg.sender);
    }
    function bindPass(TreeSuitePass p) external {
        if (msg.sender != binder || address(pass) != address(0) || address(p).code.length == 0 || p.adapter() != address(this) ||
            p.route() != route || p.backingNFT() != backingNFT || address(p.currency()) != Policy.USDT ||
            p.treasury() != Policy.TREASURY || p.controller() != binder) revert Invalid();
        pass = p;
        emit PassBound(address(p));
    }
    function setReceiveGas(uint128 gas) external {
        if (msg.sender != binder || gas < receiveGas) revert Invalid();
        receiveGas = gas;
        emit ReceiveGasRaised(gas);
    }
    function receiveOptions() public view returns (bytes memory) {
        return abi.encodePacked(uint16(3), uint8(1), uint16(17), uint8(1), receiveGas);
    }
    function allowInitializePath(Origin calldata origin) external view returns (bool) {
        return origin.srcEid == SUI_EID && origin.sender == suiPeer && address(pass) != address(0);
    }
    function nextNonce(uint32, bytes32) external pure returns (uint64) { return 0; }

    function lzReceive(Origin calldata origin, bytes32 guid, bytes calldata message, address, bytes calldata) external payable nonReentrant {
        if (msg.sender != address(endpoint) || origin.srcEid != SUI_EID || origin.sender != suiPeer ||
            address(pass) == address(0) || guid == 0 || origin.nonce == 0 || msg.value != 0) revert Invalid();
        if (message.length != 138 || uint8(message[0]) != 3) revert Invalid();
        uint8 kind = uint8(message[1]);
        bytes32 r = bytes32(message[2:34]);
        bytes32 nft = bytes32(message[34:66]);
        uint64 gen = uint64(bytes8(message[66:74]));
        bytes32 req = bytes32(message[74:106]);
        bytes32 to = bytes32(message[106:138]);
        if (r != route || nft != backingNFT || gen == 0) revert Invalid();
        bytes32 hash = keccak256(message);
        if (delivered[guid] != 0 && delivered[guid] != hash) revert Invalid();
        // Always validate lifecycle, even on GUID retries: stale deliveries must
        // not bypass the generation check after a new allocation.
        if (kind == 1) {
            if (req != 0 || to != 0) revert Invalid();
            pass.confirmReserve(gen);
        } else if (kind == 3) {
            pass.acknowledge(gen, req, to);
        } else revert Invalid();
        delivered[guid] = hash;
        emit MessageApplied(guid, kind, gen);
    }
    function outboundPayload(uint8 kind) public view returns (bytes memory) {
        if (address(pass) == address(0)) revert Invalid();
        if (kind == 2) {
            if (pass.state() != TreeSuitePass.State.Locked) revert Invalid();
        } else if (kind == 4) {
            if (pass.state() != TreeSuitePass.State.Retired) revert Invalid();
        } else revert Invalid();
        return abi.encodePacked(uint8(3), kind, route, backingNFT, pass.generation(), pass.redemption(), pass.recipient());
    }
    function quote(uint8 kind) external view returns (MessagingFee memory) {
        MessagingFee memory fee = endpoint.quote(MessagingParams(SUI_EID, suiPeer, outboundPayload(kind), receiveOptions(), false), address(this));
        if (fee.nativeFee == 0 || fee.lzTokenFee != 0) revert Invalid();
        return fee;
    }
    /// Permissionless fee sponsorship/retry; callers cannot choose request, recipient, route or generation.
    function send(uint8 kind) external payable nonReentrant returns (MessagingReceipt memory receipt) {
        MessagingParams memory params = MessagingParams(SUI_EID, suiPeer, outboundPayload(kind), receiveOptions(), false);
        MessagingFee memory fee = endpoint.quote(params, address(this));
        if (fee.nativeFee == 0 || fee.lzTokenFee != 0 || msg.value != fee.nativeFee) revert Invalid();
        receipt = endpoint.send{value: msg.value}(params, msg.sender);
        if (receipt.guid == 0 || receipt.nonce == 0 || receipt.fee.lzTokenFee != 0 || receipt.fee.nativeFee > msg.value) revert Invalid();
        emit MessageSent(receipt.guid, kind, pass.generation());
    }
}
