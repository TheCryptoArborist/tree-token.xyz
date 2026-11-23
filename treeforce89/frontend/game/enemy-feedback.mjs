// Presentation only. Existing scene timers retain attack, hit and pause timing.
export function applyEnemyFeedback(enemy, time) {
  if (!enemy.active) return;
  if (enemy.getData("feedbackHit")) return enemy.setTintFill(0xffffff);
  if (time < (enemy.getData("shieldStunUntil") || 0))
    return enemy.setTint(0x9dffb4);
  if (enemy.getData("feedbackDiveWarning") || enemy.getData("rescueWindow"))
    return enemy.setTint(0xffe06b);
  if (enemy.getData("boss")) {
    const stage = enemy.getData("bossDamageStage") || 0;
    if (stage === 1) return enemy.setTint(0xffd35a);
    if (stage === 2) return enemy.setTint(0xff8a62);
    if (stage >= 3)
      return enemy.setTint(Math.floor(time / 120) % 2 ? 0xff6b62 : 0xf2c94c);
  }
  if (enemy.getData("corrupted")) return enemy.setTint(0xff4fc8);
  if (enemy.getData("challengeTarget")) return enemy.setTint(0xffe493);
  // Mutation is expressed by its wasp texture, not a permanent warning tint.
  return enemy.clearTint();
}

export function setDiveWarning(enemy, active, time) {
  enemy.setData("feedbackDiveWarning", active);
  applyEnemyFeedback(enemy, time);
}

export function flashEnemyHit(scene, enemy, duration) {
  const token = {};
  enemy.setData("feedbackHit", token);
  applyEnemyFeedback(enemy, scene.time.now);
  scene.time.delayedCall(duration, () => {
    // Repeated hits extend the flash; an earlier callback must not end it.
    if (!enemy.active || enemy.getData("feedbackHit") !== token) return;
    enemy.setData("feedbackHit", null);
    applyEnemyFeedback(enemy, scene.time.now);
  });
}
