// Presentation timing and score attribution only; no reward mutations.
export function clearCardMs(waveNumber, final) {
  return final ? 3600 : waveNumber === 1 ? 2400 : 1800;
}
export function markBonusIntro(game, kind) {
  if (kind !== "challenge" && kind !== "windfall")
    throw Error("Unknown bonus introduction");
  const seen = game.registry.get("presentationBonusSeen") || new Set();
  const repeat = seen.has(kind);
  seen.add(kind);
  game.registry.set("presentationBonusSeen", seen);
  return repeat;
}
// Preserve the original 650ms READY and 450ms GO, shortening only repeat titles.
export function introPhaseTime(elapsed, repeat) {
  return elapsed + (repeat ? 1900 : 0);
}
export function wavePoints(score, start) {
  return Math.max(0, score - (start ?? score)).toLocaleString("en-US");
}
export function challengePoints(targets, perTarget, bonus) {
  return `TARGET POINTS +${(targets * perTarget).toLocaleString("en-US")} (EARNED)\nCOMPLETION BONUS +${bonus.toLocaleString("en-US")}`;
}
