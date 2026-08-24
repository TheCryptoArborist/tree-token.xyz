import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: resolve(projectRoot, "yield-vacuum-src"),
  base: "/topaz-yield-vacuum/",
  esbuild: { jsx: "automatic" },
  build: {
    outDir: resolve(projectRoot, "topaz-yield-vacuum"),
    emptyOutDir: true,
  },
});
