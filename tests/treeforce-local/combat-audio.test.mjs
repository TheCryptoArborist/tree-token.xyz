import { test } from "node:test";
import assert from "node:assert/strict";
import { CueMixer, CUES } from "../../treeforce89/frontend/game/audio-cues.mjs";

function context() {
  const nodes = [],
    gains = [];
  return {
    currentTime: 0,
    destination: {},
    nodes,
    gains,
    createOscillator() {
      const node = {
        frequency: { setValueAtTime() {} },
        connect() {},
        start() {},
        stop() {
          this.stopCalls = (this.stopCalls || 0) + 1;
        },
        disconnect() {},
      };
      nodes.push(node);
      return node;
    },
    createGain() {
      const ramps = [];
      gains.push(ramps);
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime(value, time) {
            ramps.push({ value, time });
          },
        },
        connect() {},
        disconnect() {},
      };
    },
  };
}

test("a hit or kill 20ms after firing remains audible", () => {
  for (const category of ["hit", "kill"]) {
    const m = new CueMixer(),
      c = context();
    assert.equal(m.combat(c, "fire", 620, 0.025, 0.03), true);
    c.currentTime = 0.02;
    assert.equal(m.combat(c, category, 230, 0.06, 0.06), true);
    assert.equal(m.voices.filter((v) => v.category === "impact").length, 2);
  }
});
test("enemy fire has its own throttle; repeated firing is still capped", () => {
  const m = new CueMixer(),
    c = context();
  assert.equal(m.combat(c, "fire", 620), true);
  assert.equal(m.combat(c, "enemyFire", 350), true);
  assert.equal(m.combat(c, "fire", 620), false);
  assert.equal(m.combat(c, "enemyFire", 350), false);
});
test("kill during upgrade is accepted at reduced volume, without replacing the motif", () => {
  const m = new CueMixer(),
    c = context();
  assert.equal(m.play(c, "upgrade"), true);
  const motif = [...m.voices];
  assert.equal(m.combat(c, "kill", 230, 0.06, 0.06), true);
  assert.equal(m.voices.length, 6);
  assert(motif.every((v) => m.voices.includes(v) && v.osc.stopCalls === 1));
  assert.equal(c.gains[4][0].value, 0.06 * 0.55 * 0.7);
  assert.ok(Math.abs(m.duckUntil - 0.46) < 1e-9);
});
test("named cue does not erase a just-triggered impact", () => {
  const m = new CueMixer(),
    c = context();
  m.combat(c, "kill", 230, 0.06, 0.06);
  const impact = [...m.voices];
  m.play(c, "upgrade");
  assert(impact.every((v) => m.voices.includes(v)));
});
test("impact burst and total voices are bounded; silent effects stay silent", () => {
  const m = new CueMixer(),
    c = context();
  m.play(c, "perfect");
  assert.equal(m.combat(c, "hit", 150, 0.2, 0.03), true);
  assert.equal(m.combat(c, "kill", 230, 0.2, 0.06), true);
  c.currentTime = 0.04;
  assert.equal(m.combat(c, "kill", 230, 0.2, 0.06), false);
  assert.equal(m.voices.length, 10);
  m.sfxVolume = 0;
  assert.equal(m.combat(c, "hit", 150), false);
  assert.equal(m.play(c, "seed"), false);
});
test("late ended callbacks cannot remove new voices after preemption or stop", () => {
  const m = new CueMixer(),
    c = context();
  m.combat(c, "fire", 620);
  const old = [...c.nodes];
  m.play(c, "upgrade");
  const expected = [...m.voices];
  old.forEach((n) => n.onended());
  assert.deepEqual(m.voices, expected);
  const removed = [...c.nodes];
  m.stop();
  assert.equal(m.voices.length, 0);
  c.currentTime = 1;
  m.play(c, "seed");
  const current = [...m.voices];
  removed.forEach((n) => n.onended());
  assert.deepEqual(m.voices, current);
});
test("expired voices and cooldowns allow subsequent feedback", () => {
  const m = new CueMixer(),
    c = context();
  m.combat(c, "kill", 230, 0.06, 0.06);
  c.currentTime = 0.1;
  assert.equal(m.combat(c, "kill", 230, 0.06, 0.06), true);
  assert.equal(m.voices.length, 2);
});
test("existing motif inventory and legacy rate limit remain available", () => {
  assert.equal(Object.keys(CUES).length, 24);
  const m = new CueMixer(),
    c = context();
  assert.equal(m.shot(c, 760), true);
  assert.equal(m.combat(c, "legacy", 760), false);
  assert.equal(m.play(c, "not-a-cue"), false);
});
