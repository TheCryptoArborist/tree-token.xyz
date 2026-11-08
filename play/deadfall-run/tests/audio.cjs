/* Audio graph/lifecycle checks. These do not replace listening on a real device. */
"use strict";
const assert = require("node:assert/strict"), { create } = require("../audio.js");
require("../engine-sample.js");
class Param {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(v, t) { assert(Number.isFinite(v) && Number.isFinite(t)); this.value = v; this.events.push(["set", v, t]); }
  setTargetAtTime(v, t, c) { assert(Number.isFinite(v) && Number.isFinite(t) && c > 0); this.value = v; this.events.push(["target", v, t]); }
  cancelScheduledValues(t) { this.events = this.events.filter(e => e[2] < t); }
}
class Node {
  constructor(context, kind) {
    this.kind = kind; this.outputs = []; context.nodes.push(this);
    for (const name of ["gain", "frequency", "playbackRate", "Q", "threshold", "knee", "ratio", "attack", "release"]) this[name] = new Param();
  }
  connect(node) { this.outputs.push(node); return node; }
  disconnect() { this.outputs = []; }
  start() { this.started = true; }
  stop() { this.stopped = true; }
  setPeriodicWave(wave) { this.wave = wave; }
}
class Context {
  static instances = [];
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = "suspended"; this.nodes = []; this.destination = {}; Context.instances.push(this); }
  createGain() { return new Node(this, "gain"); }
  createBiquadFilter() { return new Node(this, "filter"); }
  createOscillator() { return new Node(this, "oscillator"); }
  createBufferSource() { return new Node(this, "bufferSource"); }
  createDynamicsCompressor() { return new Node(this, "compressor"); }
  createPeriodicWave(real, imag) { return { real, imag }; }
  createBuffer(channels, length, sampleRate) { const data = new Float32Array(length); return { length, sampleRate, getChannelData: () => data }; }
  resume() { this.state = "running"; return Promise.resolve(); }
  close() { this.state = "closed"; return Promise.resolve(); }
}
const state = { speed: 0, throttle: 0 }, last = () => Context.instances.at(-1);
function master(ctx) { return ctx.nodes.find(n => n.kind === "gain" && n.outputs[0]?.kind === "compressor").gain; }
function air(ctx) { return ctx.nodes.find(n => n.type === "highpass").outputs[0].gain; }
let count = 0;
async function test(name, run) { await run(); count++; console.log(`PASS ${name}`); }
(async () => {
  await test("unsupported or denied audio leaves driving callers safe", async () => {
    for (const Type of [null, class { constructor() { throw Error("denied"); } }]) {
      const sound = create({ Context: Type }); assert.equal(await sound.unlock(), false);
      sound.update(state, {}, true, .016); sound.stop(); sound.dispose(); assert.equal(sound.status().supported, false);
    }
  });
  await test("audio is lazy, resume failure is retryable, and repeated starts reuse one graph", async () => {
    class Blocked extends Context { resume() { if (!this.allow) return Promise.reject(Error("gesture needed")); return super.resume(); } }
    const before = Context.instances.length, sound = create({ Context: Blocked }); assert.equal(Context.instances.length, before);
    assert.equal(await sound.unlock(), false); assert.equal(sound.status().supported, true);
    const ctx = last(), size = ctx.nodes.length; ctx.allow = true; assert.equal(await sound.unlock(), true);
    for (let i = 0; i < 20; i++) { sound.reset(); await sound.unlock(); sound.update(state, {}, true, .016); }
    assert.equal(ctx.nodes.length, size); assert.equal(Context.instances.length, before + 1); sound.dispose();
  });
  await test("engine pitch follows acceleration; engine braking has a separate audible layer", async () => {
    const sound = create({ Context }); await sound.unlock(); const ctx = last();
    const engine = ctx.nodes.find(n => n.buffer?.sampleRate === 22050), jake = ctx.nodes.find(n => n.buffer?.length === ctx.sampleRate * 2);
    assert(engine && engine.buffer.length > 80000); assert(engine.buffer.getChannelData(0).some(n => Math.abs(n) > .1));
    sound.update(state, {}, true, .1); const idle = engine.playbackRate.value;
    for (let i = 0; i < 30; i++) { ctx.currentTime += .1; sound.update({ speed: 12, throttle: 1 }, { throttle: true }, true, .1); }
    assert(engine.playbackRate.value > idle * 1.2); assert.equal(jake.outputs[0].outputs[0].gain.value, 0);
    sound.update({ speed: 12, throttle: 0 }, { engine: true }, true, .1); assert(jake.outputs[0].outputs[0].gain.value > 0);
    sound.update(state, { engine: true }, true, .1); assert.equal(jake.outputs[0].outputs[0].gain.value, 0); sound.dispose();
  });
  await test("air release occurs once after holding service brake, not during engine braking or rapid taps", async () => {
    const sound = create({ Context }); await sound.unlock(); const ctx = last(), hiss = air(ctx);
    for (let i = 0; i < 5; i++) { ctx.currentTime += .1; sound.update(state, { brake: true }, true, .1); }
    assert.equal(hiss.events.length, 0);
    ctx.currentTime += .1; sound.update(state, {}, true, .1);
    assert(hiss.events.some(e => e[0] === "set" && e[1] > 0)); const count = hiss.events.length;
    for (let i = 0; i < 10; i++) { ctx.currentTime += .1; sound.update({ speed: 8, throttle: 0 }, { engine: true }, true, .1); }
    assert.equal(hiss.events.length, count);
    sound.reset(); sound.update(state, { brake: true }, true, .01); sound.update(state, {}, true, .01);
    assert.equal(hiss.value, 0); sound.dispose();
  });
  await test("pause, mute, zero volume, reset and disposal silence all output immediately", async () => {
    const sound = create({ Context }); await sound.unlock(); const ctx = last(), output = master(ctx);
    for (const action of [() => sound.stop(), () => sound.update(state, {}, false, .1), () => sound.setEnabled(false), () => sound.setVolume(0), () => sound.reset()]) {
      sound.setEnabled(true); sound.setVolume(.6); sound.update(state, {}, true, .1); assert(output.value > 0);
      action(); assert.equal(output.value, 0); assert.equal(air(ctx).value, 0);
    }
    sound.dispose(); assert.equal(ctx.state, "closed"); assert(ctx.nodes.filter(n => n.started).every(n => n.stopped));
  });
  await test("impacts and scrapes add bounded sound and are silenced by pause", async () => {
    const sound = create({ Context }); await sound.unlock(); const ctx = last();
    sound.update({ speed: 8, throttle: 0, scraping: .8 }, {}, true, .1);
    const scrape = ctx.nodes.find(n => n.type === "bandpass" && n.frequency.value === 1200).outputs[0];
    assert(scrape.gain.value > 0 && scrape.gain.value <= .22);
    sound.impact({ object: { kind: "barrier" }, speed: 20 });
    const crash = ctx.nodes.find(n => n.type === "bandpass" && n.frequency.value === 900).outputs[0];
    assert(crash.gain.events.some(e => e[0] === "set" && e[1] > 0 && e[1] <= .85));
    sound.stop(); assert.equal(crash.gain.value, 0); assert.equal(scrape.gain.value, 0); assert.equal(master(ctx).value, 0);
    sound.dispose();
  });
  await test("disabling the engine preserves the impact decay while pause still silences it", async () => {
    const sound = create({ Context }); await sound.unlock(); const ctx = last();
    sound.update({ speed: 12, throttle: 1 }, { throttle: true }, true, .1);
    sound.impact({ object: { kind: "tree" }, speed: 12 });
    const crash = ctx.nodes.find(n => n.type === "bandpass" && n.frequency.value === 240).outputs[0];
    const events = JSON.stringify(crash.gain.events);
    sound.update({ speed: 0, throttle: 0, disabled: true }, {}, true, .1);
    assert.equal(JSON.stringify(crash.gain.events), events, "engine shutdown cancelled the impact envelope");
    const engine = ctx.nodes.find(n => n.buffer?.sampleRate === 22050);
    assert.equal(engine.outputs[0].outputs[0].gain.value, 0); assert(master(ctx).value > 0);
    sound.update({ disabled: true }, {}, false, .1); assert.equal(master(ctx).value, 0); assert.equal(crash.gain.value, 0);
    sound.dispose();
  });
  await test("settings survive reload and corrupt/blocked storage degrades to defaults", async () => {
    let data = null; const storage = { getItem: () => data, setItem: (_, value) => data = value };
    const sound = create({ Context, storage }); sound.setVolume(.35); sound.setEnabled(false);
    const restored = create({ Context, storage }); assert.equal(restored.status().volume, .35); assert.equal(restored.status().enabled, false);
    assert.equal(await restored.unlock(), false);
    for (const storage of [{ getItem: () => "oops" }, { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } }]) {
      const fallback = create({ Context, storage }); assert.equal(fallback.status().volume, .6); fallback.setVolume(1); fallback.setEnabled(false);
    }
  });
  await test("extreme sound inputs remain finite and volume cannot exceed its limit", async () => {
    const sound = create({ Context }); await sound.unlock(); const ctx = last(); sound.setVolume(1000);
    for (const speed of [-Infinity, NaN, -40, 0, 2000]) for (const throttle of [NaN, 0, 1, 1000]) {
      ctx.currentTime += .1; sound.update({ speed, throttle }, {}, true, .1, 1);
      assert(master(ctx).value >= 0 && master(ctx).value <= .46);
    }
    assert.equal(sound.status().supported, true); sound.setVolume(NaN); assert.equal(sound.status().volume, 0); sound.dispose();
  });
  console.log(`\n${count} audio lifecycle/graph checks passed with an AudioContext stub; no speaker listening test.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
