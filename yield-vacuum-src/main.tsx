import React from "react";
import ReactDOM from "react-dom/client";
import YieldVacuumGame from "./Game";
import "./globals.css";
import "./usdt.css";
import "./splash.css";
import "./mission-games.css";
import "./briefing-readability.css";
import "./leaderboard.css";
import "./tree-host.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <YieldVacuumGame />
  </React.StrictMode>,
);
