export type TrialEngine = "portable-v1" | "legacy-v8" | "legacy-webkit";
export const TRIAL_PORTABLE_START_DATE = "2026-09-03";
export function isTrialEngine(value: unknown): value is TrialEngine {
  return value === "portable-v1" || value === "legacy-v8" || value === "legacy-webkit";
}

// Fixed comparison order for the four-card legacy hand only. Never delegate a
// random comparator to Array.sort: its random consumption differs by engine.
export function shuffleTrialHand(cards: number[], random: () => number, engine: TrialEngine) {
  if (engine === "portable-v1") {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }
  let start = 1;
  if (engine === "legacy-v8" && cards.length > 1) {
    const descending = random() < 0.5;
    start = 2;
    while (start < cards.length) {
      if ((random() < 0.5) !== descending) break;
      start++;
    }
    if (descending) {
      const run = cards.slice(0, start).reverse();
      cards.splice(0, start, ...run);
    }
  }
  // WebKit's small-array binary insertion starts at 1; V8 first finds a run.
  for (let i = start; i < cards.length; i++) {
    const value = cards[i];
    let left = 0, right = i;
    while (left < right) {
      const mid = (left + right) >>> 1;
      if (random() < 0.5) right = mid;
      else left = mid + 1;
    }
    cards.splice(i, 1);
    cards.splice(left, 0, value);
  }
  return cards;
}
