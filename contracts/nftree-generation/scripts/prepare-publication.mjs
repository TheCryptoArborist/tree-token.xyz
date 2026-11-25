import {writeFile} from 'node:fs/promises';
import {preparePacket} from './publication-packet.mjs';
if(process.argv.length!==3)throw Error('Usage: node --use-env-proxy prepare-publication.mjs NEW_OUTPUT_FILE');
const packet=await preparePacket();
await writeFile(process.argv[2],JSON.stringify(packet,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({estimatedNetGasMist:packet.estimatedNetGasMist,gasBudgetMist:packet.gasBudgetMist,preparedAt:packet.preparedAt,transactionKindSha256:packet.transactionKindSha256,signingEnabled:false,depositIncluded:false},null,2));
