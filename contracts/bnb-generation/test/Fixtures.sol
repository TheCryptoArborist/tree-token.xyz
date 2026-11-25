// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {IERC721Receiver} from '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import {Origin,MessagingParams,MessagingFee,MessagingReceipt} from '@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol';
interface IReceiver {function lzReceive(Origin calldata,bytes32,bytes calldata,address,bytes calldata) external payable;}
contract FixtureUSDT is ERC20 {
 uint8 public mode; bool public reentrySucceeded;
 constructor() ERC20('Fixture USDT','FUSDT'){}
 function mint(address to,uint256 amount)external {_mint(to,amount);}
 function setMode(uint8 m)external {mode=m;}
 function transferFrom(address from,address to,uint256 amount)public override returns(bool){
  if(mode==1)return false;
  if(mode==4){(reentrySucceeded,)=msg.sender.call(abi.encodeWithSignature('buy()'));}
  bool ok=super.transferFrom(from,to,amount);
  if(mode==3){assembly{return(0,0)}}return ok;
 }
 function _update(address from,address to,uint256 value)internal override {
  if(mode==2&&from!=address(0)&&to!=address(0)&&value>1){super._update(from,address(0xdead),1);super._update(from,to,value-1);}
  else super._update(from,to,value);
 }
}
contract SixDecimals {function decimals()external pure returns(uint8){return 6;}}
contract FixtureEndpoint {
 uint32 public constant eid=30102;
 mapping(address=>address)public delegates;
 uint64 public nonce;bool public failSend;bool public lzFee;bool public badReceipt;
 bytes public lastMessage;bytes public lastOptions;bytes32 public lastPeer;uint32 public lastEid;address public lastRefund;
 function setDelegate(address d)external {delegates[msg.sender]=d;}
 function configure(bool fail,bool tokenFee,bool bad)external {failSend=fail;lzFee=tokenFee;badReceipt=bad;}
 function quote(MessagingParams calldata,address)external view returns(MessagingFee memory){return MessagingFee(1,lzFee?1:0);}
 function send(MessagingParams calldata p,address refund)external payable returns(MessagingReceipt memory){
  require(!failSend&&msg.value==1);nonce++;lastMessage=p.message;lastOptions=p.options;lastPeer=p.receiver;lastEid=p.dstEid;lastRefund=refund;
  return MessagingReceipt(badReceipt?bytes32(0):keccak256(abi.encode(msg.sender,nonce)),nonce,MessagingFee(1,0));
 }
 function deliver(address to,Origin calldata origin,bytes32 guid,bytes calldata message)external payable {IReceiver(to).lzReceive{value:msg.value}(origin,guid,message,address(0),'');}
}
contract FixtureReceiver is IERC721Receiver {
 bool public reject;
 function setReject(bool r)external {reject=r;}
 function onERC721Received(address,address,uint256,bytes calldata)external view returns(bytes4){require(!reject);return IERC721Receiver.onERC721Received.selector;}
}

import {TreeSuitePass} from '../src/TreeSuitePass.sol';
import {TreePassAdapter} from '../src/TreePassAdapter.sol';
contract FixtureBuyer is IERC721Receiver {
 TreePassAdapter public adapter;
 TreeSuitePass public pass;
 bool public reject;
 bool public reentrySucceeded;
 function setup(bytes32 peer,bytes32 route)external {
  require(address(pass)==address(0));adapter=new TreePassAdapter(peer,route);pass=new TreeSuitePass(address(adapter));adapter.bindPass(pass);
 }
 function buy(bool refuse)external {
  reject=refuse;pass.setPurchasesPaused(false);FixtureUSDT(address(pass.currency())).approve(address(pass),pass.PRICE());pass.buy();
 }
 function onERC721Received(address,address,uint256,bytes calldata)external returns(bytes4){
  require(!reject);(reentrySucceeded,)=address(pass).call(abi.encodeWithSignature('requestRedemption(bytes32)',bytes32(uint256(1))));
  return IERC721Receiver.onERC721Received.selector;
 }
}
