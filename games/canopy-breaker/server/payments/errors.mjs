const reasons=Object.freeze({
 SIGNED_FORMAT:['The wallet returned an unsupported signed transaction. No payment was submitted.',422],
 INVOICE_MISMATCH:['The signed transaction does not match this TREE checkout. Cancel the unpaid checkout and review a new one.',422],
 GAS_OWNER:['The signed transaction uses a different gas payer. This checkout requires the connected wallet to pay its own SUI gas.',422],
 GAS_BUDGET:['The signed gas budget must be greater than zero and at most 0.05 SUI. No payment was submitted.',422],
 GAS_MODE:['This gas-payment format is not supported by the current Sui network. No payment was submitted.',422],
 GAS_REPLAY:['The address-balance gas transaction has missing, expired or wrong-network replay protection. Cancel the unpaid checkout and create a new one.',422],
 GAS_LOOKUP:['Sui gas verification is temporarily unavailable. Check purchase status before retrying.',503],
 GAS_BALANCE:['The wallet’s SUI address balance does not cover its signed gas budget. No payment was submitted.',422],
 TRANSFER_COMMANDS:['The wallet transaction contains commands outside the reviewed TREE transfer. No payment was submitted.',422],
 TRANSFER_INPUTS:['The wallet transaction uses an unsupported payment input layout. No payment was submitted.',422],
 TRANSFER_RESULT:['The wallet transaction uses an unsupported transfer result. No payment was submitted.',422],
 TRANSFER_AMOUNT:['The signed TREE amount or recipient differs from the checkout. No payment was submitted.',422],
 COIN_INPUTS:['The wallet transaction contains unsupported or duplicate coin inputs. No payment was submitted.',422],
 SIGNATURE_INVALID:['The wallet signature does not verify for this transaction and wallet. No payment was submitted.',422],
 SIGNATURE_LOOKUP:['Sui signature verification is temporarily unavailable. Check purchase status before retrying.',503],
 COIN_LOOKUP:['Sui coin verification is temporarily unavailable. Check purchase status before retrying.',503],
 COIN_CHANGED:['A TREE or SUI coin changed after wallet approval. Cancel the unpaid checkout and create a new one.',409]
});
export function paymentError(code,cause){const spec=reasons[code];if(!spec)throw Error('Unknown payment error code');return Object.assign(new Error(spec[0],cause?{cause}:undefined),{paymentCode:code,paymentStatus:spec[1]});}
export function publicPaymentError(error){const spec=reasons[error?.paymentCode];return spec?{code:error.paymentCode,error:spec[0],status:spec[1]}:null;}
// Only file basename and numeric position are retained; never emit a raw stack.
export function paymentDiagnostic(error){
 const cause=error?.cause||error;
 const allowed=new Set(['Error','TypeError','RangeError','SyntaxError','AggregateError']);
 const out={errorType:allowed.has(cause?.name)?cause.name:'Error',...(/^\d{1,20}$/.test(error?.gasBudgetMist??'')?{gasBudgetMist:error.gasBudgetMist}:{}),...(Number.isInteger(error?.gasPaymentCount)&&error.gasPaymentCount>=0&&error.gasPaymentCount<=256?{gasPaymentCount:error.gasPaymentCount}:{})};
 const files=new Set(['http.mjs','signed.mjs','ledger.mjs','runtime.mjs','errors.mjs','gas.mjs','canopy-access.mjs','canopy-access.js','index.mjs','index.js']);
 for(const line of String(cause?.stack||'').split('\n').slice(1)){
  const match=line.match(/(?:\/|\b)([A-Za-z0-9_-]+\.(?:mjs|js)):(\d+):(\d+)/);
  if(match&&files.has(match[1])){out.source={file:match[1],line:Number(match[2]),column:Number(match[3])};break;}
 }
 return out;
}
