// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {TreeSuitePass} from './TreeSuitePass.sol';
import {Policy} from './Policy.sol';
import {ILayerZeroEndpointV2,MessagingParams,MessagingFee,MessagingReceipt,Origin} from '@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol';
import {ILayerZeroReceiver} from '@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroReceiver.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
/// @notice Immutable original-NFT assignment and endpoint/peer authentication; wire v2 only.
contract TreePassAdapter is ILayerZeroReceiver,ReentrancyGuard {
    uint32 public constant SUI_EID=Policy.SUI_EID;
    ILayerZeroEndpointV2 public constant endpoint=ILayerZeroEndpointV2(Policy.ENDPOINT);
    bytes32 public constant backingNFT=Policy.NFT;
    bytes32 public immutable suiPeer;
    bytes32 public immutable route;
    address public immutable binder;
    TreeSuitePass public pass;
    uint128 public redemptionGas=30_000_000;
    bool public redemptionSent;
    bytes32 public redemptionGuid;
    mapping(bytes32=>bytes32) public delivered;
    error Invalid();
    event PassBound(address indexed pass);
    event MessageApplied(bytes32 indexed guid,uint8 kind);
    event RedemptionSent(bytes32 indexed guid,bytes32 indexed request);
    event RedemptionGasRaised(uint128 gas);
    constructor(bytes32 peer,bytes32 routeId){
        if(block.chainid!=Policy.CHAIN_ID||Policy.ENDPOINT.code.length==0||peer==0||routeId==0||endpoint.eid()!=Policy.BNB_EID)revert Invalid();
        suiPeer=peer;route=routeId;binder=msg.sender;endpoint.setDelegate(msg.sender);
    }
    function bindPass(TreeSuitePass p) external {
        if(msg.sender!=binder||address(pass)!=address(0)||address(p).code.length==0||p.adapter()!=address(this)||
           p.route()!=route||p.backingNFT()!=backingNFT||address(p.currency())!=Policy.USDT||p.treasury()!=Policy.TREASURY||p.controller()!=binder)revert Invalid();
        pass=p;emit PassBound(address(p));
    }
    function setRedemptionGas(uint128 gas) external {
        if(msg.sender!=binder||gas<redemptionGas||redemptionSent)revert Invalid();redemptionGas=gas;emit RedemptionGasRaised(gas);
    }
    function redemptionOptions() public view returns(bytes memory){return abi.encodePacked(uint16(3),uint8(1),uint16(17),uint8(1),redemptionGas);}
    function allowInitializePath(Origin calldata origin) external view returns(bool){return origin.srcEid==SUI_EID&&origin.sender==suiPeer&&address(pass)!=address(0);}
    function nextNonce(uint32,bytes32) external pure returns(uint64){return 0;}
    function lzReceive(Origin calldata origin,bytes32 guid,bytes calldata message,address,bytes calldata) external payable nonReentrant {
        if(msg.sender!=address(endpoint)||origin.srcEid!=SUI_EID||origin.sender!=suiPeer||address(pass)==address(0)||guid==0||msg.value!=0)revert Invalid();
        if(message.length!=130||uint8(message[0])!=2)revert Invalid();
        uint8 kind=uint8(message[1]);
        bytes32 r=bytes32(message[2:34]);bytes32 nft=bytes32(message[34:66]);bytes32 req=bytes32(message[66:98]);bytes32 to=bytes32(message[98:130]);
        if(r!=route||nft!=backingNFT||(kind==1?origin.nonce!=1:kind==3?origin.nonce!=2:true))revert Invalid();
        bytes32 hash=keccak256(message);
        if(delivered[guid]!=0){if(delivered[guid]!=hash)revert Invalid();return;}
        if(kind==1){if(req!=0||to!=0)revert Invalid();pass.confirmReserve(r,nft);}
        else if(kind==3){pass.acknowledge(r,nft,req,to);}else revert Invalid();
        delivered[guid]=hash;emit MessageApplied(guid,kind);
    }
    function redemptionPayload() public view returns(bytes memory){
        if(address(pass)==address(0)||pass.state()!=TreeSuitePass.State.Locked)revert Invalid();
        return abi.encodePacked(uint8(2),uint8(2),route,backingNFT,pass.redemption(),pass.recipient());
    }
    function quoteRedemption() external view returns(MessagingFee memory){
        if(redemptionSent)revert Invalid();
        MessagingFee memory fee=endpoint.quote(MessagingParams(SUI_EID,suiPeer,redemptionPayload(),redemptionOptions(),false),address(this));
        if(fee.nativeFee==0||fee.lzTokenFee!=0)revert Invalid();return fee;
    }
    /// Anyone may pay the exact current quote; payload, target and minimum gas cannot be substituted.
    function sendRedemption() external payable nonReentrant returns(MessagingReceipt memory receipt){
        if(redemptionSent)revert Invalid();
        MessagingParams memory params=MessagingParams(SUI_EID,suiPeer,redemptionPayload(),redemptionOptions(),false);
        MessagingFee memory fee=endpoint.quote(params,address(this));
        if(fee.nativeFee==0||fee.lzTokenFee!=0||msg.value!=fee.nativeFee)revert Invalid();
        redemptionSent=true;
        receipt=endpoint.send{value:msg.value}(params,msg.sender);
        if(receipt.guid==0||receipt.nonce!=1||receipt.fee.lzTokenFee!=0||receipt.fee.nativeFee>msg.value)revert Invalid();
        redemptionGuid=receipt.guid;emit RedemptionSent(receipt.guid,pass.redemption());
    }
}
