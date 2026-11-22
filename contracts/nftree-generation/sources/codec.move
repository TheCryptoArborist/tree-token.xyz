/// Wire v3: version, kind, route, NFT, generation (u64 big endian), request, recipient.
/// The foreign ERC721 token ID is exactly generation. No legacy wire is accepted.
module nftree_generation::codec;
use utils::bytes32::{Self, Bytes32};
const EInvalid: u64 = 100;
public fun encode(kind: u8, route: Bytes32, nft: Bytes32, generation: u64, request: Bytes32, recipient: Bytes32): vector<u8> {
    assert!(kind >= 1 && kind <= 4 && generation > 0, EInvalid);
    let mut out = vector[3u8, kind];
    out.append(route.to_bytes()); out.append(nft.to_bytes());
    let mut i = 8u8;
    while (i > 0) { i = i - 1; out.push_back(((generation >> (i * 8)) & 255) as u8) };
    out.append(request.to_bytes()); out.append(recipient.to_bytes()); out
}
public fun decode(message: &vector<u8>): (u8, Bytes32, Bytes32, u64, Bytes32, Bytes32) {
    assert!(message.length() == 138 && message[0] == 3, EInvalid);
    let kind = message[1];
    assert!(kind >= 1 && kind <= 4, EInvalid);
    let mut generation = 0u64;
    let mut i = 66;
    while (i < 74) { generation = (generation << 8) | (message[i] as u64); i = i + 1 };
    assert!(generation > 0, EInvalid);
    (kind, word(message, 2), word(message, 34), generation, word(message, 74), word(message, 106))
}
fun word(message: &vector<u8>, offset: u64): Bytes32 {
    bytes32::from_bytes(vector::tabulate!(32, |i| message[offset + i]))
}
