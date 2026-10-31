/**
 * TREE FORCE '89 same-origin API reservation for TREE Token deploy previews.
 * No wallet credential, session, NFT ownership or payment is processed.
 * Never forward tokens/signatures to the old treeforce89.netlify.app origin.
 *
 * Intentionally kept in netlify/preview-functions, NOT production functions.
 */
export default async function handler(request: Request): Promise<Response> {
  const headers = {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
    'Content-Type': 'application/json',
  };
  if (request.method !== 'POST') {
    return Response.json({enabled:false,error:'Method not allowed'},{
      status:405,headers:{...headers,Allow:'POST'},
    });
  }
  return Response.json({
    enabled:false,
    authorized:false,
    error:'TREE FORCE same-origin authentication is not enabled in this preview.',
  },{status:503,headers});
}
