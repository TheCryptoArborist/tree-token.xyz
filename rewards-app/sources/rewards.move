/// Standalone SUI reward pool for NFTree holders.
///
/// The pool does not depend on The Woods. An admin funds a shared SUI vault,
/// opens reward rounds, and each NFTree object can claim once per round.
#[allow(deprecated_usage)]
module nftree_rewards::rewards;

use std::type_name;
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, ID, UID};
use sui::sui::SUI;
use sui::table::{Self, Table};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

const E_NOT_ADMIN: u64 = 1;
const E_INVALID_PAYMENT: u64 = 2;
const E_INVALID_REWARD: u64 = 3;
const E_INVALID_NFTREE: u64 = 4;
const E_NO_ACTIVE_ROUND: u64 = 5;
const E_ALREADY_CLAIMED: u64 = 6;
const E_REWARD_POOL_LOW: u64 = 7;
const E_INVALID_WITHDRAWAL: u64 = 8;

const MAX_NFTREE_TYPE_BYTES: u64 = 160;

const DEFAULT_NFTREE_TYPE: vector<u8> =
    b"f6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT";

public struct AdminCap has key, store {
    id: UID,
}

public struct RewardPool has key {
    id: UID,
    admin: address,
    required_nftree_type: vector<u8>,
    vault: Balance<SUI>,
    current_round: u64,
    per_nftree_mist: u64,
    total_funded: u64,
    total_claimed: u64,
    total_claims: u64,
    claimed: Table<ClaimKey, bool>,
}

public struct ClaimKey has copy, drop, store {
    round: u64,
    nftree_id: ID,
}

public struct RewardPoolCreated has copy, drop {
    pool_id: ID,
    admin: address,
    required_nftree_type: vector<u8>,
}

public struct RewardPoolFunded has copy, drop {
    pool_id: ID,
    funder: address,
    amount: u64,
    vault_balance: u64,
    total_funded: u64,
}

public struct RewardRoundOpened has copy, drop {
    pool_id: ID,
    admin: address,
    round: u64,
    per_nftree_mist: u64,
    vault_balance: u64,
}

public struct NFTreeRewardClaimed has copy, drop {
    pool_id: ID,
    round: u64,
    claimant: address,
    nftree_id: ID,
    amount: u64,
    vault_balance: u64,
    total_claims: u64,
}

public struct RewardPoolWithdrawn has copy, drop {
    pool_id: ID,
    admin: address,
    recipient: address,
    amount: u64,
    vault_balance: u64,
}

fun init(ctx: &mut TxContext) {
    transfer::transfer(AdminCap { id: object::new(ctx) }, tx_context::sender(ctx));
}

public fun default_nftree_type(): vector<u8> {
    DEFAULT_NFTREE_TYPE
}

entry fun create_default_pool(_: &AdminCap, ctx: &mut TxContext) {
    create_pool_internal(DEFAULT_NFTREE_TYPE, ctx);
}

entry fun create_pool(
    _: &AdminCap,
    required_nftree_type: vector<u8>,
    ctx: &mut TxContext,
) {
    assert_nftree_type_limited(&required_nftree_type);
    create_pool_internal(required_nftree_type, ctx);
}

entry fun fund_pool(
    pool: &mut RewardPool,
    payment: Coin<SUI>,
    ctx: &TxContext,
) {
    let amount = coin::value(&payment);
    assert!(amount > 0, E_INVALID_PAYMENT);

    balance::join(&mut pool.vault, coin::into_balance(payment));
    pool.total_funded = pool.total_funded + amount;

    event::emit(RewardPoolFunded {
        pool_id: object::id(pool),
        funder: tx_context::sender(ctx),
        amount,
        vault_balance: balance::value(&pool.vault),
        total_funded: pool.total_funded,
    });
}

entry fun open_round(
    _: &AdminCap,
    pool: &mut RewardPool,
    per_nftree_mist: u64,
    ctx: &TxContext,
) {
    assert_admin(pool, ctx);
    assert!(per_nftree_mist > 0, E_INVALID_REWARD);
    assert!(per_nftree_mist <= balance::value(&pool.vault), E_REWARD_POOL_LOW);

    pool.current_round = pool.current_round + 1;
    pool.per_nftree_mist = per_nftree_mist;

    event::emit(RewardRoundOpened {
        pool_id: object::id(pool),
        admin: tx_context::sender(ctx),
        round: pool.current_round,
        per_nftree_mist,
        vault_balance: balance::value(&pool.vault),
    });
}

entry fun claim<NFTree: key>(
    pool: &mut RewardPool,
    nftree: &NFTree,
    ctx: &mut TxContext,
) {
    assert!(pool.current_round > 0, E_NO_ACTIVE_ROUND);
    assert!(pool.per_nftree_mist > 0, E_NO_ACTIVE_ROUND);
    assert!(nftree_type<NFTree>() == pool.required_nftree_type, E_INVALID_NFTREE);
    assert!(pool.per_nftree_mist <= balance::value(&pool.vault), E_REWARD_POOL_LOW);

    let nftree_id = object::id(nftree);
    let key = claim_key(pool.current_round, nftree_id);
    assert!(!table::contains(&pool.claimed, key), E_ALREADY_CLAIMED);

    table::add(&mut pool.claimed, key, true);

    let reward = balance::split(&mut pool.vault, pool.per_nftree_mist);
    pool.total_claimed = pool.total_claimed + pool.per_nftree_mist;
    pool.total_claims = pool.total_claims + 1;

    let claimant = tx_context::sender(ctx);
    event::emit(NFTreeRewardClaimed {
        pool_id: object::id(pool),
        round: pool.current_round,
        claimant,
        nftree_id,
        amount: pool.per_nftree_mist,
        vault_balance: balance::value(&pool.vault),
        total_claims: pool.total_claims,
    });
    transfer::public_transfer(coin::from_balance(reward, ctx), claimant);
}

entry fun withdraw_unallocated(
    _: &AdminCap,
    pool: &mut RewardPool,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    assert_admin(pool, ctx);
    assert!(recipient != @0x0, E_INVALID_WITHDRAWAL);
    assert!(amount > 0 && amount <= balance::value(&pool.vault), E_INVALID_WITHDRAWAL);

    let withdrawal = balance::split(&mut pool.vault, amount);

    event::emit(RewardPoolWithdrawn {
        pool_id: object::id(pool),
        admin: tx_context::sender(ctx),
        recipient,
        amount,
        vault_balance: balance::value(&pool.vault),
    });
    transfer::public_transfer(coin::from_balance(withdrawal, ctx), recipient);
}

public fun pool_id(pool: &RewardPool): ID {
    object::id(pool)
}

public fun admin(pool: &RewardPool): address {
    pool.admin
}

public fun required_nftree_type(pool: &RewardPool): vector<u8> {
    pool.required_nftree_type
}

public fun vault_balance(pool: &RewardPool): u64 {
    balance::value(&pool.vault)
}

public fun current_round(pool: &RewardPool): u64 {
    pool.current_round
}

public fun per_nftree_mist(pool: &RewardPool): u64 {
    pool.per_nftree_mist
}

public fun total_funded(pool: &RewardPool): u64 {
    pool.total_funded
}

public fun total_claimed(pool: &RewardPool): u64 {
    pool.total_claimed
}

public fun total_claims(pool: &RewardPool): u64 {
    pool.total_claims
}

public fun has_claimed(pool: &RewardPool, round: u64, nftree_id: ID): bool {
    table::contains(&pool.claimed, claim_key(round, nftree_id))
}

fun create_pool_internal(required_nftree_type: vector<u8>, ctx: &mut TxContext) {
    assert_nftree_type_limited(&required_nftree_type);

    let admin = tx_context::sender(ctx);
    let pool = RewardPool {
        id: object::new(ctx),
        admin,
        required_nftree_type,
        vault: balance::zero(),
        current_round: 0,
        per_nftree_mist: 0,
        total_funded: 0,
        total_claimed: 0,
        total_claims: 0,
        claimed: table::new(ctx),
    };
    let pool_id = object::id(&pool);

    event::emit(RewardPoolCreated {
        pool_id,
        admin,
        required_nftree_type: pool.required_nftree_type,
    });
    transfer::share_object(pool);
}

fun assert_admin(pool: &RewardPool, ctx: &TxContext) {
    assert!(tx_context::sender(ctx) == pool.admin, E_NOT_ADMIN);
}

fun assert_nftree_type_limited(required_nftree_type: &vector<u8>) {
    let length = required_nftree_type.length();
    assert!(length > 0 && length <= MAX_NFTREE_TYPE_BYTES, E_INVALID_NFTREE);
}

fun claim_key(round: u64, nftree_id: ID): ClaimKey {
    ClaimKey { round, nftree_id }
}

fun nftree_type<NFTree: key>(): vector<u8> {
    type_name::with_original_ids<NFTree>().into_string().into_bytes()
}

#[test]
fun default_nftree_type_is_valid() {
    let nftree_type = DEFAULT_NFTREE_TYPE;
    assert_nftree_type_limited(&nftree_type);
}

#[test, expected_failure(abort_code = E_INVALID_NFTREE)]
fun empty_nftree_type_is_rejected() {
    let nftree_type = vector[];
    assert_nftree_type_limited(&nftree_type);
}

#[test]
fun claim_keys_are_round_specific() {
    let nftree_id = object::id_from_address(@0x123);
    let first_round = claim_key(1, nftree_id);
    let second_round = claim_key(2, nftree_id);

    assert!(first_round != second_round, 100);
}

