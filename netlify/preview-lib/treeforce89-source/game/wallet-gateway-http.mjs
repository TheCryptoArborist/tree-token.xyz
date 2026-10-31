import {previewAccessAllowed} from './preview-access.mjs';
import {normalizeSuiAddress} from './tree-payment.mjs';

const headers = {'Cache-Control':'no-store','X-Robots-Tag':'noindex'};
const response = (body,status) => Response.json(body,{status,headers});

async function readInput(request,allowed) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw Error('JSON required');
  const reader = request.body?.getReader();
  if (!reader) throw Error('JSON required');
  let size=0;
  const chunks=[];
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      size+=value.byteLength;
      if(size>4096){await reader.cancel();throw Error('Request too large');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const input=JSON.parse(new TextDecoder().decode(bytes));
  if(!input || Array.isArray(input) || typeof input!=='object' ||
    Object.keys(input).length!==allowed.length || !allowed.every(key=>typeof input[key]==='string')) throw Error('Invalid fields');
  input.wallet=normalizeSuiAddress(input.wallet);
  return input;
}

export function createWalletGatewayHttpHandler({action,build,getService}) {
  return async function handler(request,context) {
    if(!previewAccessAllowed(build,context,request))return response({enabled:false},503);
    if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers:{...headers,Allow:'POST'}});
    const origin=new URL(request.url).origin;
    if(request.headers.get('origin')!==origin || request.headers.get('sec-fetch-site')==='cross-site')
      return response({error:'Use this game’s own sign-in page.'},403);
    let input;
    try {input=await readInput(request,action==='challenge' ? ['wallet'] : ['wallet','nonce','signature']);}
    catch {return response({error:'Invalid sign-in request.'},400);}
    try {
      const service=await getService(origin);
      if(action==='challenge')return response(await service.issue(input),201);
      return response(await service.enter(input),201);
    } catch(error) {
      // Never echo database errors, signatures, tokens, or holdings.
      const messages={
        SIGN_IN_REJECTED:['Sign-in could not be verified. Please sign a new message.',401],
        NFTREE_REQUIRED:['No directly owned NFTree was found in the signing wallet. Kiosk holdings are not supported in this preview.',403],
        VERIFICATION_UNAVAILABLE:['NFTree verification is temporarily unavailable. Please retry.',503],
      };
      if(action!=='challenge' && Object.hasOwn(messages,error?.code)) {
        const [message,status]=messages[error.code];
        return response({error:message,code:error.code},status);
      }
      return response({error:action==='challenge'
        ? 'Sign-in is temporarily unavailable. Please try again.'
        : 'Access could not be verified. Use the signing wallet with a directly owned NFTree and try again.'},
        action==='challenge' ? 503 : 403);
    }
  };
}
