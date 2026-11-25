import test from "node:test";
import assert from "node:assert/strict";
import {
  animateEnemy,
  faceFlightPath,
} from "../../treeforce89/frontend/game/enemy-animation.mjs";
const enemy = (key = "bat", data = {}) => ({
  active: true,
  phase: 0,
  texture: { key },
  getData: (k) => data[k],
  setData: (k, v) => (data[k] = v),
  setAngle(v) {
    this.angle = v;
  },
  setTexture(key) {
    this.texture.key = key;
  },
});
test("six distinct pose selections retain the 250ms cycle without physics/RNG APIs", () => {
  const e = enemy();
  const keys = [];
  for (const t of [0, 42, 84, 126, 168, 210]) {
    animateEnemy(e, t);
    keys.push(e.texture.key);
  }
  assert.equal(new Set(keys).size, 6);
  animateEnemy(e, 250);
  assert.equal(e.texture.key, keys[0]);
});
test("curve handedness controls symmetric banking; straight paths do not bank", () => {
  for (const sign of [-1, 1]) {
    const e = enemy();
    faceFlightPath(
      e,
      {
        getTangent: (p) => ({
          x: Math.cos(sign * p * 6),
          y: Math.sin(sign * p * 6),
        }),
      },
      0.4,
    );
    assert.equal(Math.sign(e.getData("flightBank")), sign);
  }
  const e = enemy();
  faceFlightPath(e, { getTangent: () => ({ x: 1, y: 1 }) }, 0.4);
  assert.equal(e.getData("flightBank"), 0);
});
test("entry finishes upright and settled/returning enemies use neutral wings", () => {
  const e = enemy("bat", { flightBank: 2 });
  faceFlightPath(
    e,
    { getTangent: (p) => ({ x: Math.cos(p * 6), y: Math.sin(p * 6) }) },
    1,
    true,
  );
  assert.equal(e.getData("flightBank"), 0);
  for (const state of ["settled", "returning"]) {
    const a = enemy("wasp", { flightBank: 2 });
    a[state] = true;
    animateEnemy(a, 0);
    assert.equal(a.texture.key, "wasp-wing-0-0");
  }
});
test("special identities, stun and non-winged art remain intact", () => {
  for (const flag of [
    "leader",
    "guardian",
    "challengeTarget",
    "corrupted",
    "shieldStunUntil",
  ]) {
    const e = enemy("bat", { [flag]: 500 });
    animateEnemy(e, 100);
    assert.equal(e.texture.key, "bat");
  }
  for (const key of [
    "borer",
    "spore",
    "rootCaptor",
    "canopyTyrant",
    "playerSheet",
  ]) {
    const e = enemy(key);
    animateEnemy(e, 100);
    assert.equal(e.texture.key, key);
  }
});
