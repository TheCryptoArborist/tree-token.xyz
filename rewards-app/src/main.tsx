import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { dAppKit } from "./dapp-kit";

const HolderApp = lazy(() => import("./HolderApp").then((module) => ({ default: module.HolderApp })));
const ManageApp = lazy(() => import("./ManageApp").then((module) => ({ default: module.ManageApp })));
const LegacyApp = lazy(() => Promise.all([import("./App"), import("./styles.css")]).then(([module]) => ({ default: module.App })));
const params = new URLSearchParams(window.location.search);
const Page = params.has("advanced") || params.has("sponsor") ? LegacyApp : params.has("manage") ? ManageApp : HolderApp;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DAppKitProvider dAppKit={dAppKit}>
      <Suspense fallback={<p style={{ padding: "3rem", color: "#dcfce7", background: "#081b16", minHeight: "100vh", margin: 0 }}>Opening NFTree Rewards…</p>}>
        <Page />
      </Suspense>
    </DAppKitProvider>
  </StrictMode>,
);

