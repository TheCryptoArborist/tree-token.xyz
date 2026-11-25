import {writeFile} from 'node:fs/promises';
import {prepareHandoff} from './wallet-handoff.mjs';
if(process.argv.length!==3)throw Error('Usage: node --use-env-proxy prepare-wallet-handoff.mjs NEW_OUTPUT_FILE');
const packet=await prepareHandoff();
await writeFile(process.argv[2],JSON.stringify(packet,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({transactionSha256:packet.transactionSha256,estimatedNetGasMist:packet.estimatedNetGasMist,authorized:false,submitted:false}));
