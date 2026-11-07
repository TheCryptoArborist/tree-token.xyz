import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { CONFIG } from "./config";

export const dAppKit = createDAppKit({
  networks: [CONFIG.network],
  defaultNetwork: CONFIG.network,
  autoConnect: true,
  storageKey: "tree-nftree-rewards-wallet",
  createClient: () =>
    new SuiGrpcClient({
      network: CONFIG.network,
      baseUrl: CONFIG.grpcUrl,
    }),
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}

