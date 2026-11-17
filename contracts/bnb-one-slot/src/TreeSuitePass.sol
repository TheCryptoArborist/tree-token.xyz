// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IERC20Metadata} from '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {Base64} from '@openzeppelin/contracts/utils/Base64.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';
import {Policy} from './Policy.sol';
interface IBoundAdapter {
    function binder() external view returns(address);
    function endpoint() external view returns(address);
    function suiPeer() external view returns(bytes32);
    function route() external view returns(bytes32);
    function backingNFT() external view returns(bytes32);
}
/// @notice One transferable suite entitlement, admitted only after an authenticated original-NFT reserve.
/// @dev No public sale, timeout unlock, arbitrary burn or second mint. Route security is a separate check.
contract TreeSuitePass is ERC721, ReentrancyGuard {
    using SafeERC20 for IERC20;
    enum State { Unconfirmed, Ready, Active, Locked, Retired }
    State public state;
    uint256 public constant PRICE = 25 * 10**18;
    uint256 public constant TOKEN_ID = 1;
    IERC20 public constant currency = IERC20(Policy.USDT);
    address public constant treasury = Policy.TREASURY;
    bytes32 public constant backingNFT = Policy.NFT;
    address public immutable adapter;
    address public immutable initialBuyer;
    address public immutable controller;
    bytes32 public immutable route;
    bytes32 public redemption;
    bytes32 public recipient;
    bool public purchasesPaused = true;
    error Invalid();
    event ReserveConfirmed(bytes32 indexed route, bytes32 indexed nft);
    event PassPurchased(address indexed buyer, uint256 amount);
    event PurchasePauseChanged(bool paused);
    event RedemptionRequested(bytes32 indexed request, bytes32 indexed nft, bytes32 recipient);
    event RedemptionFinalized(bytes32 indexed request);
    constructor(address verifier) ERC721('NFTree Suite Pass - One NFT Trial','TREEPASS1') {
        if(block.chainid!=Policy.CHAIN_ID || Policy.USDT.code.length==0 || verifier.code.length==0 ||
           IERC20Metadata(Policy.USDT).decimals()!=18) revert Invalid();
        IBoundAdapter v=IBoundAdapter(verifier);
        if(v.binder()!=msg.sender || v.endpoint()!=Policy.ENDPOINT || v.suiPeer()==0 ||
           v.route()==0 || v.backingNFT()!=backingNFT) revert Invalid();
        adapter=verifier;initialBuyer=msg.sender;controller=msg.sender;route=v.route();
    }
    modifier onlyAdapter(){if(msg.sender!=adapter)revert Invalid();_;}
    function setPurchasesPaused(bool paused) external {
        if(msg.sender!=controller)revert Invalid();purchasesPaused=paused;emit PurchasePauseChanged(paused);
    }
    function confirmReserve(bytes32 sourceRoute,bytes32 nft) external onlyAdapter {
        if(sourceRoute!=route||nft!=backingNFT)revert Invalid();
        if(state!=State.Unconfirmed)return;
        state=State.Ready;emit ReserveConfirmed(route,nft);
    }
    function buy() external nonReentrant {
        if(state!=State.Ready||purchasesPaused||msg.sender!=initialBuyer)revert Invalid();
        state=State.Active;
        uint256 balance=currency.balanceOf(treasury);
        currency.safeTransferFrom(msg.sender,treasury,PRICE);
        if(currency.balanceOf(treasury)!=balance+PRICE)revert Invalid();
        _safeMint(msg.sender,TOKEN_ID);emit PassPurchased(msg.sender,PRICE);
    }
    function requestRedemption(bytes32 suiRecipient) external nonReentrant returns(bytes32) {
        if(state!=State.Active||ownerOf(TOKEN_ID)!=msg.sender||suiRecipient==0)revert Invalid();
        state=State.Locked;recipient=suiRecipient;
        redemption=keccak256(abi.encode(uint8(2),block.chainid,address(this),route,backingNFT,TOKEN_ID,msg.sender,suiRecipient));
        emit RedemptionRequested(redemption,backingNFT,suiRecipient);return redemption;
    }
    function acknowledge(bytes32 sourceRoute,bytes32 nft,bytes32 request,bytes32 suiRecipient) external onlyAdapter nonReentrant {
        if(sourceRoute!=route||nft!=backingNFT||request==0||request!=redemption||suiRecipient!=recipient)revert Invalid();
        if(state==State.Retired)return;
        if(state!=State.Locked)revert Invalid();
        state=State.Retired;_burn(TOKEN_ID);emit RedemptionFinalized(request);
    }
    function canPlay(address wallet) external view returns(bool){return state==State.Active&&_ownerOf(TOKEN_ID)==wallet;}
    function tokenURI(uint256 tokenId) public view override returns(string memory){
        _requireOwned(tokenId);
        return string.concat('data:application/json;base64,',Base64.encode(bytes(string.concat(
            '{"name":"Tree Arcade Suite Pass - NFTree 2720","description":"Transferable suite access backed by original Sui NFTree 2720. Redemption locks this pass until authenticated release and retirement.",',
            '"image":"https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeieozgvnr7qc4ghsq36zwssuhj7xahuznjlmu6g63clnyt37hjsi4m/2720.jpg",',
            '"external_url":"https://tree-token.xyz/play/","backing_chain":"sui:mainnet","backing_nft":"',Strings.toHexString(uint256(backingNFT),32),
            '","route":"',Strings.toHexString(uint256(route),32),'"}'
        ))));
    }
    function _update(address to,uint256 id,address auth) internal override returns(address){
        if(state!=State.Active&&!(state==State.Retired&&to==address(0)))revert Invalid();
        return super._update(to,id,auth);
    }
}
