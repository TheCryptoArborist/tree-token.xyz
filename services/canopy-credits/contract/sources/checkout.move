/// Draft checkout, NOT published. CC is an off-chain ledger balance, not a coin.
/// Payments transfer directly to the pinned recipient; this module holds no funds.
module canopy_checkout::checkout;

use std::{ascii::{Self, String}, bcs, type_name};
use sui::{bcs as decode, clock::{Self, Clock}, coin::{Self, Coin}, ed25519, event,
    object::{Self, ID, UID}, table::{Self, Table}, transfer, tx_context::{Self, TxContext}};

const RECIPIENT: address = @0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f;
const TREE: vector<u8> = b"0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE";
const DOMAIN: vector<u8> = b"TREE_CC_CHECKOUT_V1:sui:mainnet";
const MAX_WINDOW_MS: u64 = 45000;

const EPaused: u64 = 1;
const EAdmin: u64 = 2;
const EConfig: u64 = 3;
const EWrongCoin: u64 = 4;
const EQuote: u64 = 5;
const EPayer: u64 = 6;
const ERecipient: u64 = 7;
const EWindow: u64 = 8;
const ESignature: u64 = 9;
const EReplay: u64 = 10;
const EAmount: u64 = 11;
const ECap: u64 = 12;
const EAllowlist: u64 = 13;

public struct Checkout has key {
    id: UID,
    paused: bool,
    quote_key: vector<u8>,
    key_epoch: u64,
    max_payment_raw: u64,
    total_cap_raw: u64,
    total_received_raw: u64,
    allowed_payers: vector<address>,
    used_orders: Table<vector<u8>, bool>,
}
public struct AdminCap has key, store { id: UID, checkout_id: ID }

/// Exact BCS layout shared with the SDK. UUIDs are 16 bytes, commitment 32 bytes.
public struct Quote has copy, drop, store {
    domain: vector<u8>,
    checkout_id: address,
    key_epoch: u64,
    order_id: vector<u8>,
    account_id: vector<u8>,
    payer: address,
    recipient: address,
    coin_type: String,
    amount_raw: u64,
    issued_at_ms: u64,
    expires_at_ms: u64,
    quote_hash: vector<u8>,
}
public struct Purchase has copy, drop {
    schema_version: u8,
    checkout_id: address,
    key_epoch: u64,
    order_id: vector<u8>,
    account_id: vector<u8>,
    payer: address,
    recipient: address,
    coin_type: String,
    amount_raw: u64,
    issued_at_ms: u64,
    expires_at_ms: u64,
    quote_hash: vector<u8>,
    paid_at_ms: u64,
}
public struct ConfigurationChanged has copy, drop {
    checkout_id: ID, key_epoch: u64, quote_key: vector<u8>,
    max_payment_raw: u64, total_cap_raw: u64, allowed_payers: vector<address>,
}
public struct PauseChanged has copy, drop { checkout_id: ID, paused: bool }

fun new(ctx: &mut TxContext): (Checkout, AdminCap) {
    let id = object::new(ctx);
    let checkout_id = id.to_inner();
    let c = Checkout {
        id, paused: true, quote_key: vector[], key_epoch: 0,
        max_payment_raw: 0, total_cap_raw: 0, total_received_raw: 0,
        allowed_payers: vector[], used_orders: table::new(ctx),
    };
    (c, AdminCap { id: object::new(ctx), checkout_id })
}
fun init(ctx: &mut TxContext) {
    let (c, cap) = new(ctx);
    transfer::share_object(c);
    transfer::transfer(cap, ctx.sender());
}
fun assert_admin(c: &Checkout, cap: &AdminCap) {
    assert!(cap.checkout_id == object::id(c), EAdmin);
}
/// Rotating/configuring always pauses checkout and invalidates outstanding signatures.
/// No recipient setter, no treasury key, no resetting the cumulative received amount.
public fun configure(c: &mut Checkout, cap: &AdminCap, quote_key: vector<u8>,
    max_payment_raw: u64, total_cap_raw: u64, allowed_payers: vector<address>) {
    assert_admin(c, cap);
    assert!(quote_key.length() == 32 && quote_key != vector::tabulate!(32, |_| 0u8), EConfig);
    assert!(max_payment_raw > 0 && total_cap_raw >= max_payment_raw && total_cap_raw >= c.total_received_raw, EConfig);
    assert!(!allowed_payers.is_empty() && allowed_payers.length() <= 32, EConfig);
    let mut i = 0;
    while (i < allowed_payers.length()) {
        assert!(allowed_payers[i] != @0x0 && allowed_payers[i] != RECIPIENT, EConfig);
        let mut j = i + 1;
        while (j < allowed_payers.length()) {
            assert!(allowed_payers[i] != allowed_payers[j], EConfig);
            j = j + 1;
        };
        i = i + 1;
    };
    c.quote_key = quote_key;
    c.key_epoch = c.key_epoch + 1;
    c.max_payment_raw = max_payment_raw;
    c.total_cap_raw = total_cap_raw;
    c.allowed_payers = allowed_payers;
    c.paused = true;
    event::emit(ConfigurationChanged { checkout_id: object::id(c), key_epoch: c.key_epoch,
        quote_key, max_payment_raw, total_cap_raw, allowed_payers });
    event::emit(PauseChanged { checkout_id: object::id(c), paused: true });
}
public fun set_paused(c: &mut Checkout, cap: &AdminCap, paused: bool) {
    assert_admin(c, cap);
    if (!paused) assert!(c.quote_key.length() == 32 && c.max_payment_raw > 0 && !c.allowed_payers.is_empty(), EConfig);
    c.paused = paused;
    event::emit(PauseChanged { checkout_id: object::id(c), paused });
}
fun parse_quote(bytes: vector<u8>): Quote {
    assert!(bytes.length() <= 512, EQuote);
    let mut p = decode::new(bytes);
    let q = Quote {
        domain: p.peel_vec_u8(), checkout_id: p.peel_address(), key_epoch: p.peel_u64(),
        order_id: p.peel_vec_u8(), account_id: p.peel_vec_u8(),
        payer: p.peel_address(), recipient: p.peel_address(),
        coin_type: ascii::string(p.peel_vec_u8()), amount_raw: p.peel_u64(),
        issued_at_ms: p.peel_u64(), expires_at_ms: p.peel_u64(), quote_hash: p.peel_vec_u8(),
    };
    assert!(p.into_remainder_bytes().is_empty() && bcs::to_bytes(&q) == bytes, EQuote);
    assert!(q.domain == DOMAIN && q.order_id.length() == 16 && q.account_id.length() == 16 && q.quote_hash.length() == 32, EQuote);
    q
}
public fun pay<T>(c: &mut Checkout, payment: Coin<T>, quote_bytes: vector<u8>,
    signature: vector<u8>, clock: &Clock, ctx: &TxContext) {
    assert!(!c.paused, EPaused);
    let mut actual_type = b"0x";
    actual_type.append(type_name::with_original_ids<T>().into_string().into_bytes());
    assert!(actual_type == TREE, EWrongCoin);
    let q = parse_quote(quote_bytes);
    assert!(q.checkout_id == object::id_address(c) && q.key_epoch == c.key_epoch, EQuote);
    assert!(q.payer == ctx.sender() && q.payer != RECIPIENT, EPayer);
    assert!(q.recipient == RECIPIENT, ERecipient);
    assert!(q.coin_type.as_bytes() == &TREE, EWrongCoin);
    assert!(c.allowed_payers.contains(&q.payer), EAllowlist);
    let now = clock::timestamp_ms(clock);
    assert!(q.expires_at_ms >= q.issued_at_ms && q.expires_at_ms - q.issued_at_ms > 0 &&
        q.expires_at_ms - q.issued_at_ms <= MAX_WINDOW_MS && now >= q.issued_at_ms && now <= q.expires_at_ms, EWindow);
    assert!(signature.length() == 64 && ed25519::ed25519_verify(&signature, &c.quote_key, &quote_bytes), ESignature);
    assert!(!c.used_orders.contains(q.order_id), EReplay);
    assert!(q.amount_raw > 0 && coin::value(&payment) == q.amount_raw, EAmount);
    assert!(q.amount_raw <= c.max_payment_raw && q.amount_raw <= c.total_cap_raw - c.total_received_raw, ECap);
    c.used_orders.add(q.order_id, true);
    c.total_received_raw = c.total_received_raw + q.amount_raw;
    transfer::public_transfer(payment, RECIPIENT);
    event::emit(Purchase { schema_version: 1, checkout_id: q.checkout_id, key_epoch: q.key_epoch,
        order_id: q.order_id, account_id: q.account_id, payer: q.payer, recipient: RECIPIENT,
        coin_type: q.coin_type, amount_raw: q.amount_raw, issued_at_ms: q.issued_at_ms,
        expires_at_ms: q.expires_at_ms, quote_hash: q.quote_hash, paid_at_ms: now });
}
public fun recipient(): address { RECIPIENT }
public fun total_received(c: &Checkout): u64 { c.total_received_raw }
public fun is_paused(c: &Checkout): bool { c.paused }

#[test_only]
public fun new_for_testing(ctx: &mut TxContext): (Checkout, AdminCap) { new(ctx) }
#[test_only]
public fun destroy_for_testing(c: Checkout, cap: AdminCap) {
    let Checkout { id, paused: _, quote_key: _, key_epoch: _, max_payment_raw: _, total_cap_raw: _,
        total_received_raw: _, allowed_payers: _, used_orders } = c;
    let AdminCap { id: cap_id, checkout_id: _ } = cap;
    table::drop(used_orders); id.delete(); cap_id.delete();
}
