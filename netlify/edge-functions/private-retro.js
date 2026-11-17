// Scoped HTTP Basic gate for the private retro *launcher* only.
// The copyrighted C64 disk image is intentionally never served from this site.
export default async function retroAccess(request, context) {
  const password = Netlify.env.get("TREE_PRIVATE_RETRO_PASSWORD");
  if (!password) {
    return new Response("Private retro access is not configured.", {
      status: 503, headers: { "Content-Type":"text/plain; charset=utf-8", "Cache-Control":"private, no-store" }
    });
  }
  const auth = request.headers.get("authorization") || "";
  let allowed = false;
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const separator = decoded.indexOf(":");
      const user = decoded.slice(0, separator);
      const supplied = decoded.slice(separator + 1);
      allowed = separator >= 0 && user === "tree" && supplied === password;
    } catch (_error) {
      allowed = false;
    }
  }
  if (!allowed) {
    return new Response("Private TREE Arcade reference. Sign in using your personal credentials.", {
      status: 401,
      headers: {
        "Content-Type":"text/plain; charset=utf-8",
        "WWW-Authenticate":'Basic realm="TREE private retro game", charset="UTF-8"',
        "Cache-Control":"private, no-store",
        "Vary":"Authorization",
        "X-Robots-Tag":"noindex, nofollow"
      }
    });
  }
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("Vary", "Authorization");
  return new Response(response.body, {status:response.status,statusText:response.statusText,headers});
}
export const config = {
  path: ["/play/heart-of-africa-private", "/play/heart-of-africa-private/*"]
};
