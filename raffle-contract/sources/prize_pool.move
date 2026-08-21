module tree_raffle::prize_pool;

use sui::bag::{Self, Bag};
use sui::balance::Balance;
use sui::coin::{Self, Coin};
use sui::dynamic_field;
use sui::event;
use sui::random::{Self, Random};

#[test_only]
use sui::sui::SUI;
#[test_only]
use sui::test_scenario as ts;

const E_INVALID_DRAW_ID: u64 = 0;
const E_ZERO_TICKETS: u64 = 1;
const E_DRAW_ALREADY_EXECUTED: u64 = 2;
const E_DRAW_NOT_FOUND: u64 = 3;
const E_WINNER_ALREADY_REGISTERED: u64 = 4;
const E_ZERO_PRIZE: u64 = 5;
const E_INSUFFICIENT_UNRESERVED_BALANCE: u64 = 6;
const E_PRIZE_NOT_FOUND_OR_WRONG_TOKEN: u64 = 7;
const E_NOT_WINNER: u64 = 8;
const E_INVALID_LEDGER_COMMITMENT: u64 = 9;

const MAX_DRAW_ID_BYTES: u64 = 96;
const SHA256_COMMITMENT_BYTES: u64 = 32;

public struct AdminCap has key, store {
    id: UID,
}

/// Operational authority for the isolated raffle worker. It can execute a
/// committed draw and reserve its winner, but it cannot withdraw unreserved
/// treasury funds or control package upgrades.
public struct OperatorCap has key, store {
    id: UID,
}

public struct PrizePool has key {
    id: UID,
    unreserved_balances: Bag,
    draw_count: u64,
    registered_prize_count: u64,
    claimed_prize_count: u64,
}

public struct TokenKey<phantom T> has copy, drop, store {}

public struct DrawKey has copy, drop, store {
    draw_id: vector<u8>,
}

public struct PrizeKey has copy, drop, store {
    draw_id: vector<u8>,
}

public struct DrawOutcome has store {
    ledger_commitment: vector<u8>,
    winning_ticket: u64,
    total_tickets: u64,
    winner_registered: bool,
}

public struct WinnerPrize<phantom T> has store {
    winner: address,
    balance: Balance<T>,
}

public struct DrawExecuted has copy, drop {
    draw_id: vector<u8>,
    ledger_commitment: vector<u8>,
    winning_ticket: u64,
    total_tickets: u64,
}

public struct PrizeDeposited<phantom T> has copy, drop {
    amount: u64,
}

public struct WinnerRegistered<phantom T> has copy, drop {
    draw_id: vector<u8>,
    winner: address,
    amount: u64,
}

public struct PrizeClaimed<phantom T> has copy, drop {
    draw_id: vector<u8>,
    winner: address,
    amount: u64,
}

public struct UnreservedPrizeWithdrawn<phantom T> has copy, drop {
    amount: u64,
}

fun init(ctx: &mut TxContext) {
    let pool = PrizePool {
        id: object::new(ctx),
        unreserved_balances: bag::new(ctx),
        draw_count: 0,
        registered_prize_count: 0,
        claimed_prize_count: 0,
    };
    transfer::share_object(pool);
    transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
    transfer::transfer(OperatorCap { id: object::new(ctx) }, ctx.sender());
}

fun assert_valid_draw_id(draw_id: &vector<u8>) {
    let length = draw_id.length();
    assert!(length > 0 && length <= MAX_DRAW_ID_BYTES, E_INVALID_DRAW_ID);
}

/// Deposits prize funding. Deposits are intentionally permissionless so any
/// wallet can replenish the pool. OperatorCap can reserve prizes for verified
/// winners; only AdminCap can withdraw unreserved funding.
public fun deposit<T>(pool: &mut PrizePool, coin: Coin<T>) {
    let amount = coin.value();
    let incoming = coin.into_balance();
    let key = TokenKey<T> {};
    if (pool.unreserved_balances.contains(key)) {
        let stored: &mut Balance<T> = pool.unreserved_balances.borrow_mut(key);
        stored.join(incoming);
    } else {
        pool.unreserved_balances.add(key, incoming);
    };
    event::emit(PrizeDeposited<T> { amount });
}

/// Executes a draw once. The winning ticket is persisted on-chain before it is
/// emitted, preventing an operator from rerolling the same draw identifier.
entry fun execute_draw(
    pool: &mut PrizePool,
    _cap: &OperatorCap,
    random: &Random,
    draw_id: vector<u8>,
    ledger_commitment: vector<u8>,
    total_tickets: u64,
    ctx: &mut TxContext,
) {
    assert_valid_draw_id(&draw_id);
    assert!(ledger_commitment.length() == SHA256_COMMITMENT_BYTES, E_INVALID_LEDGER_COMMITMENT);
    assert!(total_tickets > 0, E_ZERO_TICKETS);
    let key = DrawKey { draw_id };
    assert!(!dynamic_field::exists(&pool.id, key), E_DRAW_ALREADY_EXECUTED);

    let mut generator = random::new_generator(random, ctx);
    let winning_ticket = random::generate_u64_in_range(
        &mut generator,
        0,
        total_tickets - 1,
    );
    dynamic_field::add(
        &mut pool.id,
        key,
        DrawOutcome {
            ledger_commitment,
            winning_ticket,
            total_tickets,
            winner_registered: false,
        },
    );
    pool.draw_count = pool.draw_count + 1;
    event::emit(DrawExecuted { draw_id, ledger_commitment, winning_ticket, total_tickets });
}

/// Reserves the prize at registration time. Reserved balances are stored in a
/// token-typed dynamic field and can no longer be removed by admin withdrawal.
public fun register_winner<T>(
    pool: &mut PrizePool,
    _cap: &OperatorCap,
    draw_id: vector<u8>,
    winner: address,
    amount: u64,
) {
    assert_valid_draw_id(&draw_id);
    assert!(amount > 0, E_ZERO_PRIZE);
    let draw_key = DrawKey { draw_id };
    assert!(dynamic_field::exists(&pool.id, draw_key), E_DRAW_NOT_FOUND);
    let outcome: &mut DrawOutcome = dynamic_field::borrow_mut(&mut pool.id, draw_key);
    assert!(!outcome.winner_registered, E_WINNER_ALREADY_REGISTERED);

    let token_key = TokenKey<T> {};
    assert!(
        pool.unreserved_balances.contains_with_type<TokenKey<T>, Balance<T>>(token_key),
        E_INSUFFICIENT_UNRESERVED_BALANCE,
    );
    let unreserved: &mut Balance<T> = pool.unreserved_balances.borrow_mut(token_key);
    assert!(unreserved.value() >= amount, E_INSUFFICIENT_UNRESERVED_BALANCE);
    let reserved = unreserved.split(amount);

    outcome.winner_registered = true;
    dynamic_field::add(
        &mut pool.id,
        PrizeKey { draw_id },
        WinnerPrize<T> { winner, balance: reserved },
    );
    pool.registered_prize_count = pool.registered_prize_count + 1;
    event::emit(WinnerRegistered<T> { draw_id, winner, amount });
}

/// Claims a registered prize directly to the winning wallet. Removing the
/// dynamic field makes the claim single-use and replay safe.
entry fun claim<T>(
    pool: &mut PrizePool,
    draw_id: vector<u8>,
    ctx: &mut TxContext,
) {
    assert_valid_draw_id(&draw_id);
    let key = PrizeKey { draw_id };
    assert!(
        dynamic_field::exists_with_type<PrizeKey, WinnerPrize<T>>(&pool.id, key),
        E_PRIZE_NOT_FOUND_OR_WRONG_TOKEN,
    );
    let WinnerPrize { winner, balance } = dynamic_field::remove<PrizeKey, WinnerPrize<T>>(
        &mut pool.id,
        key,
    );
    assert!(winner == ctx.sender(), E_NOT_WINNER);
    let amount = balance.value();
    let prize = coin::from_balance(balance, ctx);
    pool.claimed_prize_count = pool.claimed_prize_count + 1;
    event::emit(PrizeClaimed<T> { draw_id, winner, amount });
    transfer::public_transfer(prize, winner);
}

/// Admin recovery can only touch funds that have not been reserved for a
/// winner. Registered prizes remain claimable even during an emergency.
public fun withdraw_unreserved<T>(
    pool: &mut PrizePool,
    _cap: &AdminCap,
    amount: u64,
    ctx: &mut TxContext,
): Coin<T> {
    assert!(amount > 0, E_ZERO_PRIZE);
    let key = TokenKey<T> {};
    assert!(
        pool.unreserved_balances.contains_with_type<TokenKey<T>, Balance<T>>(key),
        E_INSUFFICIENT_UNRESERVED_BALANCE,
    );
    let stored: &mut Balance<T> = pool.unreserved_balances.borrow_mut(key);
    assert!(stored.value() >= amount, E_INSUFFICIENT_UNRESERVED_BALANCE);
    let withdrawn = stored.split(amount);
    event::emit(UnreservedPrizeWithdrawn<T> { amount });
    coin::from_balance(withdrawn, ctx)
}

public fun unreserved_balance<T>(pool: &PrizePool): u64 {
    let key = TokenKey<T> {};
    if (pool.unreserved_balances.contains_with_type<TokenKey<T>, Balance<T>>(key)) {
        let stored: &Balance<T> = pool.unreserved_balances.borrow(key);
        stored.value()
    } else {
        0
    }
}

public fun draw_result(
    pool: &PrizePool,
    draw_id: vector<u8>,
): (vector<u8>, u64, u64, bool) {
    let key = DrawKey { draw_id };
    assert!(dynamic_field::exists(&pool.id, key), E_DRAW_NOT_FOUND);
    let outcome: &DrawOutcome = dynamic_field::borrow(&pool.id, key);
    (
        outcome.ledger_commitment,
        outcome.winning_ticket,
        outcome.total_tickets,
        outcome.winner_registered,
    )
}

public fun claimable_prize<T>(
    pool: &PrizePool,
    draw_id: vector<u8>,
): (address, u64) {
    let key = PrizeKey { draw_id };
    assert!(
        dynamic_field::exists_with_type<PrizeKey, WinnerPrize<T>>(&pool.id, key),
        E_PRIZE_NOT_FOUND_OR_WRONG_TOKEN,
    );
    let prize: &WinnerPrize<T> = dynamic_field::borrow(&pool.id, key);
    (prize.winner, prize.balance.value())
}

public fun draw_count(pool: &PrizePool): u64 { pool.draw_count }

public fun registered_prize_count(pool: &PrizePool): u64 {
    pool.registered_prize_count
}

public fun claimed_prize_count(pool: &PrizePool): u64 {
    pool.claimed_prize_count
}

#[test]
fun test_draw_reserves_and_claims_prize() {
    let admin = @0xA11CE;
    let winner = @0xB0B;
    let draw_id = b"daily:2026-08-19";
    let mut scenario = ts::begin(@0x0);
    random::create_for_testing(scenario.ctx());
    scenario.next_tx(@0x0);
    let mut random_state: Random = scenario.take_shared();
    random::update_randomness_state_for_testing(
        &mut random_state,
        0,
        x"1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F1F",
        scenario.ctx(),
    );
    ts::return_shared(random_state);
    scenario.next_tx(admin);
    init(scenario.ctx());
    scenario.next_tx(admin);

    let random_state: Random = scenario.take_shared();
    let mut pool: PrizePool = scenario.take_shared();
    let cap: AdminCap = scenario.take_from_sender();
    let operator: OperatorCap = scenario.take_from_sender();

    deposit(&mut pool, coin::mint_for_testing<SUI>(1_000, scenario.ctx()));
    assert!(unreserved_balance<SUI>(&pool) == 1_000);

    execute_draw(
        &mut pool,
        &operator,
        &random_state,
        draw_id,
        x"0102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F20",
        100,
        scenario.ctx(),
    );
    let (ledger_commitment, winning_ticket, total_tickets, registered) = draw_result(&pool, draw_id);
    assert!(ledger_commitment == x"0102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F20");
    assert!(winning_ticket < 100);
    assert!(total_tickets == 100);
    assert!(!registered);

    register_winner<SUI>(&mut pool, &operator, draw_id, winner, 250);
    assert!(unreserved_balance<SUI>(&pool) == 750);
    let (claimant, claimable_amount) = claimable_prize<SUI>(&pool, draw_id);
    assert!(claimant == winner);
    assert!(claimable_amount == 250);

    ts::return_shared(pool);
    ts::return_shared(random_state);
    scenario.return_to_sender(cap);
    scenario.return_to_sender(operator);
    scenario.next_tx(winner);

    let mut pool: PrizePool = scenario.take_shared();
    claim<SUI>(&mut pool, draw_id, scenario.ctx());
    assert!(claimed_prize_count(&pool) == 1);
    ts::return_shared(pool);
    scenario.next_tx(winner);

    let claimed: Coin<SUI> = scenario.take_from_sender();
    assert!(claimed.value() == 250);
    claimed.burn_for_testing();
    scenario.end();
}
