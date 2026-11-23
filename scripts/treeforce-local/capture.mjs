// Read-only capture of the current delivered game, including its transitive modules.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const root = path.resolve(process.argv[2] || "release/treeforce-baseline");
const origin = "https://tree-token.xyz";
const queue = ["/play/treeforce89/"];
const files = {};
while (queue.length) {
  const url = new URL(queue.shift(), origin),
    key = url.pathname;
  if (files[key]) continue;
  if (url.origin !== origin || key.includes("/api/"))
    throw Error("Not a static asset: " + url);
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const dest = key.endsWith("/") ? key + "index.html" : key;
  await fs.mkdir(path.dirname(root + dest), { recursive: true });
  await fs.writeFile(root + dest, bytes);
  files[key] = {
    path: dest,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
  if (/\.(?:js|css|html)$/.test(dest)) {
    const text = bytes.toString();
    const refs = [
      ...text.matchAll(
        /["'`]((?:\.\/|\/)[^"'`\s{}<>]+\.(?:js|css|png|jpg|webp|svg|mp3|ogg|woff2))["'`]/g,
      ),
    ].map((m) => new URL(m[1], url).pathname);
    // CSS url() also allows unquoted URLs.
    refs.push(...[...text.matchAll(/url\((\/[\w/.-]+)\)/g)].map((m) => m[1]));
    for (const ref of refs) if (!files[ref]) queue.push(ref);
  }
}
await fs.writeFile(
  root + "/manifest.json",
  JSON.stringify(
    { origin, capturedAt: new Date().toISOString(), files },
    null,
    2,
  ) + "\n",
);
console.log(`Captured ${Object.keys(files).length} static assets at ${root}`);
