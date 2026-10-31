import path from 'node:path';
import { fileURLToPath } from 'node:url';
const rootDir = fileURLToPath(new URL('.', import.meta.url));
export default {
  root: rootDir,
  publicDir: false,
  build: {
    emptyOutDir: true,
    sourcemap: false,
    license: { fileName: 'third-party-licenses.md' },
    lib: { entry: path.resolve(rootDir, 'wallet-mint.js'), formats: ['iife'],
      name: 'NFTreeWalletMintBundle', fileName: () => 'nftree-wallet-mint.js' },
    outDir: path.resolve(rootDir, 'build'),
    rollupOptions: { output: { extend: true } },
  },
};
