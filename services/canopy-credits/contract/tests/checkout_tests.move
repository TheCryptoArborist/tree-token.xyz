#[test_only]
module canopy_checkout::checkout_tests;

use canopy_checkout::{checkout, vectors};
use sui::{clock, coin, object, tx_context};
use tree_fixture::tree::TREE;
const PAYER: address = @0x1111111111111111111111111111111111111111111111111111111111111111;
const NOW: u64 = 1800000001000;

fun run_case(which: u8) {
    let mut ctx = tx_context::new(PAYER, vector::tabulate!(32, |_| 0u8), 0, 0, 0);
    let (mut c, cap) = checkout::new_for_testing(&mut ctx);
    assert!(object::id_address(&c) == vectors::checkout_id(), 100);
    assert!(checkout::is_paused(&c), 101);
    let max = if (which == 14) 999999 else 2000000;
    let total = if (which == 15) 2000000 else 3000000;
    let payers = if (which == 13) vector[@0x9] else vector[PAYER];
    checkout::configure(&mut c, &cap, vectors::key(), max, total, payers);
    if (which != 1) checkout::set_paused(&mut c, &cap, false);
    let mut clock = clock::create_for_testing(&mut ctx);
    clock::set_for_testing(&mut clock, if (which == 21) 1800000045000 else NOW);
    let (mut bytes, mut sig) = if (which == 3) vectors::wrong_instance()
        else if (which == 4) vectors::wrong_epoch()
        else if (which == 5) vectors::wrong_payer()
        else if (which == 6) vectors::wrong_recipient()
        else if (which == 7) vectors::wrong_coin()
        else if (which == 8) vectors::invalid_window()
        else if (which == 9) vectors::expired()
        else if (which == 10) vectors::future()
        else if (which == 17) vectors::bad_domain()
        else if (which == 18) vectors::short_order()
        else if (which == 20) vectors::zero()
        else vectors::base();
    if (which == 11) sig[0] = sig[0] ^ 1;
    if (which == 19) bytes.push_back(0);
    if (which == 22) {
        checkout::configure(&mut c,&cap,vectors::key(),2000000,3000000,vector[PAYER]);
        checkout::set_paused(&mut c,&cap,false);
    };
    if (which == 2) {
        checkout::pay(&mut c,coin::mint_for_testing<sui::sui::SUI>(1000000,&mut ctx),bytes,sig,&clock,&ctx);
    } else {
        let amount = if (which == 12) 999999 else if (which == 20) 0 else 1000000;
        checkout::pay(&mut c,coin::mint_for_testing<TREE>(amount,&mut ctx),bytes,sig,&clock,&ctx);
    };
    assert!(checkout::total_received(&c) == 1000000, 102);
    if (which == 0) {
        let events = sui::event::events_by_type<checkout::Purchase>();
        assert!(events.length() == 1 && std::bcs::to_bytes(&events[0]) == vectors::purchase_bytes(), 103);
    };
    if (which == 16) {
        let (b,s) = vectors::base();
        checkout::pay(&mut c,coin::mint_for_testing<TREE>(1000000,&mut ctx),b,s,&clock,&ctx);
    };
    if (which == 15 || which == 23) {
        let (b,s) = vectors::second();
        checkout::pay(&mut c,coin::mint_for_testing<TREE>(1000000,&mut ctx),b,s,&clock,&ctx);
        assert!(checkout::total_received(&c) == 2000000,104);
        if (which == 15) {
            checkout::configure(&mut c,&cap,vectors::key(),1000000,2000000,vector[PAYER]);
            checkout::set_paused(&mut c,&cap,false);
            let (b,s) = vectors::third_epoch_two();
            checkout::pay(&mut c,coin::mint_for_testing<TREE>(1000000,&mut ctx),b,s,&clock,&ctx);
        };
    };
    clock::destroy_for_testing(clock); checkout::destroy_for_testing(c,cap);
}
#[test] fun successful_exact_payment_and_event_bytes() { run_case(0) }
#[test, expected_failure(abort_code=1, location=checkout)] fun paused() { run_case(1) }
#[test, expected_failure(abort_code=4, location=checkout)] fun wrong_actual_coin() { run_case(2) }
#[test, expected_failure(abort_code=5, location=checkout)] fun wrong_instance() { run_case(3) }
#[test, expected_failure(abort_code=5, location=checkout)] fun wrong_key_epoch() { run_case(4) }
#[test, expected_failure(abort_code=6, location=checkout)] fun wrong_sender() { run_case(5) }
#[test, expected_failure(abort_code=7, location=checkout)] fun wrong_recipient() { run_case(6) }
#[test, expected_failure(abort_code=4, location=checkout)] fun wrong_quoted_coin() { run_case(7) }
#[test, expected_failure(abort_code=8, location=checkout)] fun long_window() { run_case(8) }
#[test, expected_failure(abort_code=8, location=checkout)] fun expired() { run_case(9) }
#[test, expected_failure(abort_code=8, location=checkout)] fun future_quote() { run_case(10) }
#[test, expected_failure(abort_code=9, location=checkout)] fun invalid_signature() { run_case(11) }
#[test, expected_failure(abort_code=11, location=checkout)] fun underpayment() { run_case(12) }
#[test, expected_failure(abort_code=13, location=checkout)] fun payer_not_allowed() { run_case(13) }
#[test, expected_failure(abort_code=12, location=checkout)] fun per_payment_cap() { run_case(14) }
#[test, expected_failure(abort_code=12, location=checkout)] fun aggregate_cap_never_resets() { run_case(15) }
#[test, expected_failure(abort_code=10, location=checkout)] fun replay() { run_case(16) }
#[test, expected_failure(abort_code=5, location=checkout)] fun wrong_domain() { run_case(17) }
#[test, expected_failure(abort_code=5, location=checkout)] fun malformed_id() { run_case(18) }
#[test, expected_failure(abort_code=5, location=checkout)] fun trailing_bytes() { run_case(19) }
#[test, expected_failure(abort_code=11, location=checkout)] fun zero_payment() { run_case(20) }
#[test] fun exact_expiry_boundary() { run_case(21) }
#[test, expected_failure(abort_code=5, location=checkout)] fun rotation_invalidates_old_quotes() { run_case(22) }
#[test] fun two_distinct_orders() { run_case(23) }

#[test, expected_failure(abort_code=2, location=checkout)]
fun another_instances_admin_cap_is_rejected() {
    let mut ctx=tx_context::dummy();
    let (mut a,cap_a)=checkout::new_for_testing(&mut ctx);
    let (b,cap_b)=checkout::new_for_testing(&mut ctx);
    checkout::configure(&mut a,&cap_b,vectors::key(),1000000,2000000,vector[PAYER]);
    checkout::destroy_for_testing(a,cap_a);checkout::destroy_for_testing(b,cap_b);
}
#[test, expected_failure(abort_code=3, location=checkout)]
fun cannot_unpause_unconfigured() {
    let mut ctx=tx_context::dummy();let (mut c,cap)=checkout::new_for_testing(&mut ctx);
    checkout::set_paused(&mut c,&cap,false);checkout::destroy_for_testing(c,cap);
}
