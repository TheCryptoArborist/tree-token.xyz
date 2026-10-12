import {createScopedCommerce} from './scoped-commerce.mjs';
import {platformDatabase} from './platform-database.mjs';
import {createFlightStorage} from './flight-storage.mjs';
import {createPaidDelivery,withPaidDelivery} from './paid-delivery.mjs';
import {withPurchaseRecovery} from './purchase-recovery.mjs';
import {DIRECT_CONTINUE} from './continue-product.mjs';

export const PLATFORM_SETTINGS=Object.freeze({authOrigin:'https://deploy-preview-48--tree-token.netlify.app',environment:'release-candidate'});
/** Uses SUPABASE_DB_URL from the hosted runtime, with fixed per-operation roles.
 * No custom logins, password rotation, setup bearer or owner installer is needed.
 * Actual checkout configuration remains unset; no signer or chain data is faked.
 */
export function createPlatformRuntime({pool,auxiliaryPool=pool,settings=PLATFORM_SETTINGS,configuration=null,authorizeQuote,verifyPayment,discover}={}){
 const unavailable=()=>{throw Object.assign(Error('checkout-not-enabled'),{code:'checkout-not-enabled'});};
 if(configuration && (!configuration.deployment||(configuration.deployment.paymentMethod!=='tree-transfer-v1'&&typeof authorizeQuote!=='function')||typeof verifyPayment!=='function'||typeof discover!=='function'))throw Error('platform-checkout-dependencies-required');
 const config=configuration?structuredClone(configuration):{paymentsEnabled:false,deployment:null,metadata:{network:DIRECT_CONTINUE.network,coinType:DIRECT_CONTINUE.coinType,decimals:6}};
 // Storage reads made while an order holds its row lock must have an independent
 // connection allowance, so concurrent order retries cannot exhaust their pool.
 const storage=createFlightStorage(platformDatabase(auxiliaryPool,'storage'),settings);
 // Separate logical adapters, one existing platform-managed connection pool.
 const orderPool={connect:()=>pool.connect()},settlementPool={connect:()=>pool.connect()};
 const commerce=createScopedCommerce({orderPool,settlementPool,settings,platformRoleSwitch:true,
  resolveFlight:(actor,run)=>config.deployment?.paymentMethod==='tree-transfer-v1'?storage.resolveSavedFlight(actor,run):storage.resolveValidatedFlight(actor,run),loadConfiguration:async()=>structuredClone(config),
  authorizeQuote:authorizeQuote||unavailable,verifyPayment:verifyPayment||unavailable});
 const purchases=withPaidDelivery(commerce,createPaidDelivery(platformDatabase(auxiliaryPool,'delivery'),settings));
 return withPurchaseRecovery(purchases,{db:platformDatabase(auxiliaryPool,'recovery'),discover:discover||unavailable,...settings});
}
