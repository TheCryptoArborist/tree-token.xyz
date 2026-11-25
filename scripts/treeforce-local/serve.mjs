// Local static inspection only. Never forwards writes, credentials, or chain requests.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(process.argv[2] || "release/treeforce-baseline"),
  port = Number(process.argv[3] || 4173);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost"),
      name = decodeURIComponent(url.pathname);
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Local review: writes and payments are disabled.",
        }),
      );
      return;
    }
    if (name.includes("/api/") || name.endsWith("/session-refresh")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            "Local review requires simulated authentication; production is not contacted.",
          entries: [],
        }),
      );
      return;
    }
    if (name === "/__local/practice") {
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Content-Security-Policy": "connect-src 'self'; form-action 'none'",
      });
      res.end(await fs.readFile(new URL("./practice.html", import.meta.url)));
      return;
    }
    const file = path.resolve(
      root,
      "." + name + (name.endsWith("/") ? "index.html" : ""),
    );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const data = await fs.readFile(file);
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "connect-src 'self'; form-action 'none'",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(404);
      res.end("Not captured: " + name);
    }
  })
  .listen(port, "0.0.0.0", () =>
    console.log(
      `Local review: http://127.0.0.1:${port}/play/treeforce89/ (${root})`,
    ),
  );
