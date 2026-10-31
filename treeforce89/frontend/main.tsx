import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import NFTreeGateway from "../app/NFTreeGateway";
import PassiveWalletDiagnostics from "../app/PassiveWalletDiagnostics";
import ConnectionOnlyDiagnostics from "../app/ConnectionOnlyDiagnostics";
import "../app/globals.css";
import {DAppKitProvider} from '@mysten/dapp-kit-react';
import {dAppKit} from '../app/dapp-kit';

function App() {
  return (
    <main className="site-shell">
      <section className="game-frame" aria-label="TREE FORCE '89: Canopy Command">
        <header className="game-header">
          <span className="game-title">TREE FORCE ’89</span>
          <span className="game-subtitle">CANOPY COMMAND</span>
        </header>
        <nav className="game-navigation" aria-label="Game navigation">
          <a className="game-arcade-link" href="/play/">← Back to Arcade</a>
          <a className="game-buy-tree" href="/dapp/#swap" target="_blank" rel="noopener noreferrer">Buy TREE ↗</a>
        </nav>
        <div className="screen-bezel">
          {new URLSearchParams(window.location.search).get("walletDiagnostics")==="passive" ? <div className="game-viewport"><PassiveWalletDiagnostics /></div> : new URLSearchParams(window.location.search).get("walletDiagnostics")==="connect" ? <div className="game-viewport"><ConnectionOnlyDiagnostics /></div> : <NFTreeGateway />}
        </div>
        <footer className="game-controls">
          <span>MOVE A/D · ←/→</span>
          <span>FIRE Z/X · HOLD OR AUTO</span>
          <span>SHIELD SPACE · PAUSE ESC</span>
        </footer>
      </section>
      <p className="build-label">v0.5.8</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><DAppKitProvider dAppKit={dAppKit}><App /></DAppKitProvider></StrictMode>,
);
