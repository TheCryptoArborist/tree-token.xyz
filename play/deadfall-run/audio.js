/* Original procedural diesel, road and air-brake sound. No files or network.
   Audio RPM is an expressive approximation; it never changes vehicle physics. */
(function (root) {
  "use strict";
  const clamp = (n, low, high) => Math.max(low, Math.min(high, Number.isFinite(n) ? n : low));
  const key = "deadfall-sound-v1";
  function create(options = {}) {
    const Context = options.Context === undefined ? root.AudioContext || root.webkitAudioContext : options.Context;
    let storage;
    try { storage = options.storage === undefined ? root.localStorage : options.storage; } catch (_) {}
    let enabled = true, volume = .6;
    try {
      const saved = JSON.parse(storage?.getItem(key) || "null");
      if (saved && typeof saved.enabled === "boolean") enabled = saved.enabled;
      if (saved && Number.isFinite(saved.volume)) volume = clamp(saved.volume, 0, 1);
    } catch (_) {}
    let ctx = null, nodes = null, sources = [], pending = null, failed = false;
    let active = false, previousBrake = false, heldBrake = 0, lastRelease = -10, rpm = 650;
    function save() { try { storage?.setItem(key, JSON.stringify({ enabled, volume })); } catch (_) {} }
    function target(param, value, seconds = .08) {
      param.cancelScheduledValues(ctx.currentTime);
      param.setTargetAtTime(value, ctx.currentTime, seconds);
    }
    function zero(param) { param.cancelScheduledValues(ctx.currentTime); param.setValueAtTime(0, ctx.currentTime); }
    function gain(value = 0) { const n = ctx.createGain(); n.gain.value = value; return n; }
    function filter(type, frequency, q = .6) {
      const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = frequency; n.Q.value = q; return n;
    }
    function oscillator(type, destination) {
      const n = ctx.createOscillator(); n.type = type; n.connect(destination); n.start(); sources.push(n); return n;
    }
    function build() {
      const master = gain(), compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12; compressor.knee.value = 18; compressor.ratio.value = 8;
      compressor.attack.value = .006; compressor.release.value = .2;
      master.connect(compressor); compressor.connect(ctx.destination);
      const engineGain = gain(), engineFilter = filter("lowpass", 650), subGain = gain();
      engineFilter.connect(engineGain); engineGain.connect(master); subGain.connect(master);
      const engine = oscillator("sawtooth", engineFilter), sub = oscillator("sine", subGain);
      const real = new Float32Array(25), imag = new Float32Array(25);
      for (let n = 1; n < imag.length; n++) imag[n] = (n % 3 === 0 ? .45 : 1) / Math.pow(n, .85);
      engine.setPeriodicWave(ctx.createPeriodicWave(real, imag));
      // A repeatable, three-second noise loop shared by independent filtered buses.
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 3), ctx.sampleRate), data = buffer.getChannelData(0);
      let seed = 72891;
      for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
      const noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
      const road = gain(), air = gain(), mechanical = gain(), jake = gain();
      const roadFilter = filter("lowpass", 500), airFilter = filter("highpass", 1500), mechanicalFilter = filter("bandpass", 380, .7);
      const jakeFilter = filter("lowpass", 1000);
      noise.connect(roadFilter); roadFilter.connect(road); road.connect(master);
      noise.connect(airFilter); airFilter.connect(air); air.connect(master);
      noise.connect(mechanicalFilter); mechanicalFilter.connect(mechanical); mechanical.connect(master);
      // Exhaust-brake chatter has a sharper harmonic pulse than the running engine.
      const jakeOsc = oscillator("sawtooth", jakeFilter); jakeFilter.connect(jake); jake.connect(master);
      noise.start(); sources.push(noise);
      nodes = { master, compressor, engineGain, engineFilter, subGain, engine, sub, road, roadFilter,
        air, mechanical, mechanicalFilter, jake, jakeOsc };
    }
    function stop() {
      active = false; previousBrake = false; heldBrake = 0;
      if (nodes) { zero(nodes.master.gain); zero(nodes.air.gain); }
    }
    function dispose() {
      if (nodes) stop();
      for (const source of sources) { try { source.stop(); source.disconnect(); } catch (_) {} }
      sources = []; nodes = null;
      if (ctx) { try { const closing = ctx.close(); if (closing?.catch) closing.catch(() => {}); } catch (_) {} }
      ctx = null; pending = null;
    }
    async function unlock() {
      if (!Context || failed || !enabled) return false;
      if (pending) return pending;
      try {
        if (!ctx) { ctx = new Context({ latencyHint: "interactive" }); build(); }
        if (ctx.state === "closed") { dispose(); return false; }
        if (ctx.state === "running") return true;
        // Called only from start/input UI. A blocked resume never blocks driving.
        const current = ctx;
        pending = Promise.resolve(ctx.resume()).then(() => current === ctx && ctx.state === "running", () => false);
        const resumed = await pending; pending = null; return resumed;
      } catch (_) { dispose(); failed = true; return false; }
    }
    function reset() { stop(); rpm = 650; lastRelease = -10; }
    function setEnabled(value) { enabled = Boolean(value); if (!enabled) stop(); save(); }
    function setVolume(value) { volume = clamp(Number(value), 0, 1); if (!volume) stop(); save(); }
    function status() { return { supported: Boolean(Context) && !failed, enabled, volume, ready: ctx?.state === "running" }; }
    function update(state, input, driving, dt, cameraMode = 0) {
      if (!nodes) return;
      if (!driving || !enabled || volume === 0 || ctx.state !== "running") { stop(); return; }
      try {
        const speed = clamp(Math.abs(state.speed), 0, 45), throttle = clamp(state.throttle, 0, 1);
        const brake = Boolean(input.brake), engineBrake = Boolean(input.engine) && speed > .7 && !input.throttle;
        dt = clamp(dt, 0, .1);
        // Stepped ratios are sound cues only; gears are not part of the handling model.
        const gears = [2.8, 5.8, 9.4, 14.4, 20.5, 28, 40], top = speed < .2 ? gears[0] : gears.find(limit => speed < limit) || 40;
        const wanted = clamp(650 + speed / top * 1080 + throttle * 240, 650, 2050);
        rpm += (wanted - rpm) * (1 - Math.exp(-dt * 5));
        const firing = rpm / 20; // six-cylinder, four-stroke firing frequency
        target(nodes.engine.frequency, firing); target(nodes.sub.frequency, firing / 2);
        target(nodes.jakeOsc.frequency, firing);
        target(nodes.engineFilter.frequency, 450 + rpm * .28 + throttle * 450);
        target(nodes.engineGain.gain, engineBrake ? .07 : .08 + throttle * .075);
        target(nodes.subGain.gain, .045 + throttle * .025);
        target(nodes.mechanical.gain, .025 + throttle * .025);
        target(nodes.mechanicalFilter.frequency, 240 + rpm * .22);
        target(nodes.jake.gain, engineBrake ? .10 : 0, .05);
        target(nodes.roadFilter.frequency, 320 + speed * 38);
        target(nodes.road.gain, Math.min(.15, speed * .005));
        // One brief air release after a deliberate service-brake application.
        // Holding the brake, using the engine brake, or rapid taps cannot spam it.
        if (active && previousBrake && !brake && heldBrake >= .12 && ctx.currentTime - lastRelease > .5) {
          zero(nodes.air.gain); nodes.air.gain.setValueAtTime(.18, ctx.currentTime);
          nodes.air.gain.setTargetAtTime(0, ctx.currentTime + .025, .11); lastRelease = ctx.currentTime;
        }
        heldBrake = brake ? heldBrake + dt : 0; previousBrake = brake; active = true;
        target(nodes.master.gain, volume * (cameraMode === 1 ? .36 : .46), .04);
      } catch (_) { dispose(); failed = true; }
    }
    return { unlock, stop, reset, dispose, setEnabled, setVolume, status, update };
  }
  root.DeadfallAudio = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = root.DeadfallAudio;
})(typeof window !== "undefined" ? window : globalThis);
