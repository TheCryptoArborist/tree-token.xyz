"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Phase = "splash" | "briefing" | "playing" | "results";
type DropKind = "route" | "emission" | "fee" | "crystal" | "vote" | "incentive" | "hazard";
type Metric = "routes" | "lpBalance" | "crystals" | "votes" | "fees" | "incentives" | "claims";

const ASSET_BASE = "/topaz-yield-vacuum/";

type Drop = {
  x: number;
  y: number;
  speed: number;
  drift: number;
  size: number;
  kind: DropKind;
  asset: number;
  spin: number;
  correct?: boolean;
};

type Mission = {
  title: string;
  feature: string;
  action: string;
  mechanic: string;
  time: number;
  target: number;
  minPools: number;
  metric: Metric;
  lesson: string;
  fact: string;
  factUrl: string;
};

const POOLS = [
  { name: "BTC", src: `${ASSET_BASE}fee-btc.png` },
  { name: "ETH", src: `${ASSET_BASE}fee-eth.png` },
  { name: "SOL", src: `${ASSET_BASE}fee-sol.png` },
  { name: "BNB", src: `${ASSET_BASE}fee-bnb.png` },
  { name: "USDT", src: `${ASSET_BASE}fee-usdt.png` },
  { name: "USDC", src: `${ASSET_BASE}fee-usdc.png` },
];

const FEE_GLOWS = ["#f7931a", "#aab4c7", "#27f3c3", "#f3ba2f", "#26a17b", "#2775ca"];

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  centerX: number,
  centerY: number,
  maxWidth: number,
  maxHeight: number,
) {
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
}

const MISSIONS: Mission[] = [
  {
    title: "SWAP ROUTE",
    feature: "SWAPS & ROUTING",
    action: "VALID ROUTES",
    mechanic: "Compare live quotes. Capture only routes marked BEST ROUTE; reject HIGH IMPACT paths.",
    time: 50,
    target: 12,
    minPools: 3,
    metric: "routes",
    lesson: "Topaz compares v2 and Slipstream pools and can use multi-hop routes to seek the cheapest end-to-end path.",
    fact: "The Topaz frontend uses a mixed-route quoter to compare v2 and Slipstream pools. A swap may route through WBNB, USDT, or USDC, and each hop charges its pool fee.",
    factUrl: "https://www.topazdex.com/docs/trading/swaps",
  },
  {
    title: "LP LAB",
    feature: "STAKED VS UNSTAKED LP",
    action: "BOTH LP PATHS",
    mechanic: "Balance two positions: left collects in-range TOPAZ emissions; right collects unstaked swap fees.",
    time: 50,
    target: 9,
    minPools: 3,
    metric: "lpBalance",
    lesson: "Neither lane can replace the other. Reach 9 in-range emissions AND 9 unstaked swap fees.",
    fact: "Staking trades swap fees for TOPAZ emissions. Unstaked Slipstream positions retain fees, earn no emissions, and can be subject to an extra unstaked-position fee.",
    factUrl: "https://www.topazdex.com/docs/liquidity/staking",
  },
  {
    title: "LOCK POWER",
    feature: "veTOPAZ LOCKS",
    action: "TOPAZ POWER",
    mechanic: "Choose a TOPAZ amount and lock duration. Watch both inputs change simulated voting power.",
    time: 38,
    target: 12,
    minPools: 0,
    metric: "crystals",
    lesson: "Locking more TOPAZ builds more voting power. A longer lock duration increases it further.",
    fact: "A veTOPAZ lock is an NFT. More locked TOPAZ increases that NFT's voting power, while deeper protocol-wide locking is designed to reinforce long-term alignment and affects the rebase calculation.",
    factUrl: "https://www.topazdex.com/docs/tokenomics/vetopaz",
  },
  {
    title: "GAUGE VOTE",
    feature: "GAUGE VOTING",
    action: "GAUGE SIGNALS",
    mechanic: "Distribute a limited 12-vote budget among gauges with different liquidity needs.",
    time: 42,
    target: 12,
    minPools: 0,
    metric: "votes",
    lesson: "veTOPAZ votes direct weekly TOPAZ emissions toward selected liquidity gauges.",
    fact: "Every active liquidity pool can have a gauge. Its share of weekly TOPAZ emissions is proportional to the veTOPAZ votes it receives.",
    factUrl: "https://www.topazdex.com/docs/gauges",
  },
  {
    title: "FEE VACUUM",
    feature: "VOTED-POOL FEES",
    action: "TRADING FEES",
    mechanic: "Compare live pool activity. Select the highest valid volume and reject high-impact activity.",
    time: 45,
    target: 8,
    minPools: 0,
    metric: "fees",
    lesson: "Trading fees from pools you vote for accrue to veTOPAZ voters and become claimable after the epoch flips.",
    fact: "A voter's fee share depends on pool trading activity and their share of the gauge vote. Rewards are not fixed or guaranteed.",
    factUrl: "https://www.topazdex.com/docs/liquidity/fees",
  },
  {
    title: "INCENTIVE RUSH",
    feature: "PROJECT INCENTIVES",
    action: "INCENTIVES",
    mechanic: "Read each project package and route it to the named gauge—or reject it when expired.",
    time: 45,
    target: 8,
    minPools: 0,
    metric: "incentives",
    lesson: "Projects can post incentives to attract veTOPAZ votes toward their gauges.",
    fact: "Projects can add token incentives to a gauge to attract votes. These incentives are separate from the pool's trading fees.",
    factUrl: "https://www.topazdex.com/docs/gauges",
  },
  {
    title: "EPOCH FLIP",
    feature: "WEEKLY CLAIM CYCLE",
    action: "CLAIM BUNDLE",
    mechanic: "Place voting, trading, epoch flip, claims, and active-lock rebase in the correct order.",
    time: 50,
    target: 5,
    minPools: 0,
    metric: "claims",
    lesson: "After the epoch flips, fees and incentives become claimable; rebases auto-compound for active locks.",
    fact: "Topaz uses seven-day epochs. Fees and incentives earned in one epoch become claimable after the next epoch begins, while rebases auto-compound for active locks.",
    factUrl: "https://www.topazdex.com/docs/gauges",
  },
];

function getProgress(metric: Metric, game: GameState) {
  if (metric === "routes") return game.routes;
  if (metric === "lpBalance") return Math.min(game.emissions, game.fees);
  if (metric === "crystals") return game.crystals;
  if (metric === "votes") return game.votes;
  if (metric === "fees") return game.fees;
  if (metric === "incentives") return game.incentives;
  return game.fees + game.incentives + game.crystals;
}

type GameState = {
  playerX: number;
  drops: Drop[];
  score: number;
  routes: number;
  lpRewards: number;
  emissions: number;
  fees: number;
  crystals: number;
  votes: number;
  incentives: number;
  combo: number;
  shield: number;
  poolHealth: number[];
  elapsed: number;
  spawnClock: number;
  mistakes: number;
  toast: string;
  toastUntil: number;
  last: number;
};

const freshGame = (lockLevel = 0): GameState => ({
  playerX: 0.5,
  drops: [],
  score: 0,
  routes: 0,
  lpRewards: 0,
  emissions: 0,
  fees: 0,
  crystals: 0,
  votes: 0,
  incentives: 0,
  combo: 1,
  shield: lockLevel,
  poolHealth: Array(POOLS.length).fill(100),
  elapsed: 0,
  spawnClock: 0,
  mistakes: 0,
  toast: "",
  toastUntil: 0,
  last: 0,
});

function pickKind(mission: number, roll: number): DropKind {
  if (mission === 0) return roll < 0.56 ? "route" : roll < 0.70 ? "fee" : "hazard";
  if (mission === 1) return roll < 0.34 ? "emission" : roll < 0.68 ? "fee" : "hazard";
  if (mission === 2) return roll < 0.57 ? "crystal" : roll < 0.78 ? "fee" : "hazard";
  if (mission === 3) return roll < 0.57 ? "vote" : roll < 0.78 ? "fee" : "hazard";
  if (mission === 4) return roll < 0.67 ? "fee" : roll < 0.85 ? "crystal" : "hazard";
  if (mission === 5) return roll < 0.52 ? "incentive" : roll < 0.82 ? "fee" : "hazard";
  return roll < 0.42 ? "fee" : roll < 0.68 ? "incentive" : roll < 0.84 ? "crystal" : "hazard";
}

function drawMine(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, spin: number) {
  ctx.save();
  ctx.translate(x, y);
  const alarm = (Math.sin(spin * 7) + 1) / 2;

  // Fixed warning aura: hazards should read as hostile before the player studies them.
  ctx.shadowColor = "#ff1f0f";
  ctx.shadowBlur = 22 + alarm * 10;
  ctx.strokeStyle = `rgba(255,48,25,${0.48 + alarm * 0.4})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, size * (1.05 + alarm * 0.1), 0, Math.PI * 2);
  ctx.stroke();

  ctx.rotate(spin);
  const pulse = 1 + Math.sin(spin * 5) * 0.05;
  ctx.scale(pulse, pulse);
  ctx.shadowColor = "#ff3517";
  ctx.shadowBlur = 20;

  // Long metal detonator spikes create the unmistakable naval-mine silhouette.
  for (let i = 0; i < 10; i++) {
    ctx.rotate(Math.PI / 5);
    ctx.beginPath();
    ctx.moveTo(size * 0.42, -size * 0.16);
    ctx.lineTo(size * 1.08, -size * 0.06);
    ctx.lineTo(size * 1.22, 0);
    ctx.lineTo(size * 1.08, size * 0.06);
    ctx.lineTo(size * 0.42, size * 0.16);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? "#4c1010" : "#a62214";
    ctx.fill();
    ctx.strokeStyle = "#ff4b26";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Armored shell.
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12;
    const radius = i % 2 ? size * 0.56 : size * 0.49;
    const px = Math.cos(a) * radius;
    const py = Math.sin(a) * radius;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  const mineGradient = ctx.createRadialGradient(-size * 0.18, -size * 0.2, 1, 0, 0, size * 0.62);
  mineGradient.addColorStop(0, "#5b2422");
  mineGradient.addColorStop(0.42, "#18191d");
  mineGradient.addColorStop(1, "#050507");
  ctx.fillStyle = mineGradient;
  ctx.fill();
  ctx.strokeStyle = "#ff4c26";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Pulsing armed core and high-contrast warning mark.
  ctx.shadowBlur = 16 + alarm * 8;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = alarm > 0.48 ? "#ff2812" : "#8d150e";
  ctx.fill();
  ctx.strokeStyle = "#ffb09d";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "white";
  ctx.font = `1000 ${Math.max(14, size * 0.52)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✕", 0, 1);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#ff6a4d";
  ctx.font = "900 8px Arial";
  ctx.textAlign = "center";
  ctx.fillText("✕ AVOID MINE", x, y + size * 1.55);
  ctx.restore();
}

function drawDecisionMark(ctx: CanvasRenderingContext2D, x: number, y: number, good: boolean) {
  ctx.save();
  ctx.shadowColor = good ? "#3dff9f" : "#ff2d18";
  ctx.shadowBlur = 12;
  ctx.fillStyle = good ? "#0bbf70" : "#df2414";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.font = "1000 13px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(good ? "✓" : "✕", x, y + 0.5);
  ctx.restore();
}

type MissionResult = {
  score: number;
  progress: number;
  fees: number;
  emissions: number;
  mistakes: number;
  health: number;
  lockLevel: number;
  cleared: boolean;
};

type LeaderboardEntry = {
  nickname: string;
  wallet: string | null;
  score: number;
  missions: number;
  badge: string;
};

type LeaderboardView = "epoch" | "mission" | "all";

function compactWallet(wallet: string | null) {
  return wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "NICKNAME PLAYER";
}

const MISSION_GOALS = [
  "Catch 12 BEST ROUTE quotes. Avoid HIGH IMPACT routes and finish with no more than 5 routing mistakes.",
  "Collect 9 IN-RANGE TOPAZ emissions on the left AND 9 unstaked swap fees on the right. Neither side substitutes for the other.",
  "Choose ONE TOPAZ amount and ONE lock duration. The two choices combine into simulated power. Reach 12 or more, then mint the lock.",
  "Allocate all 12 votes among three gauges while meeting each pool's displayed liquidity need.",
  "Complete 8 market scans. Select the highest-volume valid pool and reject HIGH IMPACT activity.",
  "Route each project incentive to its matching gauge. Reject expired incentive packages.",
  "Put the five epoch events in their correct order, from voting through claims and automatic lock rebase.",
];

const CONTROL_HINTS = [
  "DRAG OR USE A/D · APPROVE ✓ BEST ROUTES · AVOID ✕ HIGH IMPACT",
  "DRAG OR USE A/D · BALANCE BOTH LANES · AVOID ✕ OUT-OF-RANGE ITEMS",
  "STEP 1: CHOOSE AMOUNT · STEP 2: CHOOSE DURATION · REACH 12 POWER · STEP 3: MINT",
  "USE + AND − TO ALLOCATE A LIMITED VOTE BUDGET · THEN SUBMIT",
  "COMPARE THE THREE POOLS · TAP THE HIGHEST VALID VOLUME",
  "READ EACH PACKAGE · TAP ITS MATCHING GAUGE OR REJECT EXPIRED",
  "SELECT THE NEXT EVENT IN THE WEEKLY TOPAZ EPOCH",
];

const RESULT_RECAPS = [
  "Topaz compares pool types and multi-hop paths, then surfaces the chosen route, its fees, and price impact before you sign.",
  "A staked gauge position trades swap fees for TOPAZ emissions and must stay in range. An unstaked Slipstream position keeps swap fees but earns no emissions.",
  "A veTOPAZ position combines the amount locked with the selected duration. More voting power does not guarantee a particular reward.",
  "Voting power is limited. Allocating it among gauges helps determine how weekly TOPAZ emissions are distributed.",
  "Voted-pool fee opportunities depend on real trading activity. Higher volume may create more fees, but rewards are variable.",
  "Project incentives target particular gauges. They are separate from swap fees and can influence where voters allocate support.",
  "Topaz actions happen in stages: vote, trading activity, epoch change, claims, and automatic rebase treatment for an active lock.",
];

type SpecialBoardProps = {
  missionIndex: number;
  lockLevel: number;
  onHud: (progress: number, mistakes?: number) => void;
  onComplete: (result: MissionResult) => void;
};

function simulatedLockPower(amount: number, duration: number) {
  return Math.round((amount / 25) * 2 + duration * 2);
}

function SpecialMissionBoard({ missionIndex, lockLevel, onHud, onComplete }: SpecialBoardProps) {
  const [amount, setAmount] = useState(25);
  const [duration, setDuration] = useState(1);
  const [votes, setVotes] = useState([0, 0, 0]);
  const [step, setStep] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [message, setMessage] = useState("");

  const gaugePools = [POOLS[3], POOLS[4], POOLS[5]];
  const gaugeNeeds = [5, 4, 3];
  const feeScans = [
    [{ v: 42 }, { v: 71 }, { v: 55 }],
    [{ v: 88, bad: true }, { v: 64 }, { v: 49 }],
    [{ v: 38 }, { v: 52 }, { v: 79 }],
    [{ v: 67 }, { v: 61 }, { v: 44 }],
    [{ v: 73, bad: true }, { v: 58 }, { v: 69 }],
    [{ v: 46 }, { v: 82 }, { v: 76 }],
    [{ v: 91 }, { v: 63, bad: true }, { v: 72 }],
    [{ v: 57 }, { v: 68 }, { v: 84 }],
  ];
  const incentivePackets = [
    { pool: 0, label: "BNB GAUGE" },
    { pool: 2, label: "USDC GAUGE" },
    { pool: -1, label: "EXPIRED · EPOCH CLOSED" },
    { pool: 1, label: "USDT GAUGE" },
    { pool: 0, label: "BNB GAUGE" },
    { pool: -1, label: "EXPIRED · INVALID WINDOW" },
    { pool: 2, label: "USDC GAUGE" },
    { pool: 1, label: "USDT GAUGE" },
  ];
  const epochSteps = [
    "CAST GAUGE VOTES",
    "TRADES CREATE POOL FEES",
    "THE EPOCH FLIPS",
    "CLAIM FEES + INCENTIVES",
    "ACTIVE-LOCK REBASE COMPOUNDS",
  ];
  const shuffledEpoch = [epochSteps[2], epochSteps[0], epochSteps[4], epochSteps[1], epochSteps[3]];

  useEffect(() => {
    onHud(missionIndex === 2 ? simulatedLockPower(amount, duration) : missionIndex === 3 ? votes.reduce((a, b) => a + b, 0) : step, mistakes);
  }, [amount, duration, votes, step, mistakes, missionIndex, onHud]);

  const fail = (text: string) => {
    setMistakes((value) => value + 1);
    setMessage(text);
  };

  if (missionIndex === 2) {
    const amountPower = Math.round((amount / 25) * 2);
    const durationPower = duration * 2;
    const power = simulatedLockPower(amount, duration);
    const earnedLevel = Math.min(4, Math.max(1, Math.ceil(power / 4)));
    const createLock = () => {
      if (power < 12) {
        fail(`Not ready: your two choices total ${power} power. Try 50 TOPAZ + 4 YEARS, or 100 TOPAZ + 2 YEARS.`);
        return;
      }
      onComplete({ score: 1800 + power * 120 - mistakes * 100, progress: power, fees: 0, emissions: 0, mistakes, health: 100, lockLevel: earnedLevel, cleared: true });
    };
    const loadExample = () => {
      setAmount(50);
      setDuration(4);
      setMessage("Valid example loaded: 50 TOPAZ + 4 YEARS = 12 POWER. Now press MINT veTOPAZ LOCK.");
    };
    return (
      <div className="missionBoard lockBoard">
        <div className="boardHeader"><span>MISSION 3 · POSITION BUILDER</span><strong>CREATE A veTOPAZ LOCK</strong><small>Voting power preview—not a promise of rewards.</small></div>
        <div className="lockInstructions">
          <b>HOW TO CLEAR THIS MISSION</b>
          <span><i>1</i>Choose one TOPAZ amount</span>
          <span><i>2</i>Choose one lock duration</span>
          <span><i>3</i>Reach at least 12 total power</span>
          <span><i>4</i>Press MINT veTOPAZ LOCK</span>
        </div>
        <div className="lockBuilder">
          <section>
            <h3>1 · TOPAZ AMOUNT</h3>
            <div className="choiceRow">{[25, 50, 100].map((value) => <button key={value} className={amount === value ? "selected" : ""} onClick={() => { setAmount(value); setMessage(""); }}>{amount === value ? "✓ " : ""}{value} TOPAZ</button>)}</div>
          </section>
          <div className="formulaMark">+</div>
          <section>
            <h3>2 · LOCK DURATION</h3>
            <div className="choiceRow">{[1, 2, 4].map((value) => <button key={value} className={duration === value ? "selected" : ""} onClick={() => { setDuration(value); setMessage(""); }}>{duration === value ? "✓ " : ""}{value} YEAR{value > 1 ? "S" : ""}</button>)}</div>
          </section>
        </div>
        <div className="powerPreview"><img src={`${ASSET_BASE}topaz-mark.png`} alt="Topaz" /><div><small>SIMULATED VOTING POWER</small><strong>{power}</strong><span>VACUUM LV.{earnedLevel} · {earnedLevel} SHIELDS</span></div></div>
        <div className="powerEquation"><b>{amount} TOPAZ</b> gives {amountPower} power <strong>+</strong> <b>{duration} YEAR{duration > 1 ? "S" : ""}</b> gives {durationPower} power <strong>=</strong> <em>{power}/12 TOTAL</em></div>
        <div className={`requirement ${power >= 12 ? "met" : ""}`}>TARGET: 12 POWER {power >= 12 ? "✓ READY" : `· ${12 - power} MORE NEEDED`}</div>
        {power < 12 && <button className="exampleButton" onClick={loadExample}>NEED HELP? LOAD A VALID EXAMPLE</button>}
        {message && <p className={`boardMessage ${message.startsWith("Valid") ? "good" : "bad"}`}>{message}</p>}
        <button className="primaryAction" onClick={createLock}>MINT veTOPAZ LOCK</button>
      </div>
    );
  }

  if (missionIndex === 3) {
    const used = votes.reduce((a, b) => a + b, 0);
    const adjust = (index: number, delta: number) => setVotes((current) => {
      const next = [...current];
      if (delta > 0 && used >= 12) return current;
      next[index] = Math.max(0, next[index] + delta);
      return next;
    });
    const submit = () => {
      if (used !== 12) return fail(`Allocate all 12 votes. ${12 - used} remain.`);
      const short = votes.some((value, index) => value < gaugeNeeds[index]);
      if (short) return fail("One or more gauges are below the displayed liquidity need. Rebalance your votes.");
      onComplete({ score: 2600 - mistakes * 120, progress: used, fees: 0, emissions: used, mistakes, health: 100, lockLevel, cleared: true });
    };
    return (
      <div className="missionBoard voteBoard">
        <div className="boardHeader"><span>MISSION 4 · GAUGE ALLOCATION</span><strong>DIRECT 12 VOTES</strong><small>Limited voting power must be distributed deliberately.</small></div>
        <div className="voteBudget"><b>{12 - used}</b><span>VOTES REMAINING</span></div>
        <div className="gaugeGrid">{gaugePools.map((pool, index) => <article key={pool.name} className={votes[index] >= gaugeNeeds[index] ? "met" : ""}>
          <img src={pool.src} alt={pool.name} /><h3>{pool.name} GAUGE</h3><small>LIQUIDITY NEED · {gaugeNeeds[index]}</small><strong>{votes[index]}</strong>
          <div><button onClick={() => adjust(index, -1)} aria-label={`Remove vote from ${pool.name}`}>−</button><button onClick={() => adjust(index, 1)} aria-label={`Add vote to ${pool.name}`}>+</button></div>
        </article>)}</div>
        {message && <p className="boardMessage bad">{message}</p>}
        <button className="primaryAction" onClick={submit}>SUBMIT GAUGE VOTES</button>
      </div>
    );
  }

  if (missionIndex === 4) {
    const scan = feeScans[Math.min(step, feeScans.length - 1)];
    const choose = (index: number) => {
      const valid = scan.map((item, i) => ({ ...item, i })).filter((item) => !item.bad).sort((a, b) => b.v - a.v)[0].i;
      if (scan[index].bad) return fail("Rejected: HIGH IMPACT activity is not a healthy fee opportunity.");
      if (index !== valid) return fail("That pool is valid, but another valid pool has higher trading volume.");
      const next = step + 1;
      setMessage("Correct: higher valid activity can create more pool fees.");
      setStep(next);
      if (next === feeScans.length) onComplete({ score: 3200 - mistakes * 140, progress: next, fees: next, emissions: 0, mistakes, health: Math.max(40, 100 - mistakes * 10), lockLevel, cleared: true });
    };
    return (
      <div className="missionBoard feeBoard">
        <div className="boardHeader"><span>MISSION 5 · LIVE MARKET SCAN {step + 1}/8</span><strong>FOLLOW VALID VOLUME</strong><small>Fees depend on pool trading activity; they are not fixed.</small></div>
        <div className="scanGrid">{gaugePools.map((pool, index) => <button key={pool.name} className={scan[index].bad ? "dangerCard" : ""} onClick={() => choose(index)}>
          <img src={pool.src} alt="" /><span>{pool.name} POOL</span><strong>${scan[index].v}K</strong><small>{scan[index].bad ? "✕ HIGH IMPACT" : "✓ VALID VOLUME"}</small>
        </button>)}</div>
        <div className="scanProgress"><i style={{ width: `${(step / feeScans.length) * 100}%` }} /></div>
        {message && <p className={`boardMessage ${message.startsWith("Correct") ? "good" : "bad"}`}>{message}</p>}
        <p className="boardTip">Choose the highest-volume pool that is not marked HIGH IMPACT.</p>
      </div>
    );
  }

  if (missionIndex === 5) {
    const packet = incentivePackets[Math.min(step, incentivePackets.length - 1)];
    const route = (choice: number) => {
      if (choice !== packet.pool) return fail(packet.pool < 0 ? "This package is expired. Reject it." : `Wrong gauge. This incentive names the ${gaugePools[packet.pool].name} gauge.`);
      const next = step + 1;
      setMessage(choice < 0 ? "Expired package rejected." : "Incentive routed to its named gauge.");
      setStep(next);
      if (next === incentivePackets.length) onComplete({ score: 3500 - mistakes * 150, progress: next, fees: 0, emissions: 0, mistakes, health: 100, lockLevel, cleared: true });
    };
    return (
      <div className="missionBoard incentiveBoard">
        <div className="boardHeader"><span>MISSION 6 · PACKAGE {step + 1}/8</span><strong>ROUTE PROJECT INCENTIVES</strong><small>Incentives are separate from trading fees.</small></div>
        <div className={`incentivePacket ${packet.pool < 0 ? "expired" : ""}`}><b>PROJECT INCENTIVE</b><strong>{packet.label}</strong><span>{packet.pool < 0 ? "DO NOT ROUTE" : "MATCH THIS PACKAGE TO ITS GAUGE"}</span></div>
        <div className="routeButtons">{gaugePools.map((pool, index) => <button key={pool.name} onClick={() => route(index)}><img src={pool.src} alt="" />{pool.name} GAUGE</button>)}<button className="rejectButton" onClick={() => route(-1)}>✕ REJECT EXPIRED</button></div>
        {message && <p className={`boardMessage ${message.includes("routed") || message.includes("rejected") ? "good" : "bad"}`}>{message}</p>}
      </div>
    );
  }

  const selectEpoch = (label: string) => {
    if (label !== epochSteps[step]) {
      fail(`Not yet. The next event is: ${epochSteps[step]}.`);
      return;
    }
    const next = step + 1;
    setMessage(`${next}. ${label}`);
    setStep(next);
    if (next === epochSteps.length) onComplete({ score: 4200 - mistakes * 180, progress: next, fees: 1, emissions: 1, mistakes, health: 100, lockLevel, cleared: true });
  };
  return (
    <div className="missionBoard epochBoard">
      <div className="boardHeader"><span>MISSION 7 · WEEKLY CYCLE</span><strong>BUILD THE EPOCH TIMELINE</strong><small>Choose the next event in the correct order.</small></div>
      <div className="timeline">{epochSteps.map((label, index) => <span key={label} className={index < step ? "done" : index === step ? "current" : ""}><b>{index + 1}</b>{index < step ? label : index === step ? "SELECT NEXT EVENT" : "LOCKED"}</span>)}</div>
      <div className="epochChoices">{shuffledEpoch.filter((label) => !epochSteps.slice(0, step).includes(label)).map((label) => <button key={label} onClick={() => selectEpoch(label)}>{label}</button>)}</div>
      {message && <p className={`boardMessage ${message.startsWith(String(step)) ? "good" : "bad"}`}>{message}</p>}
    </div>
  );
}

function LeaderboardModal({
  open,
  onClose,
  nickname,
  setNickname,
  wallet,
  setWallet,
}: {
  open: boolean;
  onClose: () => void;
  nickname: string;
  setNickname: (value: string) => void;
  wallet: string;
  setWallet: (value: string) => void;
}) {
  const [view, setView] = useState<LeaderboardView>("epoch");
  const [mission, setMission] = useState(0);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [epochStart, setEpochStart] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    fetch(`/api/leaderboard?view=${view}&mission=${mission}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Leaderboard unavailable");
        return response.json() as Promise<{ entries: LeaderboardEntry[]; epochStart: string }>;
      })
      .then((data) => {
        if (!active) return;
        setEntries(data.entries);
        setEpochStart(data.epochStart);
      })
      .catch(() => active && setError("Rankings could not be loaded. Please try again."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [open, view, mission]);

  const connectWallet = async () => {
    const ethereum = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!ethereum) {
      setError("No browser wallet was detected. You can still play with a nickname.");
      return;
    }
    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];
      if (accounts[0]) setWallet(accounts[0]);
      setError("");
    } catch {
      setError("Wallet connection was cancelled. Nickname play remains available.");
    }
  };

  if (!open) return null;
  return (
    <div className="leaderboardBackdrop" role="dialog" aria-modal="true" aria-label="Topaz Epoch Leaderboard">
      <section className="leaderboardPanel">
        <header className="leaderboardHeader">
          <div><small>WEEKLY TOPAZ-STYLE COMPETITION</small><h2>TOPAZ EPOCH LEADERBOARD</h2></div>
          <button className="leaderboardClose" onClick={onClose} aria-label="Close leaderboard">✕</button>
        </header>
        <p className="leaderboardIntro">Master the DEX missions, avoid costly mistakes, and improve your score. The weekly board resets with a new Thursday UTC epoch.</p>
        <div className="leaderboardTabs">
          <button className={view === "epoch" ? "active" : ""} onClick={() => setView("epoch")}>CURRENT EPOCH</button>
          <button className={view === "mission" ? "active" : ""} onClick={() => setView("mission")}>MISSION MASTERS</button>
          <button className={view === "all" ? "active" : ""} onClick={() => setView("all")}>ALL-TIME</button>
        </div>
        {view === "mission" && <div className="missionPicker">{MISSIONS.map((item, index) => <button key={item.title} className={mission === index ? "active" : ""} onClick={() => setMission(index)} aria-label={`Mission ${index + 1}: ${item.title}`}>{index + 1}</button>)}</div>}
        <div className="leaderboardTable">
          <div className="leaderboardRow header"><span>RANK</span><span>PLAYER</span><span>SCORE</span><span>BADGE</span></div>
          {loading ? <div className="leaderboardEmpty">LOADING RANKINGS…</div> : error ? <div className="leaderboardEmpty">{error}</div> : entries.length === 0 ? <div className="leaderboardEmpty">THE EPOCH IS OPEN. COMPLETE A MISSION TO CLAIM THE FIRST RANK.</div> : entries.map((entry, index) => (
            <div className="leaderboardRow" key={`${entry.nickname}-${index}`}>
              <span className="rank">#{index + 1}</span>
              <span className="leaderboardIdentity"><strong>{entry.nickname}</strong><small>{compactWallet(entry.wallet)} · {entry.missions} {view === "mission" ? "EPOCHS" : "MISSIONS"}</small></span>
              <span className="leaderboardScore">{Number(entry.score).toLocaleString()}</span>
              <span className="leaderboardBadge">{entry.badge}</span>
            </div>
          ))}
        </div>
        <div className="walletTools">
          <input aria-label="Leaderboard nickname" value={nickname} maxLength={22} onChange={(event) => setNickname(event.target.value)} placeholder="Choose a nickname" />
          <input aria-label="Optional BNB wallet" value={wallet} onChange={(event) => setWallet(event.target.value)} placeholder="Optional BNB wallet" />
          <button onClick={connectWallet}>CONNECT WALLET</button>
        </div>
        <p className="leaderboardNote">Wallet connection is optional. It only verifies the displayed identity. It does not inspect balances, improve scores, or require payment. Epoch started {epochStart || "this Thursday"}.</p>
      </section>
    </div>
  );
}

export default function YieldVacuumGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(freshGame());
  const keys = useRef({ left: false, right: false });
  const [phase, setPhase] = useState<Phase>("splash");
  const [missionIndex, setMissionIndex] = useState(0);
  const [lockLevel, setLockLevel] = useState(0);
  const [hud, setHud] = useState({ score: 0, combo: 1, progress: 0, time: MISSIONS[0].time, shield: 0, pools: Array(POOLS.length).fill(100) });
  const [result, setResult] = useState<MissionResult>({ score: 0, progress: 0, fees: 0, emissions: 0, mistakes: 0, health: 100, lockLevel: 0, cleared: false });
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [wallet, setWallet] = useState("");
  const [playerKey, setPlayerKey] = useState("");
  const [scoreStatus, setScoreStatus] = useState("");
  const mission = MISSIONS[missionIndex];

  useEffect(() => {
    const storedKey = window.localStorage.getItem("yield-vacuum-player") || crypto.randomUUID();
    const storedNickname = window.localStorage.getItem("yield-vacuum-nickname") || "";
    const storedWallet = window.localStorage.getItem("yield-vacuum-wallet") || "";
    window.localStorage.setItem("yield-vacuum-player", storedKey);
    setPlayerKey(storedKey);
    setNickname(storedNickname);
    setWallet(storedWallet);
  }, []);

  useEffect(() => {
    if (nickname) window.localStorage.setItem("yield-vacuum-nickname", nickname);
    if (wallet) window.localStorage.setItem("yield-vacuum-wallet", wallet);
  }, [nickname, wallet]);

  const images = useMemo(() => {
    if (typeof window === "undefined") return [] as HTMLImageElement[];
    return [...POOLS.map((pool) => pool.src), `${ASSET_BASE}topaz-mark.png`].map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });
  }, []);

  const begin = () => {
    gameRef.current = freshGame(lockLevel);
    setHud({ score: 0, combo: 1, progress: 0, time: mission.time, shield: lockLevel, pools: Array(POOLS.length).fill(100) });
    setPhase("playing");
  };

  const updateSpecialHud = useCallback((progress: number, mistakes = 0) => {
    setHud((current) => ({ ...current, progress, combo: Math.max(1, 1 + progress - mistakes) }));
  }, []);

  const completeSpecial = useCallback((specialResult: MissionResult) => {
    if (missionIndex === 2) setLockLevel(specialResult.lockLevel);
    setResult(specialResult);
    setHud((current) => ({ ...current, progress: specialResult.progress }));
    setPhase("results");
  }, [missionIndex]);

  const advance = () => {
    if (!result.cleared) {
      begin();
      return;
    }
    if (missionIndex === MISSIONS.length - 1) setLockLevel(0);
    setMissionIndex((current) => (current + 1) % MISSIONS.length);
    setPhase("briefing");
  };

  const submitScore = async () => {
    if (!nickname.trim()) {
      setScoreStatus("Choose a nickname before submitting.");
      return;
    }
    setScoreStatus("SAVING SCORE…");
    try {
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerKey, nickname, wallet, missionIndex, score: result.score, mistakes: result.mistakes }),
      });
      const data = await response.json() as { error?: string; badge?: string };
      if (!response.ok) throw new Error(data.error || "Score unavailable");
      setScoreStatus(`SCORE SAVED · ${data.badge}`);
    } catch (error) {
      setScoreStatus(error instanceof Error ? error.message : "The score could not be saved.");
    }
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (["ArrowLeft", "a", "A"].includes(event.key)) keys.current.left = true;
      if (["ArrowRight", "d", "D"].includes(event.key)) keys.current.right = true;
    };
    const up = (event: KeyboardEvent) => {
      if (["ArrowLeft", "a", "A"].includes(event.key)) keys.current.left = false;
      if (["ArrowRight", "d", "D"].includes(event.key)) keys.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    if (missionIndex >= 2) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animation = 0;
    let ended = false;
    const game = gameRef.current;

    const finish = () => {
      if (ended) return;
      ended = true;
      const progress = getProgress(mission.metric, game);
      const living = game.poolHealth.filter((health) => health > 0).length;
      const health = Math.round(game.poolHealth.reduce((sum, value) => sum + value, 0) / POOLS.length);
      const earnedLockLevel = missionIndex === 2
        ? Math.min(4, Math.max(lockLevel, Math.ceil(game.crystals / 7)))
        : lockLevel;
      if (missionIndex === 2) setLockLevel(earnedLockLevel);
      setResult({
        score: game.score,
        progress,
        fees: game.fees,
        emissions: game.emissions,
        mistakes: game.mistakes,
        health,
        lockLevel: earnedLockLevel,
        cleared: progress >= mission.target && living >= mission.minPools && (missionIndex !== 0 || game.mistakes <= 5),
      });
      setPhase("results");
    };

    const frame = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const delta = Math.min((now - (game.last || now)) / 1000, 0.035);
      game.last = now;
      game.elapsed += delta;
      game.spawnClock += delta;
      if (keys.current.left) game.playerX -= delta * 0.62;
      if (keys.current.right) game.playerX += delta * 0.62;
      game.playerX = Math.max(0.08, Math.min(0.92, game.playerX));

      const earlyMission = missionIndex < 2;
      const spawnRate = earlyMission
        ? Math.max(0.26, 0.49 - game.elapsed * 0.0032)
        : Math.max(0.31, 0.62 - game.elapsed * 0.003);
      if (game.spawnClock >= spawnRate) {
        game.spawnClock = 0;
        const kind = pickKind(missionIndex, Math.random());
        const correct = missionIndex === 0 && kind === "route"
          ? Math.random() < 0.55
          : missionIndex === 1 && kind === "emission"
            ? Math.random() < 0.72
            : undefined;
        let spawnX = 30 + Math.random() * (width - 60);
        if (missionIndex === 1 && kind === "emission") spawnX = 30 + Math.random() * (width * 0.44 - 30);
        if (missionIndex === 1 && kind === "fee") spawnX = width * 0.56 + Math.random() * (width * 0.44 - 30);
        game.drops.push({
          x: spawnX,
          y: -35,
          speed: (earlyMission ? 132 : 90) + Math.random() * (earlyMission ? 98 : 75) + missionIndex * 5,
          drift: (Math.random() - 0.5) * (earlyMission ? 46 : 30),
          size: kind === "hazard" ? 23 : 20 + Math.random() * 5,
          kind,
          asset: Math.floor(Math.random() * POOLS.length),
          spin: Math.random() * Math.PI * 2,
          correct,
        });
      }

      const playerX = game.playerX * width;
      const playerY = height - 88;
      const liveLockLevel = missionIndex === 2
        ? Math.max(lockLevel, Math.min(4, Math.floor(game.crystals / 7)))
        : lockLevel;
      const attractionRadius = 155 + liveLockLevel * 18;
      for (const drop of game.drops) {
        drop.y += drop.speed * delta;
        drop.x += drop.drift * delta;
        drop.spin += delta * 1.8;
        const collectible = drop.kind !== "hazard"
          && !(missionIndex === 0 && drop.kind === "route" && !drop.correct)
          && !(missionIndex === 1 && drop.kind === "emission" && !drop.correct);
        if (collectible && drop.y > height * 0.18 && Math.abs(drop.x - playerX) < attractionRadius) {
          drop.x += (playerX - drop.x) * delta * 2.7;
          drop.y += 52 * delta;
        }
      }

      game.drops = game.drops.filter((drop) => {
        const caught = Math.hypot(drop.x - playerX, drop.y - playerY) < drop.size + 38;
        if (caught) {
          if (drop.kind === "hazard") {
            if (game.shield > 0) {
              game.shield--;
              game.score = Math.max(0, game.score - 20);
            } else {
              const pool = Math.floor(Math.random() * POOLS.length);
              game.poolHealth[pool] = Math.max(0, game.poolHealth[pool] - 34);
              game.score = Math.max(0, game.score - 75);
            }
            game.combo = 1;
          } else {
            if (drop.kind === "route") {
              if (drop.correct) {
                game.routes++;
                game.toast = "BEST ROUTE ACCEPTED · LOWEST END-TO-END QUOTE";
              } else {
                game.mistakes++;
                game.score = Math.max(0, game.score - 120);
                game.combo = 1;
                game.toast = "ROUTE REJECTED · HIGH PRICE IMPACT";
                game.toastUntil = game.elapsed + 1.5;
                return false;
              }
            }
            if (drop.kind === "emission") {
              if (missionIndex === 1 && !drop.correct) {
                game.mistakes++;
                game.combo = 1;
                game.toast = "OUT OF RANGE · STAKED LP EARNS NO EMISSIONS";
                game.toastUntil = game.elapsed + 1.5;
                return false;
              }
              game.emissions++;
              game.lpRewards++;
              if (missionIndex === 1) game.toast = "STAKED + IN RANGE · TOPAZ EMISSIONS";
            }
            if (drop.kind === "fee") {
              game.fees++;
              if (missionIndex === 0) game.toast = "SWAP FEE CREATED · ACCRUES TO THE POOL";
              if (missionIndex === 1) {
                game.lpRewards++;
                game.toast = "UNSTAKED SLIPSTREAM · KEEPS SWAP FEES";
              }
            }
            if (drop.kind === "crystal") game.crystals++;
            if (drop.kind === "vote") game.votes++;
            if (drop.kind === "incentive") game.incentives++;
            game.score += 50 * game.combo;
            game.combo = Math.min(8 + liveLockLevel, game.combo + 1);
            game.toastUntil = game.elapsed + 1.25;
          }
          return false;
        }
        const onscreen = drop.y < height + 55;
        if (!onscreen && ((missionIndex === 0 && drop.kind === "route" && drop.correct)
          || (missionIndex === 1 && ((drop.kind === "emission" && drop.correct) || drop.kind === "fee")))) {
          game.combo = 1;
        }
        return onscreen;
      });

      const progress = getProgress(mission.metric, game);
      setHud({
        score: game.score,
        combo: game.combo,
        progress,
        time: Math.max(0, Math.ceil(mission.time - game.elapsed)),
        shield: game.shield,
        pools: [...game.poolHealth],
      });

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#210b04");
      gradient.addColorStop(0.58, "#100503");
      gradient.addColorStop(1, "#050201");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255,90,25,.22)";
      for (let i = 0; i < 38; i++) {
        const sx = (i * 173 + 31) % width;
        const sy = (i * 97 + game.elapsed * (6 + (i % 4))) % height;
        ctx.fillRect(sx, sy, 1.4, 1.4);
      }

      if (missionIndex === 1) {
        ctx.fillStyle = "rgba(255,83,16,.045)";
        ctx.fillRect(0, 0, width / 2, height);
        ctx.fillStyle = "rgba(61,224,196,.045)";
        ctx.fillRect(width / 2, 0, width / 2, height);
        ctx.strokeStyle = "rgba(255,255,255,.16)";
        ctx.setLineDash([5, 9]);
        ctx.beginPath();
        ctx.moveTo(width / 2, 96);
        ctx.lineTo(width / 2, height - 120);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "900 9px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ff9b73";
        ctx.fillText("STAKED GAUGE · TOPAZ EMISSIONS", width * 0.25, 112);
        ctx.fillStyle = "#73e8d3";
        ctx.fillText("UNSTAKED SLIPSTREAM · SWAP FEES", width * 0.75, 112);
      }

      if (missionIndex < 2) {
        ctx.fillStyle = "rgba(3,8,12,.82)";
        ctx.strokeStyle = missionIndex === 0 ? "rgba(88,221,241,.65)" : "rgba(115,232,211,.62)";
        ctx.lineWidth = 1;
        ctx.fillRect(12, 128, width - 24, 29);
        ctx.strokeRect(12, 128, width - 24, 29);
        ctx.fillStyle = "#eefcff";
        ctx.font = `900 ${width < 520 ? 8 : 10}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(
          missionIndex === 0
            ? `APPROVE BEST ROUTES · MISTAKES ${game.mistakes}/5`
            : `BALANCE BOTH · EMISSIONS ${game.emissions}/${mission.target} · FEES ${game.fees}/${mission.target}`,
          width / 2,
          147,
        );
      }

      const poolY = 54;
      POOLS.forEach((pool, index) => {
        const position = (index + 0.5) / POOLS.length;
        const x = width * position;
        const health = game.poolHealth[index];
        ctx.save();
        ctx.shadowColor = health > 0 ? "#ff761f" : "#48150b";
        ctx.shadowBlur = 18;
        ctx.strokeStyle = health > 0 ? `rgba(255,${120 + health},35,.85)` : "#482016";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, poolY, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (health / 100));
        ctx.stroke();
        ctx.restore();
        if (images[index]?.complete && images[index].naturalWidth) {
          drawContainedImage(ctx, images[index], x, poolY, 32, 32);
        }
        ctx.fillStyle = health > 0 ? "#b8a99f" : "#6d4437";
        ctx.font = "800 9px Arial";
        ctx.textAlign = "center";
        ctx.fillText(pool.name, x, poolY + 37);
      });

      const beamColors = [
        ["rgba(55,205,255,.42)", "rgba(55,205,255,0)"],
        ["rgba(67,236,196,.4)", "rgba(67,236,196,0)"],
        ["rgba(255,86,20,.44)", "rgba(255,86,20,0)"],
        ["rgba(94,177,255,.43)", "rgba(94,177,255,0)"],
        ["rgba(255,126,26,.5)", "rgba(255,126,26,0)"],
        ["rgba(190,83,255,.46)", "rgba(190,83,255,0)"],
        ["rgba(255,206,73,.52)", "rgba(255,83,16,0)"],
      ];
      const baseWidths = [118, 150, 135, 174, 192, 178, 218];
      const beamWidth = baseWidths[missionIndex] * (1 + liveLockLevel * 0.07);
      const beamTop = height * 0.18;

      if (missionIndex === 3) {
        ctx.save();
        ctx.strokeStyle = "rgba(94,177,255,.22)";
        ctx.lineWidth = 2;
        [0.13, 0.38, 0.63, 0.87].forEach((position) => {
          ctx.beginPath();
          ctx.moveTo(playerX, playerY - 24);
          ctx.lineTo(width * position, 82);
          ctx.stroke();
        });
        ctx.restore();
      }

      ctx.save();
      const beam = ctx.createLinearGradient(playerX, playerY, playerX, beamTop);
      beam.addColorStop(0, beamColors[missionIndex][0]);
      beam.addColorStop(1, beamColors[missionIndex][1]);
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(playerX - 42, playerY);
      ctx.lineTo(playerX - beamWidth, beamTop);
      ctx.lineTo(playerX + beamWidth, beamTop);
      ctx.lineTo(playerX + 42, playerY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (missionIndex === 0) {
        const scanY = beamTop + ((game.elapsed * 90) % Math.max(80, playerY - beamTop));
        ctx.strokeStyle = "rgba(97,224,255,.65)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, playerX - beamWidth * 0.8), scanY);
        ctx.lineTo(Math.min(width, playerX + beamWidth * 0.8), scanY);
        ctx.stroke();
      }

      if (missionIndex === 2 || liveLockLevel > 0) {
        ctx.save();
        ctx.strokeStyle = missionIndex === 2 ? "rgba(255,122,42,.7)" : "rgba(255,122,42,.34)";
        ctx.lineWidth = 2;
        for (let ring = 0; ring < Math.max(1, liveLockLevel); ring++) {
          ctx.beginPath();
          ctx.arc(playerX, playerY, 55 + ring * 9 + Math.sin(game.elapsed * 3 + ring) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (missionIndex === 5 || missionIndex === 6) {
        ctx.save();
        ctx.strokeStyle = missionIndex === 5 ? "rgba(210,112,255,.55)" : "rgba(255,218,103,.55)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(playerX, playerY, 64 + Math.sin(game.elapsed * 5) * 10, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      for (const drop of game.drops) {
        if (drop.kind === "hazard") {
          drawMine(ctx, drop.x, drop.y, drop.size, drop.spin);
        } else if (drop.kind === "route") {
          const first = images[drop.asset];
          const second = images[(drop.asset + 1) % POOLS.length];
          ctx.save();
          ctx.shadowColor = drop.correct ? "#3dff9f" : "#ff3b20";
          ctx.shadowBlur = 15;
          ctx.fillStyle = drop.correct ? "rgba(5,45,31,.94)" : "rgba(55,8,5,.94)";
          ctx.strokeStyle = drop.correct ? "#45efa2" : "#ff5638";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(drop.x - 34, drop.y - 20, 68, 40, 14);
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;
          if (first?.complete && first.naturalWidth) drawContainedImage(ctx, first, drop.x - 18, drop.y, 23, 23);
          if (second?.complete && second.naturalWidth) drawContainedImage(ctx, second, drop.x + 18, drop.y, 23, 23);
          ctx.fillStyle = "#bdf7ff";
          ctx.font = "900 12px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("↔", drop.x, drop.y);
          ctx.fillStyle = drop.correct ? "#78ffc0" : "#ff8067";
          ctx.font = "900 7px Arial";
          ctx.fillText(drop.correct ? "BEST ROUTE" : "HIGH IMPACT", drop.x, drop.y + 29);
          ctx.restore();
        } else if (drop.kind === "emission") {
          const image = images[POOLS.length];
          if (image?.complete && image.naturalWidth) {
            ctx.save();
            ctx.globalAlpha = missionIndex === 1 && !drop.correct ? 0.46 : 1;
            ctx.shadowColor = missionIndex === 1 && !drop.correct ? "#ff2c1a" : "#ff6a19";
            ctx.shadowBlur = 18;
            drawContainedImage(ctx, image, drop.x, drop.y, drop.size * 2.2, drop.size * 2.2);
            if (missionIndex === 1) {
              ctx.globalAlpha = 1;
              ctx.shadowBlur = 0;
              ctx.fillStyle = drop.correct ? "#8cf4d9" : "#ff8067";
              ctx.font = "900 7px Arial";
              ctx.textAlign = "center";
              ctx.fillText(drop.correct ? "IN RANGE" : "OUT OF RANGE", drop.x, drop.y + drop.size + 12);
            }
            ctx.restore();
          }
        } else if (drop.kind === "fee") {
          const image = images[drop.asset];
          if (image?.complete && image.naturalWidth) {
            ctx.save();
            ctx.shadowColor = FEE_GLOWS[drop.asset];
            ctx.shadowBlur = 14;
            drawContainedImage(ctx, image, drop.x, drop.y, drop.size * 2, drop.size * 2);
            if (missionIndex < 2) {
              ctx.shadowBlur = 0;
              ctx.fillStyle = missionIndex === 1 ? "#73e8d3" : "rgba(255,255,255,.82)";
              ctx.font = "900 7px Arial";
              ctx.textAlign = "center";
              ctx.fillText(missionIndex === 1 ? "SWAP FEE" : "FEE", drop.x, drop.y + drop.size + 10);
            }
            ctx.restore();
          }
        } else if (drop.kind === "crystal") {
          ctx.save();
          ctx.translate(drop.x, drop.y);
          ctx.rotate(drop.spin);
          ctx.shadowColor = "#ff5a12";
          ctx.shadowBlur = 16;
          ctx.fillStyle = "#ff5310";
          ctx.beginPath();
          ctx.moveTo(0, -drop.size);
          ctx.lineTo(drop.size * 0.72, 0);
          ctx.lineTo(0, drop.size);
          ctx.lineTo(-drop.size * 0.72, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (drop.kind === "vote") {
          ctx.save();
          ctx.shadowColor = "#42e8ff";
          ctx.shadowBlur = 16;
          ctx.fillStyle = "#0c7293";
          ctx.strokeStyle = "#74efff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "white";
          ctx.font = `900 ${drop.size}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("✓", drop.x, drop.y + 1);
          ctx.restore();
        } else if (drop.kind === "incentive") {
          ctx.save();
          ctx.translate(drop.x, drop.y);
          ctx.rotate(Math.sin(drop.spin) * 0.15);
          ctx.shadowColor = "#bd65ff";
          ctx.shadowBlur = 17;
          ctx.fillStyle = "#63258e";
          ctx.strokeStyle = "#e1a4ff";
          ctx.lineWidth = 3;
          ctx.fillRect(-drop.size, -drop.size * 0.72, drop.size * 2, drop.size * 1.44);
          ctx.strokeRect(-drop.size, -drop.size * 0.72, drop.size * 2, drop.size * 1.44);
          ctx.fillStyle = "#ffd36a";
          ctx.font = `900 ${drop.size}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("+", 0, 1);
          ctx.restore();
        }

        const avoidDrop = drop.kind === "hazard"
          || (missionIndex === 0 && drop.kind === "route" && !drop.correct)
          || (missionIndex === 1 && drop.kind === "emission" && !drop.correct);
        const markX = drop.x + (drop.kind === "route" ? 31 : drop.size * 0.72);
        const markY = drop.y - (drop.kind === "route" ? 20 : drop.size * 0.72);
        drawDecisionMark(ctx, markX, markY, !avoidDrop);
      }

      if (game.toast && game.elapsed < game.toastUntil) {
        const alpha = Math.min(1, (game.toastUntil - game.elapsed) * 2.2);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(2,7,10,.9)";
        ctx.strokeStyle = game.toast.includes("NO ") || game.toast.includes("REJECTED") ? "#ff573a" : "#f3ba2f";
        ctx.lineWidth = 2;
        ctx.fillRect(18, height * 0.69, width - 36, 38);
        ctx.strokeRect(18, height * 0.69, width - 36, 38);
        ctx.fillStyle = "#fff";
        ctx.font = `900 ${width < 520 ? 8 : 10}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(game.toast, width / 2, height * 0.69 + 19);
        ctx.restore();
      }

      if (images[POOLS.length]?.complete && images[POOLS.length].naturalWidth) {
        const logoHeight = 92;
        const logoWidth = logoHeight * (images[POOLS.length].naturalWidth / images[POOLS.length].naturalHeight);
        ctx.save();
        ctx.shadowColor = missionIndex === 3 ? "#5eb1ff" : missionIndex === 5 ? "#bd65ff" : missionIndex === 6 ? "#ffd45f" : "#ff5310";
        ctx.shadowBlur = 24 + liveLockLevel * 4;
        ctx.drawImage(
          images[POOLS.length],
          playerX - logoWidth / 2,
          playerY - logoHeight / 2,
          logoWidth,
          logoHeight,
        );
        ctx.restore();
      }
      ctx.font = "27px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🔒", playerX + 35, playerY + 30);
      ctx.fillStyle = "#ff9b73";
      ctx.font = "900 9px Arial";
      ctx.fillText(`veTOPAZ · LOCK LV.${liveLockLevel}`, playerX, playerY + 58);
      if (game.shield > 0) {
        ctx.fillStyle = "#ffd45f";
        ctx.font = "900 8px Arial";
        ctx.fillText(`SHIELD ×${game.shield}`, playerX, playerY + 70);
      }

      if (game.elapsed >= mission.time || game.poolHealth.every((health) => health <= 0)) {
        finish();
        return;
      }
      animation = requestAnimationFrame(frame);
    };
    animation = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animation);
  }, [phase, mission, missionIndex, images, lockLevel]);

  const movePlayer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    gameRef.current.playerX = Math.max(0.08, Math.min(0.92, (event.clientX - rect.left) / rect.width));
  };

  return (
    <main className="shell">
      {phase === "splash" && (
        <section className="splashScreen" aria-label="Topaz Yield Vacuum title screen">
          <div className="splashAtmosphere" aria-hidden="true">
            <i /><i /><i />
          </div>
          <p className="splashPresents">THE CRYPTO ARBORIST PRESENTS</p>
          <div className="splashLogoStage">
            <div className="splashRing" aria-hidden="true" />
            <img src={`${ASSET_BASE}topaz-mark.png`} alt="Topaz" />
          </div>
          <h1 className="splashTitle"><span>YIELD</span><strong>VACUUM</strong></h1>
          <p className="splashNetwork">AN INDEPENDENT GAME ABOUT TOPAZ DEX · BNB CHAIN</p>
          <button className="splashEnter" onClick={() => setPhase("briefing")}>ENTER THE VACUUM</button>
        </section>
      )}
      <header className="topbar">
        <div className="brand">
          <img src={`${ASSET_BASE}topaz-mark.png`} alt="Topaz" />
          YIELD VACUUM <b>TOPAZ DEX</b>
        </div>
        <div className="topbarActions"><div className="prototype">BNB CHAIN · MISSION {missionIndex + 1}/7 · LOCK LV.{lockLevel}</div><button className="leaderboardButton" onClick={() => setLeaderboardOpen(true)}>LEADERBOARD</button></div>
      </header>

      <section className="gameFrame">
        <div className="hud">
          <div><small>{mission.action}</small><strong>{hud.progress}/{mission.target}</strong></div>
          <div><small>COMBO</small><strong className="gold">×{hud.combo}</strong></div>
          <div><small>{missionIndex < 2 ? `EPOCH · L${lockLevel}` : "DECISION MODE"}</small><strong>{missionIndex < 2 ? `${hud.time}s` : "OPEN"}</strong></div>
          <div className="poolHud">
            {POOLS.map((pool, index) => (
              <span key={pool.name}>
                <i style={{ width: `${hud.pools[index]}%` }} />
                <img src={pool.src} alt="" /> {pool.name}
              </span>
            ))}
          </div>
        </div>

        <div className="legendBar" aria-label="Gameplay symbol key">
          {missionIndex < 2 ? <><span className="vacuumCue"><b>✓</b> SUCK INTO VACUUM</span><span className="avoidCue"><b>✕</b> AVOID</span><small>GREEN = ACCEPT · RED = REJECT</small></> : <><span className="vacuumCue"><b>◆</b> READ · DECIDE · ACT</span><span className="avoidCue"><b>!</b> WRONG CHOICES COST SCORE</span><small>EACH MISSION USES A DIFFERENT TOPAZ DECISION</small></>}
        </div>

        {phase === "playing" && (
          <div className="missionLiveLine" aria-label={`Mission ${missionIndex + 1} of 7: ${mission.title}`}>
            <b>MISSION {missionIndex + 1} OF 7</b><span>{mission.title}</span><small>{mission.feature}</small>
          </div>
        )}

        <div className="canvasWrap">
          <canvas
            ref={canvasRef}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); movePlayer(event); }}
            onPointerMove={(event) => { if (event.buttons || event.pointerType === "touch") movePlayer(event); }}
            aria-label="Yield Vacuum arcade playfield"
          />

          {phase === "playing" && missionIndex >= 2 && (
            <SpecialMissionBoard missionIndex={missionIndex} lockLevel={lockLevel} onHud={updateSpecialHud} onComplete={completeSpecial} />
          )}

          {phase === "briefing" && (
            <div className={`overlay briefing ${missionIndex < 2 ? "challengeBriefing" : ""} ${missionIndex === 1 ? "lpBriefing" : ""}`}>
              <div className="briefingContent">
                <img className="heroLogo" src={`${ASSET_BASE}topaz-mark.png`} alt="Topaz logo" />
                <div className="chainBadge"><img src={`${ASSET_BASE}fee-bnb.png`} alt="BNB" /> RELEASING ON BNB CHAIN</div>
                <p className="eyebrow">MISSION {missionIndex + 1} OF 7 · {mission.title}</p>
                <h1>YIELD<br /><em>VACUUM</em></h1>
                <p>{mission.lesson}</p>
                <div className="featureCallout"><b>{mission.feature}</b>{mission.mechanic}</div>
                <div className="missionObjective"><b>ROUND GOAL</b>{MISSION_GOALS[missionIndex]}</div>
                <div className="missionKey">
                  {missionIndex < 2 ? <><span className="vacuumCue"><b>✓</b> VACUUM: {mission.action}</span><span className="avoidCue"><b>✕</b> AVOID: RED-X ITEMS & MINES</span></> : <><span className="vacuumCue"><b>◆</b> DECISION MISSION</span><span className="avoidCue"><b>!</b> READ BEFORE ACTING</span></>}
                </div>
                {missionIndex === 1 && (
                  <div className="lpCompare">
                    <span><b>STAKED GAUGE</b><strong>TOPAZ EMISSIONS</strong><small>Swap fees flow to voters</small></span>
                    <span><b>UNSTAKED SLIPSTREAM</b><strong>SWAP FEES</strong><small>No emissions · surcharge may apply</small></span>
                  </div>
                )}
                <div className="missionGrid">
                  <span><b>{mission.target}</b>{mission.action}</span>
                  <span><b>{missionIndex < 2 ? `${mission.time}s` : "OPEN"}</b>{missionIndex < 2 ? "EPOCH TIMER" : "NO TIMER"}</span>
                  <span><b>{missionIndex < 2 ? mission.minPools : "NEW"}</b>{missionIndex < 2 ? "POOLS SURVIVE" : "GAMEPLAY MODE"}</span>
                </div>
                <div className="positionLabel">LOCKED veTOPAZ POSITION · LOCK LV.{lockLevel} · VACUUM ALWAYS ONLINE</div>
              </div>
              <div className="briefingAction">
                <button onClick={begin}>START MISSION</button>
                <span>{CONTROL_HINTS[missionIndex]}</span>
              </div>
            </div>
          )}

          {phase === "results" && (
            <div className="overlay results">
              <div className={`missionResultHeading ${result.cleared ? "cleared" : "missed"}`}>
                <small>MISSION {missionIndex + 1} OF 7</small>
                <strong>{result.cleared ? "MISSION CLEARED" : "MISSION MISSED"}</strong>
                <span>{mission.title}</span>
              </div>
              <h2>{result.score.toLocaleString()}</h2>
              <label>FINAL SCORE</label>
              <div className="campaignProgress" aria-label={`${missionIndex + 1} of 7 missions reached`}>
                <div className="campaignProgressLabel">
                  <b>CAMPAIGN PROGRESS</b>
                  <span>{missionIndex + 1}/7 {result.cleared ? "COMPLETE" : "REACHED"}</span>
                </div>
                <div className="campaignProgressTrack">
                  {MISSIONS.map((item, index) => (
                    <i key={item.title} className={index < missionIndex || (index === missionIndex && result.cleared) ? "complete" : index === missionIndex ? "current" : ""}><em>{index + 1}</em></i>
                  ))}
                </div>
                <small>{result.cleared && missionIndex < MISSIONS.length - 1 ? `UP NEXT · MISSION ${missionIndex + 2}: ${MISSIONS[missionIndex + 1].title}` : result.cleared ? "CAMPAIGN COMPLETE · REPLAY TO IMPROVE YOUR RANK" : `RETRY · MISSION ${missionIndex + 1}: ${mission.title}`}</small>
              </div>
              <div className="resultGrid">
                {missionIndex === 0 ? (
                  <>
                    <span><b>{result.progress}/{mission.target}</b>BEST ROUTES</span>
                    <span className={result.mistakes > 5 ? "dangerStat" : undefined}><b>{result.mistakes}/5</b>BAD ROUTES</span>
                    <span><b>{result.fees}</b>POOL FEES</span>
                  </>
                ) : missionIndex === 1 ? (
                  <>
                    <span><b>{result.progress}/{mission.target}</b>BALANCE LEVEL</span>
                    <span><b>{result.emissions}/{mission.target}</b>IN-RANGE EMISSIONS</span>
                    <span><b>{result.fees}/{mission.target}</b>UNSTAKED FEES</span>
                  </>
                ) : missionIndex === 2 ? (
                  <>
                    <span><b>{result.progress}/{mission.target}</b>VOTING POWER</span>
                    <span><b>LV.{result.lockLevel}</b>VACUUM POWER</span>
                    <span><b>+{result.lockLevel}</b>MINE SHIELDS</span>
                  </>
                ) : missionIndex === 3 ? (
                  <>
                    <span><b>{result.progress}/12</b>VOTES ALLOCATED</span>
                    <span><b>3</b>GAUGES SUPPORTED</span>
                    <span><b>{result.mistakes}</b>REALLOCATIONS</span>
                  </>
                ) : missionIndex === 4 ? (
                  <>
                    <span><b>{result.progress}/8</b>MARKET SCANS</span>
                    <span><b>{result.fees}</b>VALID VOLUME PICKS</span>
                    <span><b>{result.mistakes}</b>BAD DECISIONS</span>
                  </>
                ) : missionIndex === 5 ? (
                  <>
                    <span><b>{result.progress}/8</b>PACKAGES ROUTED</span>
                    <span><b>2</b>EXPIRED REJECTED</span>
                    <span><b>{result.mistakes}</b>MISROUTES</span>
                  </>
                ) : missionIndex === 6 ? (
                  <>
                    <span><b>{result.progress}/5</b>EPOCH EVENTS</span>
                    <span><b>1</b>CLAIM BUNDLE</span>
                    <span><b>{result.mistakes}</b>ORDER ERRORS</span>
                  </>
                ) : (
                  <>
                    <span><b>{result.progress}/{mission.target}</b>{mission.action}</span>
                    <span><b>{result.fees}</b>{mission.metric === "fees" ? "FEES CAPTURED" : "BONUS FEES"}</span>
                    <span className={result.health < 35 ? "dangerStat" : undefined}>
                      <b>{result.health}%</b>{mission.minPools === 0 ? "POOL HEALTH · BONUS" : "POOL HEALTH"}
                    </span>
                  </>
                )}
              </div>
              {!result.cleared && (
                <p className="resultMessage">
                  {missionIndex === 0
                    ? "Mission missed. Approve BEST ROUTE quotes and reject HIGH IMPACT paths."
                    : missionIndex === 1
                      ? "Mission missed. You need both in-range emissions and unstaked fees; one cannot replace the other."
                      : "Target missed. Keep the veTOPAZ vacuum moving and protect the active pools."}
                </p>
              )}
              <p className="missionRecap"><b>WHAT YOU JUST USED:</b> {RESULT_RECAPS[missionIndex]}</p>
              {missionIndex === 2 && (
                <div className="lockUpgrade">LOCK UPGRADE ACTIVE · WIDER VACUUM · {result.lockLevel} SHIELDS · HIGHER COMBO LIMIT</div>
              )}
              {result.cleared && (
                <div className="scoreSubmit">
                  <input aria-label="Leaderboard nickname" value={nickname} maxLength={22} onChange={(event) => setNickname(event.target.value)} placeholder="Choose a leaderboard nickname" />
                  <button onClick={submitScore}>SUBMIT SCORE</button>
                  <small className={scoreStatus.startsWith("SCORE SAVED") ? "scoreStatus" : ""}>{scoreStatus || "Free entry · best score per mission counts each epoch · wallet not required"}</small>
                </div>
              )}
              <aside className="dexFact">
                <div className="factHeading"><span>◆</span> REAL TOPAZ DEX FACT</div>
                <p>{mission.fact}</p>
                <a href={mission.factUrl} target="_blank" rel="noreferrer">READ THE OFFICIAL TOPAZ DOCS ↗</a>
              </aside>
              <button onClick={advance}>
                {!result.cleared ? "RETRY MISSION" : missionIndex === MISSIONS.length - 1 ? "RESTART CAMPAIGN" : "NEXT MISSION"}
              </button>
            </div>
          )}
        </div>
      </section>

      <footer>
        <b>VACUUM = ALWAYS ON</b>
        <span>✓ GREEN CHECK = VACUUM</span>
        <span>✕ RED X = AVOID</span>
        <p>Presented by The Crypto Arborist · Independent educational game, not an official Topaz DEX product.</p>
      </footer>
      <LeaderboardModal open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} nickname={nickname} setNickname={setNickname} wallet={wallet} setWallet={setWallet} />
    </main>
  );
}
