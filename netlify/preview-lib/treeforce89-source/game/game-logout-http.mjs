/**
 * Server-only logout HTTP adapter. Revokes the authenticated game-session
 * bearer token; a separate authenticated operation is required to revoke
 * wallet-login credentials. Never accept a wallet address or session ID
 * supplied by the browser as authority.
 *
 * This adapter is not connected to the public Netlify function.
 */
export function createGameLogoutHttpHandler({revoker}) {
  if (typeof revoker?.revoke !== "function") {
    throw new Error("Trusted credential revocation service required");
  }
  return async function handle(request) {
    const headers = {"Cache-Control":"no-store","Content-Type":"application/json"};
    if (request.method !== "POST") {
      return Response.json({error:"Method not allowed"},{status:405,headers:{...headers,Allow:"POST"}});
    }
    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(request.url).origin;
    if (origin && origin !== expectedOrigin) {
      return Response.json({error:"Origin not permitted"},{status:403,headers});
    }
    const authorization = request.headers.get("authorization") || "";
    const match = /^Bearer ([a-f0-9]{64})$/.exec(authorization);
    if (!match) {
      return Response.json({error:"Game session authentication required"},{status:401,headers});
    }
    // No browser-supplied wallet, run, digest or session identifier is needed.
    // Refuse any body even if Content-Length is absent.
    if (await request.text()) {
      return Response.json({error:"No client game-state payload permitted"},{status:400,headers});
    }
    try {
      const result = await revoker.revoke({sessionToken:match[1]});
      // Logout is idempotent: an already expired/revoked token is not a leak.
      return Response.json({loggedOut:true},{status:200,headers});
    } catch {
      // Fail closed: never claim logout succeeded when DB revocation failed.
      return Response.json({loggedOut:false,error:"Logout unavailable"},{status:503,headers});
    }
  };
}
