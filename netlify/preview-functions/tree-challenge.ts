import build from '../generated/treeforce89-context.json' with {type:'json'};
import {createIntegratedGatewayHandler} from '../preview-lib/treeforce89-gateway.mjs';
export default createIntegratedGatewayHandler({action:'challenge',build});
export const config={rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:10}};
