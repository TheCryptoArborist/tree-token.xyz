/// One-shot original-NFT custody. No withdrawal, reset, second slot or arbitrary payload sender.
module nftree_one_slot::vault;
use std::type_name;
use nftree_one_slot::codec;
use call::{call::{Call, Void}, call_cap::CallCap};
use endpoint_v2::{endpoint_v2::EndpointV2, messaging_channel::MessagingChannel,
    lz_receive::LzReceiveParam, endpoint_send::SendParam, endpoint_quote::QuoteParam,
    messaging_receipt::MessagingReceipt, messaging_fee::MessagingFee};
use oapp::oapp::{Self, OApp, AdminCap as OAppAdminCap};
use utils::bytes32::{Self, Bytes32};
use sui::{event, coin::Coin, sui::SUI};
const VERSION: u64 = 1;
const BNB_EID: u32 = 30102;
const CANDIDATE: address = @0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba;
const DEV: address = @0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4;
const NFT_TYPE: vector<u8> = b"f6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT";
const ENotAuthorized: u64 = 1;
const EWrongType: u64 = 2;
const ESlotUsed: u64 = 3;
const EWrongBacking: u64 = 4;
const EWrongState: u64 = 5;
const EWrongApp: u64 = 6;
const EWrongPeer: u64 = 7;
const EInvalidMessage: u64 = 8;
const EReplay: u64 = 9;
const EPaused: u64 = 10;
const EVersion: u64 = 11;
const EExecutionOptions: u64 = 12;
const MIN_OPTIONS: vector<u8> = x"00030100110100000000000000000000000000030d40";
public struct VAULT has drop {}
public struct AdminCap has key { id: UID, registry: ID }
public struct Registry has key {
    id: UID, version: u64, cap: Option<CallCap>, oapp: address,
    slot: Option<ID>, backing: address, nft_type: vector<u8>,
}
public struct Vault<T: key + store> has key {
    id: UID, version: u64, registry: ID, cap: CallCap, oapp: address,
    nft: Option<T>, backing: Bytes32, route: Bytes32, peer: Bytes32,
    bound: bool, paused: bool, phase: u8, announced: bool, ack_sent: bool, request: Bytes32, recipient: Bytes32,
}
public struct SlotCreated has copy, drop { registry: ID, vault: ID, nft: Bytes32 }
public struct Funded has copy, drop { vault: ID, nft: Bytes32 }
public struct Bound has copy, drop { vault: ID, peer: Bytes32 }
public struct PauseChanged has copy, drop { vault: ID, paused: bool }
public struct Released has copy, drop { vault: ID, request: Bytes32, recipient: Bytes32 }
fun init(otw: VAULT, ctx: &mut TxContext) {
    assert!(ctx.sender() == DEV, ENotAuthorized);
    let (cap, oapp_admin, oapp) = oapp::new(&otw, ctx);
    let registry = new_registry(cap, oapp, CANDIDATE, NFT_TYPE, ctx);
    let admin = AdminCap { id: object::new(ctx), registry: object::id(&registry) };
    transfer::public_transfer(oapp_admin, ctx.sender());
    transfer::transfer(admin, ctx.sender()); transfer::share_object(registry);
}
fun new_registry(cap: CallCap, oapp: address, backing: address, nft_type: vector<u8>, ctx: &mut TxContext): Registry {
    Registry { id: object::new(ctx), version: VERSION, cap: option::some(cap), oapp,
        slot: option::none(), backing, nft_type }
}
fun registry_admin(registry: &Registry, admin: &AdminCap) {
    assert!(registry.version == VERSION, EVersion);
    assert!(admin.registry == object::id(registry), ENotAuthorized)
}
fun vault_admin<T: key + store>(vault: &Vault<T>, admin: &AdminCap) {
    assert!(vault.version == VERSION, EVersion);
    assert!(admin.registry == vault.registry, ENotAuthorized)
}
public fun create_slot<T: key + store>(registry: &mut Registry, admin: &AdminCap, ctx: &mut TxContext) {
    registry_admin(registry, admin);
    assert!(type_name::with_original_ids<T>().into_string().into_bytes() == registry.nft_type, EWrongType);
    assert!(registry.slot.is_none() && registry.cap.is_some(), ESlotUsed);
    let id = object::new(ctx); let vault_id = id.to_inner();
    let vault = Vault<T> { id, version: VERSION, registry: object::id(registry), cap: registry.cap.extract(),
        oapp: registry.oapp, nft: option::none(), backing: bytes32::from_address(registry.backing),
        route: bytes32::from_id(vault_id), peer: bytes32::zero_bytes32(), bound: false,
        paused: false, phase: 0, announced: false, ack_sent: false, request: bytes32::zero_bytes32(), recipient: bytes32::zero_bytes32() };
    registry.slot.fill(vault_id);
    event::emit(SlotCreated { registry: object::id(registry), vault: vault_id, nft: vault.backing });
    transfer::share_object(vault);
}
public fun fund<T: key + store>(vault: &mut Vault<T>, admin: &AdminCap, nft: T) {
    vault_admin(vault, admin); assert!(!vault.paused, EPaused);
    assert!(vault.phase == 0 && vault.nft.is_none() && vault.bound, EWrongState);
    assert!(bytes32::from_id(object::id(&nft)) == vault.backing, EWrongBacking);
    vault.nft.fill(nft); vault.phase = 1;
    event::emit(Funded { vault: object::id(vault), nft: vault.backing });
}
public fun set_paused<T: key + store>(vault: &mut Vault<T>, admin: &AdminCap, paused: bool) {
    vault_admin(vault, admin); vault.paused = paused;
    event::emit(PauseChanged { vault: object::id(vault), paused });
}
public fun register<T: key + store>(vault: &Vault<T>, admin: &AdminCap, endpoint: &mut EndpointV2, info: vector<u8>, ctx: &mut TxContext): address {
    vault_admin(vault, admin); endpoint.register_oapp(&vault.cap, info, ctx)
}
public fun bind<T: key + store>(vault: &mut Vault<T>, admin: &AdminCap, oapp: &mut OApp, oapp_admin: &OAppAdminCap,
    endpoint: &EndpointV2, channel: &mut MessagingChannel, peer: Bytes32, ctx: &mut TxContext) {
    vault_admin(vault, admin); assert!(!vault.bound && vault.phase == 0, EWrongState);
    assert!(object::id_address(oapp) == vault.oapp && !peer.is_zero(), EWrongApp);
    oapp.set_peer(oapp_admin, endpoint, channel, BNB_EID, peer, ctx);
    oapp.set_enforced_options(oapp_admin, BNB_EID, 1, MIN_OPTIONS);
    oapp.set_enforced_options(oapp_admin, BNB_EID, 3, MIN_OPTIONS);
    vault.peer = peer; vault.bound = true;
    event::emit(Bound { vault: object::id(vault), peer });
}
fun validate<T: key + store>(vault: &Vault<T>, oapp: &OApp) {
    assert!(vault.version == VERSION, EVersion);
    assert!(object::id_address(oapp) == vault.oapp, EWrongApp);
    assert!(vault.bound && oapp.get_peer(BNB_EID) == vault.peer, EWrongPeer);
}
public fun lz_receive<T: key + store>(vault: &mut Vault<T>, oapp: &OApp, call: Call<LzReceiveParam, Void>) {
    validate(vault, oapp); let param = oapp.lz_receive(&vault.cap, call);
    let (src, sender, _, _, message, _, _, value) = param.destroy();
    assert!(src == BNB_EID && sender == vault.peer && value.is_none(), EWrongPeer);
    value.destroy_none(); process(vault, &message);
}
fun process<T: key + store>(vault: &mut Vault<T>, message: &vector<u8>) {
    let (kind, route, nft, request, recipient) = codec::decode(message);
    assert!(kind == 2 && route == vault.route && nft == vault.backing, EInvalidMessage);
    assert!(vault.announced, EWrongState);
    assert!(!request.is_zero() && !recipient.is_zero(), EInvalidMessage);
    if (vault.phase == 2) {
        assert!(request == vault.request && recipient == vault.recipient, EReplay);
    } else {
        assert!(vault.phase == 1 && vault.nft.is_some(), EWrongState);
        vault.phase = 2; vault.request = request; vault.recipient = recipient;
        transfer::public_transfer(vault.nft.extract(), recipient.to_address());
    };
    event::emit(Released { vault: object::id(vault), request, recipient });
}
fun payload<T: key + store>(vault: &Vault<T>, kind: u8): vector<u8> {
    if (kind == 1) {
        assert!(!vault.paused, EPaused);
        assert!(vault.phase == 1 && vault.nft.is_some() && !vault.announced, EWrongState);
        codec::encode(1, vault.route, vault.backing, bytes32::zero_bytes32(), bytes32::zero_bytes32())
    } else {
        assert!(kind == 3 && vault.phase == 2 && vault.nft.is_none() && !vault.ack_sent, EWrongState);
        codec::encode(3, vault.route, vault.backing, vault.request, vault.recipient)
    }
}
fun execution_options(oapp: &OApp, kind: u8, extras: vector<u8>): vector<u8> {
    let msg_type = if (kind == 1) { 1u16 } else { 3u16 };
    assert!(oapp.combine_options(BNB_EID, msg_type, vector[]).length() > 2, EExecutionOptions);
    let combined = oapp.combine_options(BNB_EID, msg_type, extras);
    // The BNB receiver accepts no native value. Restrict every merged option,
    // including admin policy, before a permissionless one-shot send is consumed.
    assert!(combined.length() >= 22 && combined[0] == 0 && combined[1] == 3, EExecutionOptions);
    let mut offset = 2;
    let mut total_gas = 0u128;
    while (offset < combined.length()) {
        assert!(offset + 4 <= combined.length(), EExecutionOptions);
        let size = (combined[offset + 1] as u64) * 256 + (combined[offset + 2] as u64);
        assert!(combined[offset] == 1 && combined[offset + 3] == 1, EExecutionOptions);
        assert!((size == 17 || size == 33) && offset + 3 + size <= combined.length(), EExecutionOptions);
        let mut gas = 0u128;
        let mut i = 0;
        while (i < 16) {
            gas = (gas << 8) | (combined[offset + 4 + i] as u128);
            if (size == 33) { assert!(combined[offset + 20 + i] == 0, EExecutionOptions) };
            i = i + 1;
        };
        total_gas = total_gas + gas;
        offset = offset + 3 + size;
    };
    assert!(total_gas >= 200_000, EExecutionOptions);
    combined
}
public fun quote<T: key + store>(vault: &Vault<T>, oapp: &OApp, kind: u8, options: vector<u8>, ctx: &mut TxContext): Call<QuoteParam, MessagingFee> {
    validate(vault, oapp); let message = payload(vault, kind); let options = execution_options(oapp, kind, options);
    oapp.quote(&vault.cap, BNB_EID, message, options, false, ctx)
}
public fun send<T: key + store>(vault: &mut Vault<T>, oapp: &mut OApp, kind: u8, options: vector<u8>, fee: Coin<SUI>, ctx: &mut TxContext): Call<SendParam, MessagingReceipt> {
    validate(vault, oapp); let message = payload(vault, kind); let options = execution_options(oapp, kind, options);
    if (kind == 1) { vault.announced = true } else { vault.ack_sent = true };
    oapp.lz_send(&vault.cap, BNB_EID, message, options, fee, option::none(), option::some(ctx.sender()), ctx)
}
public fun confirm_send<T: key + store>(vault: &Vault<T>, oapp: &mut OApp, call: Call<SendParam, MessagingReceipt>): (SendParam, MessagingReceipt) {
    validate(vault, oapp); oapp.confirm_lz_send(&vault.cap, call)
}
public fun confirm_quote<T: key + store>(vault: &Vault<T>, oapp: &OApp, call: Call<QuoteParam, MessagingFee>): (QuoteParam, MessagingFee) {
    validate(vault, oapp); oapp.confirm_quote(&vault.cap, call)
}
public fun phase<T: key + store>(vault: &Vault<T>): u8 { vault.phase }
public fun route<T: key + store>(vault: &Vault<T>): Bytes32 { vault.route }
public fun backing<T: key + store>(vault: &Vault<T>): Bytes32 { vault.backing }
public fun payload_for_review<T: key + store>(vault: &Vault<T>, kind: u8): vector<u8> { payload(vault, kind) }
#[test_only]
public fun registry_for_testing<T: key + store>(cap: CallCap, oapp: address, nft: &T, ctx: &mut TxContext): (Registry, AdminCap) {
    let registry = new_registry(cap, oapp, object::id_address(nft), type_name::with_original_ids<T>().into_string().into_bytes(), ctx);
    let admin = AdminCap { id: object::new(ctx), registry: object::id(&registry) }; (registry, admin)
}
#[test_only]
public fun share_registry_for_testing(registry: Registry, admin: AdminCap, ctx: &TxContext) {
    transfer::share_object(registry); transfer::transfer(admin, ctx.sender())
}

// Fixture only: source-endpoint delivery is tested separately from this custody boundary.
#[test_only]
public fun announced_for_testing<T: key + store>(vault: &mut Vault<T>) {
    assert!(vault.phase == 1 && vault.nft.is_some(), EWrongState); vault.announced = true
}
#[test_only]
public fun init_for_testing(ctx: &mut TxContext) { init(VAULT {}, ctx) }
