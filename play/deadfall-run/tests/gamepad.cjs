"use strict";
const assert = require("node:assert/strict"), G = require("../gamepad.js");
let passed = 0;
function test(name, run) { run(); console.log(`PASS ${name}`); passed++; }
function hardware(mapping = "standard", axes = 4, buttons = 16) {
  return { id: "Test NES adapter", index: 0, connected: true, mapping,
    buttons: Array.from({ length: buttons }, () => ({ pressed: false, value: 0 })), axes: Array(axes).fill(0) };
}
function fixture(pad = hardware(), storage) {
  const memory = new Map();
  storage ||= { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  const env = { pads: [pad], pad, memory, storage };
  env.controller = G.create({ navigator: { getGamepads: () => env.pads }, storage }); env.controller.poll();
  return env;
}
function push(pad, index, pressed = true) { pad.buttons[index] = { pressed, value: Number(pressed) }; }
function release(pad, center = Array(pad.axes.length).fill(0)) { pad.buttons.forEach((_, i) => push(pad, i, false)); pad.axes = center.slice(); }
function calibrate(f, inputs, center = Array(f.pad.axes.length).fill(0)) {
  release(f.pad, center); f.controller.poll(); assert(f.controller.beginSetup()); f.controller.poll();
  for (const input of inputs) {
    input(f.pad); f.controller.poll();
    release(f.pad, center); f.controller.poll();
  }
  assert(f.controller.status().ready); assert(!f.controller.status().calibrating); f.controller.poll();
}
const rawInputs = [p => p.axes[0] = -1, p => p.axes[0] = 1, p => p.axes[1] = -1, p => p.axes[1] = 1,
  p => push(p, 1), p => push(p, 0), p => push(p, 6), p => push(p, 7)];

test("standard D-pad and NES actions work, with one event per Start/Select press", () => {
  const f = fixture(), c = f.controller;
  for (const [action, index] of Object.entries({ left: 14, right: 15, up: 12, down: 13, a: 0, b: 1, select: 8, start: 9 })) {
    push(f.pad, index); let s = c.poll(); assert(s.held[action] && s.pressed[action]);
    s = c.poll(); assert(s.held[action] && !s.pressed[action]); release(f.pad); c.poll();
  }
  f.pad.axes[0] = .25; assert(!c.poll().held.right);
  f.pad.axes[0] = .8; assert(c.poll().held.right);
});
test("nonstandard two-axis NES mapping persists and restores at a different device index", () => {
  const f = fixture(hardware("", 2, 8)); assert(!f.controller.status().ready);
  calibrate(f, rawInputs); assert.equal(f.memory.size, 1);
  push(f.pad, 1); assert(f.controller.poll().held.a); release(f.pad);
  f.pad.index = 3; f.pads = [null, null, null, f.pad];
  const restored = G.create({ navigator: { getGamepads: () => f.pads }, storage: f.storage });
  restored.poll(); assert(restored.status().ready); f.pad.axes[0] = -1; assert(restored.poll().held.left);
});
test("single-axis POV adapters support cardinals and diagonal engine-brake steering", () => {
  const p = hardware("", 10, 8), center = Array(10).fill(0); center[9] = 23 / 7; p.axes = center.slice();
  const f = fixture(p), inputs = [5 / 7, -3 / 7, -1, 1 / 7].map(value => p => p.axes[9] = value).concat(rawInputs.slice(4));
  calibrate(f, inputs, center);
  p.axes[9] = -5 / 7; let s = f.controller.poll(); assert(s.held.up && s.held.right && !s.held.left && !s.held.down);
  p.axes[9] = 1; s = f.controller.poll(); assert(s.held.up && s.held.left && !s.held.right && !s.held.down);
  release(p, center); assert(!Object.values(f.controller.poll().held).some(Boolean));
});
test("adapters reporting D-pad buttons and axes together can be calibrated", () => {
  const f = fixture(hardware("", 2, 16));
  const inputs = [14, 15, 12, 13].map((index, i) => p => { push(p, index); p.axes[i < 2 ? 0 : 1] = i % 2 ? 1 : -1; });
  calibrate(f, inputs.concat(rawInputs.slice(4)));
  push(f.pad, 14); f.pad.axes[0] = -1; assert(f.controller.poll().held.left);
});
test("calibration requires release and refuses duplicate assignments", () => {
  const f = fixture(hardware("", 2, 8)), c = f.controller;
  c.beginSetup(); c.poll(); f.pad.axes[0] = -1; c.poll();
  for (let i = 0; i < 120; i++) c.poll(); assert.equal(c.status().step, 1);
  release(f.pad); c.poll(); f.pad.axes[0] = -1; c.poll(); assert.equal(c.status().step, 1);
  assert(c.status().message.includes("already assigned"));
  c.cancelSetup(); assert(!c.status().ready); assert.equal(f.memory.size, 0);
});
test("cancelled remapping retains the previously working setup", () => {
  const f = fixture(hardware("", 2, 8)); calibrate(f, rawInputs);
  const saved = [...f.memory.values()][0];
  f.controller.beginSetup(); f.controller.poll(); f.pad.axes[0] = 1; f.controller.poll(); f.controller.cancelSetup();
  release(f.pad); f.controller.poll(); push(f.pad, 1);
  assert(f.controller.poll().held.a); assert.equal([...f.memory.values()][0], saved);
});
test("disconnect and replacement devices clear held input and require release", () => {
  const f = fixture(); push(f.pad, 0); assert(f.controller.poll().held.a);
  f.pads = [null]; let s = f.controller.poll(); assert(s.lost); assert(!Object.values(s.held).some(Boolean));
  const next = hardware(); next.id = "Different pad"; push(next, 0); f.pads = [next];
  assert(!f.controller.poll().held.a); assert(!f.controller.poll().held.a);
  release(next); f.controller.poll(); push(next, 0); assert(f.controller.poll().held.a);
});
test("pause and focus loss block held controls until neutral, including calibration", () => {
  const f = fixture(), c = f.controller; push(f.pad, 0); assert(c.poll().held.a); c.suspend();
  assert(!c.poll().held.a); release(f.pad); c.poll(); push(f.pad, 0); assert(c.poll().held.a);
  assert(!c.poll(false).held.a); assert(!c.poll(true).held.a); release(f.pad); c.poll();
  c.beginSetup(); c.poll(); c.poll(false); push(f.pad, 14); c.poll(true); assert.equal(c.status().step, 0);
  release(f.pad); c.poll(); push(f.pad, 14); c.poll(); assert.equal(c.status().step, 1);
});
test("unavailable and denied Gamepad APIs do not break keyboard-only startup", () => {
  for (const navigator of [{}, { getGamepads: () => { throw Error("SecurityError"); } }]) {
    const c = G.create({ navigator, storage: null }); assert.doesNotThrow(() => c.poll());
    assert(!c.status().available); assert(!Object.values(c.poll().held).some(Boolean));
  }
});
test("bad saved profiles are ignored and blocked storage still allows session setup", () => {
  for (const text of ["{broken", JSON.stringify({ left: { type: "button", index: 9999 } })]) {
    const f = fixture(hardware("", 2, 8), { getItem: () => text, setItem() {} }); assert(!f.controller.status().ready);
  }
  const f = fixture(hardware("", 2, 8), { getItem() { throw Error("blocked"); }, setItem() { throw Error("quota"); } });
  calibrate(f, rawInputs); assert(f.controller.status().message.includes("this session"));
  push(f.pad, 1); assert(f.controller.poll().held.a);
});
console.log(`\n${passed} gamepad checks passed using synthetic device snapshots; no physical controller was attached.`);
