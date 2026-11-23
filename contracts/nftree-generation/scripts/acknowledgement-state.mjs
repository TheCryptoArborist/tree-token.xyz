import {C,canonical} from './configuration-encoding.mjs';import {validateConfigState} from './configuration-review.mjs';
import delivered from '../../../docs/multichain/generation-milestone/return-completed/sui-state.json' with {type:'json'};
import unbound from '../../../docs/multichain/generation-milestone/configuration-review/baseline.json' with {type:'json'};
import bound from '../../../docs/multichain/generation-milestone/binding-completed/user-receipt.json' with {type:'json'};
const check=(v,m)=>{if(!v)throw Error(m);};
export function validateAcknowledgementState(s,ack=false){
 check(s.chainIdentifier===C.chain,'Wrong Sui chain');const expected=structuredClone(delivered.data.vault.asMoveObject.contents.json);expected.ack_sent=ack;check(canonical(s.vault.asMoveObject.contents.json)===canonical(expected),'Vault is not in the expected first acknowledgement state');
 for(const n of ['oapp','channel'])check(canonical(s[n].asMoveObject.contents.json)===canonical(bound.current[n].asMoveObject.contents.json),'Bound '+n+' changed');
 const normalized=structuredClone(s);for(const n of ['vault','oapp','channel'])normalized[n].asMoveObject.contents.json=structuredClone(unbound[n].asMoveObject.contents.json);validateConfigState(normalized,1);
}
export function validateAcknowledgementBefore(p){validateAcknowledgementState(p.current);const n=p.candidate.nft;check(n.address===C.nft&&n.owner?.address?.address===C.sender&&n.asMoveObject.contents.type.repr===C.nftType&&n.asMoveObject.contents.json.number==='2720','Original identity or ownership changed');check(p.bnb?.complete&&p.bnb.sourceVerified&&p.bnb.state==='Locked'&&p.bnb.purchasesPaused&&!p.bnb.canPlay,'BNB must remain locked');}
