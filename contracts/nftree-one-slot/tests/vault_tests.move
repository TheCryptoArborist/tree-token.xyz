#[test_only]
module nftree_one_slot::vault_tests;
use nftree_one_slot::{vault::{Self, Vault, Registry, AdminCap}, codec};
use oapp::oapp::{Self, OApp, AdminCap as OAppAdminCap};
use oapp::{oapp_peer, enforced_options};
use endpoint_v2::{endpoint_send, endpoint_quote};
use endpoint_v2::{endpoint_v2::{Self, EndpointV2}, messaging_channel::MessagingChannel, lz_receive};
use call::{call, call_cap};
use utils::{bytes32::{Self, Bytes32}, package};
use sui::{test_scenario::{Self, Scenario}, coin, sui::SUI};
use std::unit_test::{assert_eq, destroy};
public struct NFT has key, store { id: UID }
public struct OtherNFT has key, store { id: UID }
fun peer(): Bytes32 { bytes32::from_address(@0xB) }
fun request(): Bytes32 { bytes32::from_address(@0xC) }
fun setup(funded: bool, announced: bool): Scenario { setup_route(funded, announced, true) }
fun setup_route(funded: bool, announced: bool, bind_route: bool): Scenario {
    let mut s = test_scenario::begin(@0xA);
    endpoint_v2::init_for_test(s.ctx());
    s.next_tx(@0xA);
    let nft = NFT { id: object::new(s.ctx()) };
    let cap = call_cap::new_package_cap_for_test(s.ctx());
    let oadmin = oapp::create_admin_cap_for_test(s.ctx());
    let oapp = oapp::create_oapp_for_test(&cap, &oadmin, s.ctx());
    let (registry, admin) = vault::registry_for_testing(cap, object::id_address(&oapp), &nft, s.ctx());
    vault::share_registry_for_testing(registry, admin, s.ctx());
    oapp::share_oapp_for_test(oapp); transfer::public_transfer(oadmin, @0xA); transfer::public_transfer(nft, @0xA);
    s.next_tx(@0xA);
    let mut registry = s.take_shared<Registry>(); let admin = s.take_from_sender<AdminCap>();
    vault::create_slot<NFT>(&mut registry, &admin, s.ctx());
    test_scenario::return_shared(registry); s.return_to_sender(admin);
    s.next_tx(@0xA);
    let mut endpoint = s.take_shared<EndpointV2>(); let vault = s.take_shared<Vault<NFT>>(); let admin = s.take_from_sender<AdminCap>();
    vault::register(&vault, &admin, &mut endpoint, vector[], s.ctx());
    test_scenario::return_shared(endpoint); test_scenario::return_shared(vault); s.return_to_sender(admin);
    s.next_tx(@0xA);
    let mut endpoint = s.take_shared<EndpointV2>(); let mut channel = s.take_shared<MessagingChannel>();
    let mut oapp = s.take_shared<OApp>(); let oadmin = s.take_from_sender<OAppAdminCap>();
    let mut vault = s.take_shared<Vault<NFT>>(); let admin = s.take_from_sender<AdminCap>();
    if (bind_route) { vault::bind(&mut vault, &admin, &mut oapp, &oadmin, &endpoint, &mut channel, peer(), s.ctx()); };
    if (funded) { let nft = s.take_from_sender<NFT>(); vault::fund(&mut vault, &admin, nft); };
    if (announced) {
        vault::announced_for_testing(&mut vault);
    };
    test_scenario::return_shared(endpoint); test_scenario::return_shared(channel);
    test_scenario::return_shared(oapp); test_scenario::return_shared(vault);
    s.return_to_sender(admin); s.return_to_sender(oadmin); s.next_tx(@0xA); s
}
fun message(vault: &Vault<NFT>, req: Bytes32, recipient: address): vector<u8> {
    codec::encode(2, vault::route(vault), vault::backing(vault), req, bytes32::from_address(recipient))
}
fun deliver(vault: &mut Vault<NFT>, oapp: &OApp, caller: address, eid: u32, sender: Bytes32, message: vector<u8>, ctx: &mut TxContext) {
    let endpoint_cap = call_cap::new_package_cap_with_address_for_test(ctx, caller);
    let p = lz_receive::create_param_for_test(eid, sender, 1, request(), message, @0xA, vector[], option::none());
    let call = call::create(&endpoint_cap, oapp.oapp_cap_id(), true, p, ctx); destroy(endpoint_cap);
    vault::lz_receive(vault, oapp, call);
}
fun endpoint_address(): address { package::original_package_of_type<EndpointV2>() }
#[test]
fun exact_backing_released_once_and_acknowledgement_preserves_recipient() {
    let mut s = setup(true, true); let mut vault = s.take_shared<Vault<NFT>>(); let mut oapp = s.take_shared<OApp>();
    let backing = vault::backing(&vault); let payload = message(&vault, request(), @0xD);
    deliver(&mut vault, &oapp, endpoint_address(), 30102, peer(), payload, s.ctx());
    assert_eq!(vault::phase(&vault), 2);
    deliver(&mut vault, &oapp, endpoint_address(), 30102, peer(), payload, s.ctx());
    let ack = vault::payload_for_review(&vault, 3); let (kind, _, nft, req, recipient) = codec::decode(&ack);
    assert_eq!(kind, 3); assert_eq!(nft, backing); assert_eq!(req, request()); assert_eq!(recipient, bytes32::from_address(@0xD));
    let send = vault::send(&mut vault, &mut oapp, 3, vector[], coin::zero<SUI>(s.ctx()), s.ctx()); destroy(send);
    test_scenario::return_shared(vault); test_scenario::return_shared(oapp); s.next_tx(@0xD);
    let nft = s.take_from_sender<NFT>(); assert_eq!(object::id(&nft), backing.to_id()); s.return_to_sender(nft); s.end();
}
#[test]
fun paused_vault_still_completes_authenticated_release_and_acknowledgement() {
    let mut s = setup(true, true); let mut vault = s.take_shared<Vault<NFT>>(); let mut oapp = s.take_shared<OApp>();
    let admin = s.take_from_sender<AdminCap>(); vault::set_paused(&mut vault, &admin, true);
    let payload = message(&vault, request(), @0xD); deliver(&mut vault, &oapp, endpoint_address(), 30102, peer(), payload, s.ctx());
    let send = vault::send(&mut vault, &mut oapp, 3, vector[], coin::zero<SUI>(s.ctx()), s.ctx()); destroy(send);
    assert_eq!(vault::phase(&vault), 2); test_scenario::return_shared(vault); test_scenario::return_shared(oapp); s.return_to_sender(admin); s.end();
}
#[test, expected_failure(abort_code = 3, location = vault)]
fun registry_cannot_create_a_second_slot() { let mut s = setup(false, false); let mut r = s.take_shared<Registry>(); let a = s.take_from_sender<AdminCap>(); vault::create_slot<NFT>(&mut r, &a, s.ctx());  abort 999 }
#[test, expected_failure(abort_code = 2, location = vault)]
fun wrong_collection_type_cannot_create_slot() {
    let mut s = test_scenario::begin(@0xA); let nft = NFT { id: object::new(s.ctx()) }; let cap = call_cap::new_package_cap_for_test(s.ctx());
    let (mut r, a) = vault::registry_for_testing(cap, @0xB, &nft, s.ctx()); vault::create_slot<OtherNFT>(&mut r, &a, s.ctx()); destroy(r); destroy(a); destroy(nft);
 abort 999 }
#[test, expected_failure(abort_code = 4, location = vault)]
fun same_type_different_object_cannot_fund_slot() { let mut s = setup(false, false); let mut v = s.take_shared<Vault<NFT>>(); let a = s.take_from_sender<AdminCap>(); let fake = NFT { id: object::new(s.ctx()) }; vault::fund(&mut v, &a, fake);  abort 999 }
#[test, expected_failure(abort_code = 1, location = vault)]
fun another_registry_cap_cannot_pause_or_fund_this_vault() {
    let mut s = setup(false, false); let mut v = s.take_shared<Vault<NFT>>(); let n = NFT { id: object::new(s.ctx()) };
    let c = call_cap::new_package_cap_for_test(s.ctx()); let (r, a) = vault::registry_for_testing(c, @0xB, &n, s.ctx());
    vault::set_paused(&mut v, &a, true); destroy(r); destroy(a); destroy(n);
 abort 999 }
#[test, expected_failure(abort_code = 10, location = vault)]
fun pause_blocks_funding() { let mut s = setup(false, false); let mut v = s.take_shared<Vault<NFT>>(); let a = s.take_from_sender<AdminCap>(); vault::set_paused(&mut v, &a, true); let n = s.take_from_sender<NFT>(); vault::fund(&mut v, &a, n);  abort 999 }
#[test, expected_failure(abort_code = 10, location = vault)]
fun pause_blocks_new_reserve_announcement() { let mut s = setup(true, false); let mut v = s.take_shared<Vault<NFT>>(); let a = s.take_from_sender<AdminCap>(); vault::set_paused(&mut v, &a, true); vault::payload_for_review(&v, 1);  abort 999 }
#[test, expected_failure(abort_code = 5, location = vault)]
fun unfunded_vault_cannot_announce() { let s = setup(false, false); let v = s.take_shared<Vault<NFT>>(); vault::payload_for_review(&v, 1);  abort 999 }
#[test, expected_failure(abort_code = 5, location = vault)]
fun reserve_announcement_cannot_be_sent_twice() { let s = setup(true, true); let v = s.take_shared<Vault<NFT>>(); vault::payload_for_review(&v, 1);  abort 999 }
#[test, expected_failure(abort_code = 5, location = vault)]
fun acknowledgement_before_release_is_rejected() { let s = setup(true, true); let v = s.take_shared<Vault<NFT>>(); vault::payload_for_review(&v, 3);  abort 999 }
#[test, expected_failure(abort_code = 5, location = vault)]
fun release_before_reserve_announcement_is_rejected() { let mut s = setup(true, false); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); let m = message(&v, request(), @0xD); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx());  abort 999 }
#[test, expected_failure(abort_code = 5, location = oapp)]
fun forged_endpoint_cannot_release() { let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); let m = message(&v, request(), @0xD); deliver(&mut v, &o, @0xBAD, 30102, peer(), m, s.ctx());  abort 999 }
#[test, expected_failure(abort_code = 6, location = oapp)]
fun wrong_peer_cannot_release() { let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); let m = message(&v, request(), @0xD); deliver(&mut v, &o, endpoint_address(), 30102, request(), m, s.ctx());  abort 999 }
#[test, expected_failure(abort_code = 0, location = oapp_peer)]
fun wrong_source_chain_cannot_release() { let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); let m = message(&v, request(), @0xD); deliver(&mut v, &o, endpoint_address(), 30416, peer(), m, s.ctx());  abort 999 }
#[test, expected_failure(abort_code = 8, location = vault)]
fun wrong_backing_message_cannot_release() { let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); let m = codec::encode(2, vault::route(&v), request(), request(), peer()); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx());  abort 999 }
#[test, expected_failure(abort_code = 8, location = vault)]
fun wrong_route_message_cannot_release() { let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); let m = codec::encode(2, request(), vault::backing(&v), request(), peer()); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx());  abort 999 }
#[test, expected_failure(abort_code = 8, location = vault)]
fun zero_recipient_cannot_release() { let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); let m = message(&v, request(), @0x0); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx());  abort 999 }
#[test, expected_failure(abort_code = 9, location = vault)]
fun changed_request_cannot_release_twice() { let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); let m = message(&v, request(), @0xD); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx()); let m = message(&v, peer(), @0xD); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx());  abort 999 }
#[test, expected_failure(abort_code = 9, location = vault)]
fun changed_recipient_cannot_release_twice() { let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); let m = message(&v, request(), @0xD); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx()); let m = message(&v, request(), @0xE); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx());  abort 999 }
#[test, expected_failure(abort_code = 100, location = codec)]
fun disposable_protocol_v1_is_rejected() { let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); let mut m = message(&v, request(), @0xD); *m.borrow_mut(0) = 1; deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx());  abort 999 }
#[test, expected_failure(abort_code = 1, location = vault)]
fun publication_from_other_wallet_is_rejected() { let mut s = test_scenario::begin(@0xA); vault::init_for_testing(s.ctx()); abort 999 }
#[test, expected_failure(abort_code = 2, location = vault)]
fun production_registry_rejects_fixture_type() {
    let dev = @0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4;
    let mut s = test_scenario::begin(dev); vault::init_for_testing(s.ctx()); s.next_tx(dev);
    let mut r = s.take_shared<Registry>(); let a = s.take_from_sender<AdminCap>(); vault::create_slot<NFT>(&mut r, &a, s.ctx()); abort 999
}
#[test, expected_failure(abort_code = 5, location = vault)]
fun actual_reserve_send_is_one_shot() {
    let mut s = setup(true, false); let mut v = s.take_shared<Vault<NFT>>(); let mut o = s.take_shared<OApp>();
    let first = vault::send(&mut v, &mut o, 1, vector[], coin::zero<SUI>(s.ctx()), s.ctx()); destroy(first);
    let second = vault::send(&mut v, &mut o, 1, vector[], coin::zero<SUI>(s.ctx()), s.ctx()); destroy(second); abort 999
}
#[test, expected_failure(abort_code = 5, location = vault)]
fun actual_acknowledgement_send_is_one_shot() {
    let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let mut o = s.take_shared<OApp>();
    let m = message(&v, request(), @0xD); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx());
    let first = vault::send(&mut v, &mut o, 3, vector[], coin::zero<SUI>(s.ctx()), s.ctx()); destroy(first);
    let second = vault::send(&mut v, &mut o, 3, vector[], coin::zero<SUI>(s.ctx()), s.ctx()); destroy(second); abort 999
}
#[test, expected_failure(abort_code = 5, location = vault)]
fun second_deposit_is_rejected_even_before_id_check() {
    let mut s = setup(true, false); let mut v = s.take_shared<Vault<NFT>>(); let a = s.take_from_sender<AdminCap>();
    let n = NFT { id: object::new(s.ctx()) }; vault::fund(&mut v, &a, n); abort 999
}
#[test, expected_failure(abort_code = 8, location = vault)]
fun zero_request_is_rejected() { let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); let m = message(&v, bytes32::zero_bytes32(), @0xD); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx()); abort 999 }
#[test, expected_failure(abort_code = 8, location = vault)]
fun acknowledgement_payload_cannot_be_used_as_redemption() { let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); let m = codec::encode(3, vault::route(&v), vault::backing(&v), request(), peer()); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx()); abort 999 }
#[test, expected_failure(abort_code = 100, location = codec)]
fun malformed_message_length_is_rejected() { let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>(); deliver(&mut v, &o, endpoint_address(), 30102, peer(), vector[2,2], s.ctx()); abort 999 }
#[test, expected_failure(abort_code = 5, location = vault)]
fun returned_nft_cannot_reopen_this_route() {
    let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>();
    let m = message(&v, request(), @0xA); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx());
    test_scenario::return_shared(v); test_scenario::return_shared(o); s.next_tx(@0xA);
    let mut v = s.take_shared<Vault<NFT>>(); let a = s.take_from_sender<AdminCap>(); let n = s.take_from_sender<NFT>(); vault::fund(&mut v, &a, n); abort 999
}

#[test, expected_failure(abort_code = 5, location = vault)]
fun funding_before_peer_binding_is_rejected() { let mut s = setup_route(false, false, false); let mut v = s.take_shared<Vault<NFT>>(); let a = s.take_from_sender<AdminCap>(); let n = s.take_from_sender<NFT>(); vault::fund(&mut v, &a, n); abort 999 }

#[test]
fun enforced_options_and_extras_match_in_reserve_quote_and_send() {
    let mut s = setup(true, false); let mut v = s.take_shared<Vault<NFT>>(); let mut o = s.take_shared<OApp>();
    let min = x"00030100110100000000000000000000000000030d40";
    assert_eq!(o.combine_options(30102, 1, vector[]), min);
    assert_eq!(o.combine_options(30102, 3, vector[]), min);
    let extras = x"000301001101000000000000000000000000000186a0";
    let expected = o.combine_options(30102, 1, extras);
    assert!(expected.length() > min.length());
    let q = vault::quote(&v, &o, 1, extras, s.ctx());
    assert_eq!(*endpoint_quote::options(call::param(&q)), expected);
    let send = vault::send(&mut v, &mut o, 1, extras, coin::zero<SUI>(s.ctx()), s.ctx());
    assert_eq!(*endpoint_send::options(call::param(&send)), expected);
    destroy(q); destroy(send); test_scenario::return_shared(v); test_scenario::return_shared(o); s.end();
}
#[test]
fun acknowledgement_uses_its_own_enforced_options() {
    let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let mut o = s.take_shared<OApp>();
    let a = s.take_from_sender<OAppAdminCap>(); let expected = x"000301001101000000000000000000000000000493e0";
    o.set_enforced_options(&a, 30102, 3, expected);
    let m = message(&v, request(), @0xD); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx());
    let q = vault::quote(&v, &o, 3, vector[], s.ctx());
    let send = vault::send(&mut v, &mut o, 3, vector[], coin::zero<SUI>(s.ctx()), s.ctx());
    assert_eq!(*endpoint_quote::options(call::param(&q)), expected);
    assert_eq!(*endpoint_send::options(call::param(&send)), expected);
    destroy(q); destroy(send); test_scenario::return_shared(v); test_scenario::return_shared(o); s.return_to_sender(a); s.end();
}
#[test, expected_failure(abort_code = 3, location = enforced_options)]
fun invalid_caller_options_cannot_bypass_execution_minimum() {
    let mut s = setup(true, false); let v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>();
    let q = vault::quote(&v, &o, 1, vector[0,1], s.ctx()); destroy(q); abort 999
}
#[test, expected_failure(abort_code = 12, location = vault)]
fun empty_admin_options_block_send_instead_of_consuming_one_shot() {
    let mut s = setup(true, false); let mut v = s.take_shared<Vault<NFT>>(); let mut o = s.take_shared<OApp>();
    let a = s.take_from_sender<OAppAdminCap>(); o.set_enforced_options(&a, 30102, 1, vector[0,3]);
    let send = vault::send(&mut v, &mut o, 1, vector[], coin::zero<SUI>(s.ctx()), s.ctx()); destroy(send); abort 999
}

#[test]
fun v2_wire_bytes_match_evm_golden_messages() {
    let route = bytes32::from_address(@0x000000000000000000000000000000000000000000000000000000000000beef);
    let nft = bytes32::from_address(@0x046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba);
    let request = bytes32::from_address(@0x0000000000000000000000000000000000000000000000000000000000c0ffee);
    let recipient = bytes32::from_address(@0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4);
    let encoded = codec::encode(1, route, nft, bytes32::zero_bytes32(), bytes32::zero_bytes32());
    assert_eq!(encoded, x"0201000000000000000000000000000000000000000000000000000000000000beef046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
    let (kind, r, n, req, to) = codec::decode(&encoded);
    assert_eq!(kind, 1); assert_eq!(r, route); assert_eq!(n, nft);
    assert_eq!(req, bytes32::zero_bytes32()); assert_eq!(to, bytes32::zero_bytes32());
    let encoded = codec::encode(2, route, nft, request, recipient);
    assert_eq!(encoded, x"0202000000000000000000000000000000000000000000000000000000000000beef046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba0000000000000000000000000000000000000000000000000000000000c0ffee485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4");
    let (kind, r, n, req, to) = codec::decode(&encoded);
    assert_eq!(kind, 2); assert_eq!(r, route); assert_eq!(n, nft);
    assert_eq!(req, request); assert_eq!(to, recipient);
    let encoded = codec::encode(3, route, nft, request, recipient);
    assert_eq!(encoded, x"0203000000000000000000000000000000000000000000000000000000000000beef046da2a9e15bd822ba0491d978947cc1bfb1fd30e6f813a5fb10b9b2b1d6a6ba0000000000000000000000000000000000000000000000000000000000c0ffee485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4");
    let (kind, r, n, req, to) = codec::decode(&encoded);
    assert_eq!(kind, 3); assert_eq!(r, route); assert_eq!(n, nft);
    assert_eq!(req, request); assert_eq!(to, recipient);
}

#[test, expected_failure(abort_code = 12, location = vault)]
fun reserve_send_rejects_nonzero_native_receive_value() {
    let mut s = setup(true, false); let mut v = s.take_shared<Vault<NFT>>(); let mut o = s.take_shared<OApp>();
    let options = x"000301002101000000000000000000000000000186a000000000000000000000000000000001";
    let send = vault::send(&mut v, &mut o, 1, options, coin::zero<SUI>(s.ctx()), s.ctx()); destroy(send); abort 999
}
#[test, expected_failure(abort_code = 12, location = vault)]
fun acknowledgement_quote_rejects_nonzero_native_receive_value() {
    let mut s = setup(true, true); let mut v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>();
    let m = message(&v, request(), @0xD); deliver(&mut v, &o, endpoint_address(), 30102, peer(), m, s.ctx());
    let options = x"000301002101000000000000000000000000000186a000000000000000000000000000000001";
    let q = vault::quote(&v, &o, 3, options, s.ctx()); destroy(q); abort 999
}
#[test, expected_failure(abort_code = 12, location = vault)]
fun admin_policy_cannot_attach_native_receive_value() {
    let mut s = setup(true, false); let v = s.take_shared<Vault<NFT>>(); let mut o = s.take_shared<OApp>();
    let a = s.take_from_sender<OAppAdminCap>();
    o.set_enforced_options(&a, 30102, 1, x"00030100210100000000000000000000000000030d4000000000000000000000000000000001");
    let q = vault::quote(&v, &o, 1, vector[], s.ctx()); destroy(q); abort 999
}
#[test, expected_failure(abort_code = 12, location = vault)]
fun malformed_merged_option_is_rejected() {
    let mut s = setup(true, false); let v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>();
    let q = vault::quote(&v, &o, 1, x"000301002101", s.ctx()); destroy(q); abort 999
}
#[test, expected_failure(abort_code = 12, location = vault)]
fun unsupported_worker_option_is_rejected() {
    let mut s = setup(true, false); let v = s.take_shared<Vault<NFT>>(); let o = s.take_shared<OApp>();
    let q = vault::quote(&v, &o, 1, x"000302001101000000000000000000000000000186a0", s.ctx()); destroy(q); abort 999
}
#[test, expected_failure(abort_code = 12, location = vault)]
fun admin_policy_below_receive_gas_floor_is_rejected() {
    let mut s = setup(true, false); let v = s.take_shared<Vault<NFT>>(); let mut o = s.take_shared<OApp>();
    let a = s.take_from_sender<OAppAdminCap>();
    o.set_enforced_options(&a, 30102, 1, x"00030100110100000000000000000000000000000001");
    let q = vault::quote(&v, &o, 1, vector[], s.ctx()); destroy(q); abort 999
}
#[test]
fun explicit_zero_receive_value_preserves_quote_and_send_options() {
    let mut s = setup(true, false); let mut v = s.take_shared<Vault<NFT>>(); let mut o = s.take_shared<OApp>();
    let options = x"000301002101000000000000000000000000000186a000000000000000000000000000000000";
    let expected = o.combine_options(30102, 1, options);
    let q = vault::quote(&v, &o, 1, options, s.ctx());
    let send = vault::send(&mut v, &mut o, 1, options, coin::zero<SUI>(s.ctx()), s.ctx());
    assert_eq!(*endpoint_quote::options(call::param(&q)), expected);
    assert_eq!(*endpoint_send::options(call::param(&send)), expected);
    destroy(q); destroy(send); test_scenario::return_shared(v); test_scenario::return_shared(o); s.end();
}
