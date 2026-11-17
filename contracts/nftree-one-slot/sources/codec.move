module nftree_one_slot::codec;
use utils::bytes32::{Self, Bytes32};
const EInvalid: u64 = 100;
// Version, kind, route, backing NFT, request, recipient. Exactly 130 bytes.
public fun encode(kind: u8, route: Bytes32, nft: Bytes32, request: Bytes32, recipient: Bytes32): vector<u8> {
    assert!(kind >= 1 && kind <= 3, EInvalid);
    let mut out = vector[2u8, kind];
    out.append(route.to_bytes()); out.append(nft.to_bytes());
    out.append(request.to_bytes()); out.append(recipient.to_bytes());
    out
}
public fun decode(message: &vector<u8>): (u8, Bytes32, Bytes32, Bytes32, Bytes32) {
    assert!(message.length() == 130 && message[0] == 2, EInvalid);
    let kind = message[1];
    assert!(kind >= 1 && kind <= 3, EInvalid);
    (kind, word(message, 2), word(message, 34), word(message, 66), word(message, 98))
}
fun word(message: &vector<u8>, offset: u64): Bytes32 {
    bytes32::from_bytes(vector::tabulate!(32, |i| message[offset + i]))
}
