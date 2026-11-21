/* NES-style controls through the browser Gamepad API. No drivers or dependencies. */
(function (root) {
  "use strict";
  const actions = ["left", "right", "up", "down", "a", "b", "select", "start"];
  const labels = { left: "D-pad LEFT", right: "D-pad RIGHT", up: "D-pad UP", down: "D-pad DOWN",
    a: "A", b: "B", select: "SELECT", start: "START" };
  const empty = () => Object.fromEntries(actions.map(a => [a, false]));
  const button = b => typeof b === "number" ? b > .5 : Boolean(b && (b.pressed || b.value > .5));
  function key(pad) { return "deadfall.nes.v1:" + JSON.stringify([pad.id, pad.mapping, pad.buttons.length, pad.axes.length]); }
  function standard(pad) {
    if (pad.mapping !== "standard" || pad.buttons.length < 16) return null;
    return Object.fromEntries(Object.entries({ left: 14, right: 15, up: 12, down: 13, a: 0, b: 1, select: 8, start: 9 })
      .map(([action, index]) => [action, { type: "button", index }]));
  }
  function valid(map, pad) {
    if (!map || typeof map !== "object") return false;
    const seen = new Set();
    return actions.every(action => {
      const b = map[action];
      if (!b || !Number.isInteger(b.index) || b.index < 0) return false;
      if (b.type === "button") { if (b.index >= pad.buttons.length) return false; }
      else if (b.type === "axis" && ["left", "right", "up", "down"].includes(action)) {
        if (b.index >= pad.axes.length || !Number.isFinite(b.value) || !Number.isFinite(b.center) || Math.abs(b.value - b.center) < .4) return false;
      } else return false;
      const id = JSON.stringify([b.type, b.index, b.type === "axis" ? b.value : 0]);
      if (seen.has(id)) return false; seen.add(id); return true;
    });
  }
  function normalize(map) {
    // Some NES adapters expose a single eight-way POV axis instead of X/Y.
    // Four equally spaced cardinal values describe its circular range; include
    // the intervening diagonal values so UP+RIGHT can brake and steer together.
    const result = Object.fromEntries(actions.map(a => {
      const b = map[a];
      return [a, b.type === "button" ? { type: b.type, index: b.index }
        : { type: b.type, index: b.index, value: b.value, center: b.center }];
    }));
    const dirs = ["left", "right", "up", "down"].map(a => result[a]);
    if (dirs.every(b => b.type === "axis" && b.index === dirs[0].index)) {
      const values = dirs.map(b => b.value).sort((a, b) => a - b), spacing = (values[3] - values[0]) / 3;
      if (spacing > .1 && values.slice(1).every((v, i) => Math.abs(v - values[i] - spacing) < .04)
        && Math.abs(Math.abs(result.left.value - result.right.value) - 2 * spacing) < .04
        && Math.abs(Math.abs(result.up.value - result.down.value) - 2 * spacing) < .04) {
        dirs.forEach(b => { b.period = spacing * 4; b.tolerance = spacing * .56; });
      }
    }
    return result;
  }
  function readBinding(pad, b) {
    if (b.type === "button") return button(pad.buttons[b.index]);
    const v = pad.axes[b.index];
    if (!Number.isFinite(v) || Math.abs(v - b.center) < .18) return false;
    let distance = Math.abs(v - b.value);
    if (b.period) distance = Math.abs(((v - b.value + b.period * 1.5) % b.period) - b.period / 2);
    return distance < (b.tolerance || .18);
  }
  function create(options = {}) {
    const nav = options.navigator || root.navigator || {};
    let storage = options.storage;
    if (storage === undefined) { try { storage = root.localStorage; } catch (_) { storage = null; } }
    let current = null, profile = null, native = false, previous = empty(), blocked = true;
    let setup = null, note = "", apiError = "", canSave = true;
    function suspend() { blocked = true; previous = empty(); if (setup) setup.waitRelease = true; }
    function load(pad) {
      let saved = null;
      try { saved = JSON.parse(storage?.getItem(key(pad)) || "null"); } catch (_) { /* Keyboard and session controls still work. */ }
      native = !valid(saved, pad); profile = native ? standard(pad) : normalize(saved);
      suspend();
    }
    function neutral(pad, baseline) {
      return !Array.from(pad.buttons).some(button) && Array.from(pad.axes).every((v, i) => Math.abs(v - baseline[i]) < .18);
    }
    function capture(pad) {
      if (setup.waitRelease) {
        if (neutral(pad, setup.baseline)) {
          setup.waitRelease = false;
          if (setup.index === actions.length) {
            profile = normalize(setup.map); native = false;
            try { if (!storage) throw Error("No storage"); storage.setItem(key(pad), JSON.stringify(setup.map)); canSave = true; }
            catch (_) { canSave = false; }
            setup = null; note = canSave ? "Setup saved. Close this panel, then press START." : "Setup ready for this session. Close this panel, then press START.";
            suspend();
          }
        }
        return;
      }
      const action = actions[setup.index], buttons = Array.from(pad.buttons).flatMap((b, index) => button(b) ? [index] : []);
      const axes = Array.from(pad.axes).flatMap((v, index) => Math.abs(v - setup.baseline[index]) > .4 ? [index] : []);
      let binding = null;
      if (buttons.length === 1 && (axes.length === 0 || setup.index < 4)) binding = { type: "button", index: buttons[0] };
      else if (buttons.length === 0 && axes.length === 1 && setup.index < 4) binding = {
        type: "axis", index: axes[0], value: pad.axes[axes[0]], center: setup.baseline[axes[0]] };
      else if (buttons.length || axes.length) { note = "Press just the requested direction or button."; return; }
      if (!binding) return;
      const duplicate = Object.values(setup.map).some(b => b.type === binding.type && b.index === binding.index
        && (b.type === "button" || Math.abs(b.value - binding.value) < .18));
      if (duplicate) { note = "That input is already assigned. Release it and press the requested control."; return; }
      setup.map[action] = binding; setup.index++; setup.waitRelease = true; note = "";
    }
    function poll(enabled = true) {
      let pads = [];
      apiError = "";
      try {
        if (typeof nav.getGamepads !== "function") apiError = "Controller access is unavailable here. Keyboard controls still work.";
        else pads = Array.from(nav.getGamepads() || []).filter(p => p && p.connected !== false);
      } catch (_) { apiError = "Controller access is blocked by this browser. Open the game directly, or use keyboard controls."; }
      const before = current;
      let pad = current && pads.find(p => p.index === current.index && key(p) === key(current));
      const lost = Boolean(before && !pad);
      if (!pad) pad = pads[0] || null;
      const changed = Boolean(pad && (!current || pad.index !== current.index || key(pad) !== key(current)));
      current = pad;
      if (lost) { setup = null; note = "Controller disconnected. Reconnect, release the controls, then press START."; suspend(); }
      if (changed) { load(pad); if (!lost) note = ""; }
      if (!pad) { profile = null; previous = empty(); return { held: empty(), pressed: empty(), lost, changed }; }
      if (!enabled) { suspend(); return { held: empty(), pressed: empty(), lost, changed }; }
      if (setup) { capture(pad); return { held: empty(), pressed: empty(), lost, changed }; }
      let held = empty();
      if (profile) {
        actions.forEach(a => held[a] = readBinding(pad, profile[a]));
        // Standard pads also accept a left stick. Raw NES axes are calibrated.
        if (native) { held.left ||= pad.axes[0] < -.55; held.right ||= pad.axes[0] > .55;
          held.up ||= pad.axes[1] < -.55; held.down ||= pad.axes[1] > .55; }
      }
      if (blocked) {
        if (!actions.some(a => held[a])) blocked = false;
        previous = held; return { held: empty(), pressed: empty(), lost, changed };
      }
      const pressed = Object.fromEntries(actions.map(a => [a, held[a] && !previous[a]]));
      previous = held;
      return { held, pressed, lost, changed };
    }
    function beginSetup() {
      if (!current) { note = "Connect your controller, then press and release a button to wake it."; return false; }
      if (Array.from(current.buttons).some(button)) { note = "Release every button, center the D-pad, then click BEGIN SETUP."; return false; }
      setup = { index: 0, map: {}, baseline: Array.from(current.axes), waitRelease: true };
      note = ""; suspend(); return true;
    }
    function cancelSetup() { setup = null; note = "Setup cancelled. Your previous mapping is unchanged."; suspend(); }
    function status() {
      const connected = Boolean(current), ready = connected && Boolean(profile);
      let message = apiError || (connected ? (ready ? "Controller ready · START to play / pause · SELECT for camera" : "Controller detected · Open Controller setup to map its buttons")
        : "Connect a controller and press a button to wake it.");
      if (note && !apiError) message = note;
      if (setup) message = note || (setup.waitRelease ? "Release the D-pad and all buttons." : `Step ${setup.index + 1}/8 · Press ${labels[actions[setup.index]]}`);
      return { connected, ready, calibrating: Boolean(setup), name: current?.id || "No controller detected", message,
        step: setup?.index ?? -1, waitingRelease: Boolean(setup?.waitRelease), available: !apiError };
    }
    return { poll, status, beginSetup, cancelSetup, suspend };
  }
  const api = { create, actions, labels, empty };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DeadfallGamepad = api;
})(typeof window !== "undefined" ? window : globalThis);
