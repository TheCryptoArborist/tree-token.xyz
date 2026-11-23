import test from "node:test";
import assert from "node:assert/strict";
import {
  faceFlightPath,
  animateEnemy,
} from "../../treeforce89/frontend/game/combat-visuals.mjs";
test("facing follows tangent, with downward flight at zero degrees", () => {
  for (const [x, y, want] of [
    [0, 1, 0],
    [1, 0, -90],
    [-1, 0, 90],
    [0, -1, -180],
  ]) {
    let angle;
    const e = { setAngle: (value) => (angle = value) };
    faceFlightPath(e, { getTangent: () => ({ x, y }) }, 0.4);
    assert.equal(angle, want);
  }
  let angle = 42;
  faceFlightPath(
    { setAngle: (v) => (angle = v) },
    { getTangent: () => ({ x: 0, y: 0 }) },
    0,
  );
  assert.equal(angle, 42);
});
function enemy(key, data = {}) {
  return {
    active: true,
    phase: 0,
    texture: { key },
    getData: (key) => data[key],
    setTexture(key) {
      this.texture.key = key;
    },
  };
}
test("poses alternate at 125ms without movement, scale or tint APIs", () => {
  const e = enemy("bat");
  animateEnemy(e, 0);
  assert.equal(e.texture.key, "bat-flight-0");
  animateEnemy(e, 125);
  assert.equal(e.texture.key, "bat-flight-1");
  animateEnemy(e, 250);
  assert.equal(e.texture.key, "bat-flight-0");
  e.texture.key = "wasp";
  animateEnemy(e, 375);
  assert.equal(e.texture.key, "wasp-flight-1");
});
test("special identities and stunned enemies retain their current pose", () => {
  for (const flag of ["leader", "guardian", "challengeTarget", "corrupted"]) {
    const e = enemy("bat", { [flag]: true });
    animateEnemy(e, 125);
    assert.equal(e.texture.key, "bat");
  }
  const e = enemy("bat-flight-0", { shieldStunUntil: 450 });
  animateEnemy(e, 125);
  assert.equal(e.texture.key, "bat-flight-0");
  for (const key of [
    "rootCaptor",
    "canopyTyrant",
    "leaderCracked",
    "borer",
    "spore",
    "playerSheet",
  ]) {
    const e = enemy(key);
    animateEnemy(e, 125);
    assert.equal(e.texture.key, key);
  }
});

test("formation entry straightens smoothly during its final fifth", () => {
  let angle;
  const e = { setAngle: (value) => (angle = value) },
    curve = { getTangent: () => ({ x: 1, y: 0 }) };
  faceFlightPath(e, curve, 0.8, true);
  assert.equal(angle, -90);
  faceFlightPath(e, curve, 0.9, true);
  assert.ok(Math.abs(angle + 45) < 1e-8);
  faceFlightPath(e, curve, 1, true);
  assert.ok(Math.abs(angle) < 1e-8);
});
