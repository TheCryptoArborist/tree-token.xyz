/* Deadfall Run: 3D field-test build 0.5.7. No remote requests or transactions. */
(function () {
  "use strict";
  try {
    if (!window.THREE || !window.DeadfallVehicle) throw new Error("A bundled game file is missing. Please reload the page.");
    const R = DeadfallRoute, P = DeadfallPhysics, V = DeadfallVehicle, L = window.DeadfallLab || null;
    if (document.body.classList.contains("handling") && (!L || !window.DeadfallHandlingWorld || !R.isHandling)) {
      throw new Error("A handling-test file is missing. Extract the complete ZIP into a new folder.");
    }
    const $ = id => document.getElementById(id);
    const ui = { speed: $("speed"), brake: $("brakeMeter"), brakeText: $("brakeText"), damage: $("damageMeter"),
      damageText: $("damageText"), load: $("loadMeter"), loadText: $("loadText"), cargo: $("cargo"),
      distance: $("distance"), progress: $("routeProgress"), dispatch: $("dispatch"), start: $("start"),
      result: $("result"), resultTitle: $("resultTitle"), resultKicker: $("resultKicker"), resultStats: $("resultStats"),
      drive: $("drive"), pause: $("pause"), paused: $("paused"), camera: $("camera"), cameraHint: $("cameraHint"),
      quality: $("quality"), gear: $("gear"), diagnostics: $("diagnostics") };
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, .10, 5200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "3D mountain road and articulated log truck");
    $("game").appendChild(renderer.domElement);
    const world = L ? DeadfallHandlingWorld.create(scene) : DeadfallWorld.create(scene), truck = V.make(); scene.add(truck);
    const { tractor, trailer } = truck.userData;
    const keys = new Set(), touch = { throttle: false, brake: false, engine: false, reverse: false };
    const input = { left: false, right: false, throttle: false, brake: false, engine: false, reverse: false, touchSteer: 0 };
    const keyMap = { KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyW: "throttle", ArrowUp: "throttle",
      KeyS: "brake", ArrowDown: "brake", Space: "engine", KeyV: "reverse" };
    const pad = DeadfallGamepad.create(), controllerPanel = $("controllerPanel");
    const sound = DeadfallAudio.create(), effects = DeadfallEffects.create(scene), ride = DeadfallRide.create(R);
    const contacts = DeadfallCollision.create(R, P, world.solids, hit => {
      world.impact(hit); effects.impact(hit); sound.impact(hit); ride.impact(hit, tractor, trailer);
      lastImpact = { kind: hit.object.kind, body: hit.body, speed: hit.speed, at: state.elapsed, broken: hit.broken };
      const part = hit.body === "trailer" ? "Trailer" : "Truck";
      showMessage(hit.broken ? `${part} impact. ${hit.object.kind === "tree" ? "Small tree knocked down" : "Timber pushed aside"}; check your load.` :
        `${part} hit ${hit.object.kind === "barrier" ? "the guardrail" : hit.object.kind === "tree" ? "a tree" : "a rock"}. Brake, then reverse clear or press R to recover.`, 5);
    });
    let padHeld = DeadfallGamepad.empty(), focused = true, returnFocus = null, controllerText = "";
    controllerPanel.hidden = true;
    const cameraNames = L ? ["CHASE", "HOOD", "INSPECT", "OVERHEAD"] : ["CHASE", "HOOD", "INSPECT"], qualityNames = ["LOW", "BALANCED", "HIGH"];
    let state, running = false, paused = false, selectedPreset = L ? "loaded" : "standard", cameraMode = 0, quality = 1;
    let selectedTest = "braking", session = null;
    let aftermath = null, lastImpact = null, crashView = false;
    let last = performance.now(), accumulator = 0, messageTimer = 0, diagnostics = false, hudTimer = 0, fps = 60;
    let orbitAngle = 1.05, orbitHeight = .38, orbitDistance = 24, drag = null;
    const fixed = 1 / 120, camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    function readInput() {
      for (const action of ["left", "right", "throttle", "brake", "engine", "reverse"]) input[action] = Boolean(touch[action]);
      for (const key of keys) if (keyMap[key]) input[keyMap[key]] = true;
      input.left ||= padHeld.left; input.right ||= padHeld.right;
      input.throttle ||= padHeld.a; input.brake ||= padHeld.b;
      input.engine ||= padHeld.up && !padHeld.down; input.reverse ||= padHeld.down && !padHeld.up;
      if (input.brake) { input.throttle = false; input.reverse = false; }
      else if (input.reverse) input.throttle = false;
    }
    function clearInput(silence = true) {
      if (silence) sound.stop();
      keys.clear(); Object.keys(touch).forEach(k => touch[k] = false);
      padHeld = DeadfallGamepad.empty(); pad.suspend();
      input.touchSteer = 0; $("steer").value = "0"; readInput();
      document.querySelectorAll("[data-control]").forEach(b => b.classList.remove("active"));
    }
    function setQuality(next) {
      quality = next;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [1, 1.4, 1.8][quality]));
      renderer.shadowMap.enabled = quality !== 0;
      world.sun.shadow.mapSize.set(quality === 2 ? 2048 : 1024, quality === 2 ? 2048 : 1024);
      if (world.sun.shadow.map) { world.sun.shadow.map.dispose(); world.sun.shadow.map = null; }
      scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
      ui.quality.textContent = `DETAIL · ${qualityNames[quality]}`;
    }
    function setCamera(next, snap = false) {
      cameraMode = next; drag = null; ui.camera.textContent = `CAMERA · ${cameraNames[next]}`;
      updateControlHint();
      renderer.domElement.style.cursor = next === 2 ? "grab" : "default"; updateCamera(1 / 60, snap);
    }
    function updateControlHint() {
      // Read the request before brake priority suppresses the driving input so
      // a held brake can explain why reverse is not moving the truck.
      const requested = keys.has("KeyV") || touch.reverse || (padHeld.down && !padHeld.up);
      if (requested && running && !paused && !aftermath) {
        ui.cameraHint.textContent = input.brake ? "REVERSE · RELEASE THE SERVICE BRAKE TO BACK UP" :
          input.engine ? "REVERSE · RELEASE THE ENGINE BRAKE TO BACK UP" :
          !state.reverse && state.speed >= .25 ? "REVERSE · STOP WITH S / ↓ OR CONTROLLER B FIRST" :
          "REVERSING · HOLD V / D-PAD DOWN · RELEASE TO COAST";
      } else {
        ui.cameraHint.textContent = cameraMode === 2 ? "DRAG TO ORBIT  ·  SCROLL TO ZOOM  ·  C TO CHANGE" :
          `V · REVERSE     C · CAMERA     R · ${L ? "RETRY" : "RECOVER"}     SPACE · ENGINE BRAKE`;
      }
    }
    function showMessage(text, seconds = 4) {
      ui.dispatch.querySelector("span").textContent = text; ui.dispatch.classList.add("show"); messageTimer = seconds;
    }
    function reset(d = 0) {
      if (L) d = L.tests[selectedTest].start;
      aftermath = lastImpact = null; crashView = false; ui.result.classList.remove("crash-result");
      document.body.classList.remove("crashed");
      state = P.createState(d); clearInput(); sound.reset(); effects.reset(); contacts.reset(); world.reset(); accumulator = 0; paused = false;
      if (L) { L.prepare(selectedTest, state); session = L.begin(selectedTest, state); world.selectTest(selectedTest); }
      ui.pause.textContent = "PAUSE"; ui.paused.hidden = true;
      P.couple(state, tractor, trailer, true); ride.reset(state, tractor, trailer); V.update(truck, state, input, ride); updateUI();
    }
    function start() {
      sound.unlock();
      reset(); running = true; document.body.classList.add("driving");
      ui.start.classList.remove("active"); ui.result.classList.remove("active");
      ui.pause.disabled = false; setCamera(L && selectedTest === "reverse" ? 3 : 0, true); last = performance.now();
      if (!L) showMessage("Five logs. One descent. Use SPACE to control speed on the grade.", 6);
      ui.drive.blur();
    }
    function setPaused(value) {
      if (!running) return;
      paused = value; clearInput(); accumulator = 0; last = performance.now();
      ui.pause.textContent = paused ? "RESUME" : "PAUSE"; ui.paused.hidden = !paused;
      if (!paused) sound.unlock();
    }
    function soundUI() {
      const s = sound.status();
      const on = s.supported && s.enabled && s.ready;
      $("soundSummary").textContent = `SOUND · ${!s.supported ? "N/A" : !s.enabled || !s.volume ? "OFF" : s.ready ? "ON" : "ENABLE"}`;
      $("soundToggle").textContent = on ? "MUTE SOUND" : "ENABLE SOUND";
      $("soundToggle").setAttribute("aria-pressed", String(on));
      $("soundToggle").disabled = $("soundVolume").disabled = !s.supported;
      $("soundStatus").textContent = !s.supported ? "Sound is unavailable in this browser. You can still drive." :
        !s.enabled ? "Sound muted." : !s.ready ? "Click Enable sound to allow audio. This may be needed after starting with a controller." :
        !s.volume ? "Volume is at zero. Raise it to hear the truck." : "Engine, road and brake sound. Audio is silent while paused or in menus.";
      $("soundLevel").textContent = `${Math.round(s.volume * 100)}%`;
    }
    function controllerUI() {
      const s = pad.status(), text = JSON.stringify(s);
      if (text === controllerText) return;
      controllerText = text;
      $("controllerStatus").textContent = s.message;
      $("controllerDevice").textContent = s.name;
      $("controllerPrompt").textContent = s.message;
      $("controllerBegin").disabled = !s.connected || s.calibrating;
      $("controllerBegin").textContent = s.ready ? "REMAP BUTTONS" : "BEGIN SETUP";
      $("controllerCancel").hidden = !s.calibrating;
      $("controllerOptions").textContent = s.ready ? "CONTROLLER · READY" : "CONTROLLER";
    }
    function openController() {
      returnFocus = document.activeElement;
      if (running) setPaused(true); else clearInput();
      controllerPanel.hidden = false; controllerUI(); $("controllerClose").focus();
    }
    function closeController() {
      if (pad.status().calibrating) pad.cancelSetup();
      controllerPanel.hidden = true; clearInput(); controllerUI();
      if (returnFocus?.focus) returnFocus.focus();
    }
    function controllerFrame() {
      const result = pad.poll(focused && !document.hidden);
      padHeld = result.held;
      if (result.lost) {
        clearInput(); if (running) setPaused(true);
        showMessage("Controller disconnected. Reconnect or use the keyboard, then resume.", 6);
      }
      controllerUI();
      if (!controllerPanel.hidden) {
        padHeld = DeadfallGamepad.empty();
        if (!pad.status().calibrating && result.pressed.start) closeController();
        return;
      }
      if (result.pressed.start) {
        if (!ui.drive.disabled) { if (running) setPaused(!paused); else start(); }
        return;
      }
      if (result.pressed.select && (running || crashView)) setCamera((cameraMode + 1) % cameraNames.length);
      if (!running) {
        if (ui.result.classList.contains("active")) { if (result.pressed.b) menu(); }
        else {
          const buttons = Array.from(document.querySelectorAll(L ? "[data-test]" : "[data-preset]"));
          const direction = (result.pressed.right || result.pressed.down ? 1 : 0) - (result.pressed.left || result.pressed.up ? 1 : 0);
          if (direction && buttons.length) {
            const index = buttons.findIndex(b => (L ? b.dataset.test === selectedTest : b.dataset.preset === selectedPreset));
            buttons[(index + direction + buttons.length) % buttons.length].click();
          }
        }
      }
    }
    function recover() {
      if (!running || paused) return;
      if (aftermath) { showMessage("The truck needs repairs. Watch the impact settle, then choose RESTART DESCENT."); return; }
      if (L) { start(); return; }
      const old = state, d = R.clamp(state.progress, 0, R.LENGTH - 30);
      // Choose a clear complete-rig pose; recovery must not spawn inside a rock.
      let recovered;
      for (const offset of [0, -15, -30, -50]) {
        for (const lane of [0, 2.5, -2.5]) {
          const at = R.clamp(d + offset, 0, R.LENGTH - 30), candidate = P.createState(at);
          candidate.pos.copy(R.frame(at, lane).p); candidate.pos.y = R.surfaceHeight(candidate.pos.x, candidate.pos.z);
          P.couple(candidate, tractor, trailer, true);
          if (!contacts.overlaps(tractor, trailer)) { recovered = candidate; break; }
        }
        if (recovered) break;
      }
      state = recovered || P.createState(0); effects.reset(); sound.reset(); state.logs = old.logs; state.damage = R.clamp(old.damage + 5, 0, 100);
      state.brakeHeat = old.brakeHeat; state.elapsed = old.elapsed; state.collisions = old.collisions;
      lastImpact = null;
      clearInput(); P.couple(state, tractor, trailer, true); ride.reset(state, tractor, trailer); V.update(truck, state, input, ride); updateCamera(1 / 60, true); updateUI();
      showMessage("Back on the road. Recovery adds 5% damage; missing logs stay missing.");
      if (state.damage >= 100) finish(false);
    }
    function updateCamera(dt, snap = false) {
      const f = new THREE.Vector3(Math.sin(state.yaw), 0, -Math.cos(state.yaw));
      const right = new THREE.Vector3(Math.cos(state.yaw), 0, Math.sin(state.yaw));
      const center = tractor.position.clone().lerp(trailer.position, .54).add(new THREE.Vector3(0, 1.85, 0));
      let desired, look;
      if (!running && !crashView) {
        desired = center.clone().addScaledVector(f, 14).addScaledVector(right, 19).add(new THREE.Vector3(0, 8.1, 0)); look = center;
      } else if (cameraMode === 1) {
        desired = tractor.userData.visual.localToWorld(new THREE.Vector3(0, 3.09, -2.62));
        look = desired.clone().addScaledVector(f, 34); look.y += Math.sin(state.pitch) * 34 - .45;
      } else if (cameraMode === 3) {
        look = selectedTest === "reverse" ? center.clone().lerp(R.frame(125).p, .42) : center;
        desired = look.clone().add(new THREE.Vector3(0, 58, 14));
      } else if (cameraMode === 2) {
        desired = center.clone().addScaledVector(f, -Math.cos(orbitAngle) * orbitDistance)
          .addScaledVector(right, Math.sin(orbitAngle) * orbitDistance).add(new THREE.Vector3(0, orbitDistance * orbitHeight, 0)); look = center;
      } else {
        desired = state.pos.clone().addScaledVector(f, -25).addScaledVector(right, 1.4).add(new THREE.Vector3(0, 10.5, 0));
        look = state.pos.clone().addScaledVector(f, -1.5).add(new THREE.Vector3(0, 1.9, 0));
      }
      if (cameraMode !== 1 || !running) desired.y = Math.max(desired.y, R.terrainHeight(desired.x, desired.z) + 2);
      const t = snap ? 1 : 1 - Math.exp(-dt * P.presets[selectedPreset].camera);
      camPos.lerp(desired, t); camLook.lerp(look, snap ? 1 : 1 - Math.exp(-dt * 5.2));
      camera.position.copy(camPos); camera.lookAt(camLook);
      if (!running && !crashView && innerWidth > 760) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * .15, 0, innerWidth, innerHeight);
      else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    }
    function updateUI() {
      soundUI();
      updateControlHint();
      const load = Math.min(100, Math.abs(state.sway) * 60 + Math.abs(state.articulation) * 30);
      $("surface").textContent = (state.surface || "asphalt").toUpperCase();
      ui.speed.textContent = Math.round(Math.abs(state.speed) * 2.237); ui.gear.textContent = state.reverse || state.speed < -.1 ? "R" : "D";
      ui.brake.style.width = `${state.brakeHeat}%`; ui.brake.style.background = state.brakeHeat > 80 ? "#ef876a" : "#c9b778";
      ui.brakeText.textContent = state.brakeHeat > 88 ? "FADE" : state.brakeHeat > 62 ? "HOT" : "COOL";
      ui.damage.style.width = `${state.damage}%`; ui.damage.style.background = state.damage > 65 ? "#ef876a" : "#9ccba4";
      ui.damageText.textContent = `${Math.round(state.damage)}%`; ui.load.style.width = `${load}%`;
      ui.load.style.background = load > 70 ? "#ef876a" : "#9ccba4"; ui.loadText.textContent = load > 82 ? "CRITICAL" : load > 55 ? "SHIFTING" : "SECURE";
      ui.cargo.textContent = `${state.logs}/5`; ui.distance.textContent = `${Math.max(0, Math.round(R.LENGTH - state.progress)).toLocaleString()} m`;
      ui.progress.style.width = `${state.progress / R.LENGTH * 100}%`;
      if (L && session) {
        const cfg = session.config, span = cfg.end - cfg.start;
        ui.distance.textContent = cfg.title.toUpperCase();
        ui.progress.style.width = `${R.clamp((state.progress - cfg.start) / span, 0, 1) * 100}%`;
        $("labTitle").textContent = cfg.title;
        $("labPhase").textContent = L.status(session);
        $("labHint").textContent = cfg.hint;
        $("labSteer").textContent = `${(state.steer * 180 / Math.PI).toFixed(0)}°`;
        $("labAngle").textContent = `${(state.articulation * 180 / Math.PI).toFixed(0)}°`;
        $("labHitch").textContent = `${(session.maxGap * 1000).toFixed(3)} mm`;
        $("labTime").textContent = `${session.time.toFixed(1)} s`;
      }
      if (diagnostics) {
        const gap = tractor.localToWorld(P.HITCH.clone()).distanceTo(trailer.localToWorld(P.KINGPIN.clone()));
        ui.diagnostics.textContent = `WEBGL 3D  /  ${Math.round(fps)} FPS  /  ${renderer.info.render.calls} DRAWS  /  HITCH ${(gap * 1000).toFixed(3)} mm  /  ARTICULATION ${(state.articulation * 180 / Math.PI).toFixed(1)}°`;
      }
    }
    function beginAftermath() {
      aftermath = { time: 0 }; crashView = true;
      state.speed = state.throttle = state.scraping = 0; state.disabled = true;
      clearInput(false); accumulator = 0; document.body.classList.add("crashed");
      // Keep the driver's camera through the initial impact, then ease to an
      // inspection view. No driving integration occurs while the rig settles.
      showMessage("Severe damage — engine stopped. The truck and load are settling.", 3);
    }
    function finish(success, settled = false) {
      if (!running) return;
      if (!success && state.damage >= 100 && !settled) { if (!aftermath) beginAftermath(); return; }
      running = false; paused = false; clearInput(); ui.paused.hidden = true; ui.pause.disabled = true;
      aftermath = null;
      const entries = [["Route finish", success ? 10000 : 0], ["Delivered cargo", success ? state.logs * 2000 : 0],
        ["Full load bonus", success && state.logs === 5 ? 5000 : 0], ["Truck condition", success ? Math.round((100 - state.damage) * 30) : 0],
        ["Time bonus", success ? Math.max(0, 3000 - Math.round(Math.max(0, state.elapsed - 95) * 35)) : 0]];
      entries.push(["TOTAL SCORE", entries.reduce((sum, [, value]) => sum + value, 0)]);
      if (crashView) {
        ui.result.classList.add("crash-result");
        const hit = lastImpact && state.elapsed - lastImpact.at < .2 ? lastImpact : null;
        const object = hit?.kind === "tree" ? "Tree" : hit?.kind === "barrier" ? "Guardrail" : hit?.kind === "limb" ? "Timber" : "Rock";
        ui.resultKicker.textContent = "RECOVERY REQUIRED"; ui.resultTitle.textContent = "Rig out of service.";
        $("resultReason").textContent = hit ? `${object} impact at ${Math.round(hit.speed * 2.237)} mph. ${hit.body === "trailer" ? "Trailer" : "Tractor"} contact brought accumulated damage to 100%.` : "Accumulated damage reached 100%. The engine has shut down.";
        ui.resultStats.innerHTML = `<div><span>Load remaining</span><b>${state.logs}/5 logs</b></div><div><span>Distance covered</span><b>${Math.round(state.progress)} m</b></div>`;
        $("again").textContent = "RESTART DESCENT";
        $("resultNote").textContent = "Drag to inspect the crash. C / SELECT changes camera. Restart or press START for a fresh truck and load.";
        ui.result.classList.add("active"); ui.dispatch.classList.remove("show"); return;
      }
      ui.resultKicker.textContent = success ? "DELIVERY COMPLETE" : "RUN ENDED";
      ui.resultTitle.textContent = success ? `${state.logs}/5 logs delivered.` : "Cargo lost.";
      $("resultReason").textContent = ""; $("again").textContent = "DRIVE AGAIN";
      $("resultNote").textContent = "Local test score only. No TREE payments or trading are connected.";
      ui.resultStats.innerHTML = entries.map(([label, value]) => `<div><span>${label}</span><b>${value.toLocaleString()}</b></div>`).join(""); ui.result.classList.add("active");
    }
    function finishTest() {
      running = false; paused = false; clearInput(); ui.paused.hidden = true; ui.pause.disabled = true;
      ui.resultKicker.textContent = session.success ? "TEST PASSED" : "TRY THIS TEST AGAIN";
      ui.resultTitle.textContent = session.config.title;
      $("resultReason").textContent = session.reason;
      ui.resultStats.innerHTML = L.report(session).map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("");
      ui.result.classList.add("active");
    }
    function menu() {
      running = false; clearInput(); ui.pause.disabled = true;
      ui.result.classList.remove("active"); ui.start.classList.add("active"); document.body.classList.remove("driving");
      reset(); updateCamera(1 / 60, true);
    }
    function frame(now) {
      const elapsed = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
      if (elapsed > 0) fps = fps * .97 + 1 / elapsed * .03;
      controllerFrame();
      readInput();
      if (running && !paused && focused && !document.hidden && aftermath) {
        const before = aftermath.time; aftermath.time += elapsed;
        clearInput(false); accumulator += elapsed;
        while (accumulator >= fixed) { ride.step(state, tractor, trailer, fixed); accumulator -= fixed; }
        V.update(truck, state, input, ride);
        if (before < .55 && aftermath.time >= .55) { orbitAngle = 1.05; orbitHeight = .38; orbitDistance = 22; setCamera(2); }
        if (aftermath.time >= 2.6) finish(false, true);
      } else if (running && !paused) {
        accumulator += elapsed;
        while (accumulator >= fixed && running && !aftermath) {
          const previous = DeadfallCollision.capture(state);
          const event = P.step(state, input, fixed, selectedPreset); P.couple(state, tractor, trailer);
          const hit = contacts.resolve(state, previous, tractor, trailer, fixed);
          ride.step(state, tractor, trailer, fixed);
          state.scraping = hit?.object.kind === "barrier" && Math.abs(state.speed) > .5 ? Math.min(1, Math.abs(state.speed) / 10) : 0;
          accumulator -= fixed;
          if (event.lost) showMessage("Cargo lost. Slow down before making another correction.");
          if (L) {
            L.sample(session, state, tractor, trailer, input, fixed, world.cones);
            if (session.done) finishTest();
          } else if (state.damage >= 100 || state.logs === 0) finish(false);
          else if (state.progress >= R.LENGTH - 12) finish(true);
        }
        V.update(truck, state, input, ride); messageTimer -= elapsed;
        if (messageTimer <= 0) ui.dispatch.classList.remove("show");
      }
      const animate = (running || crashView) && !paused && focused && !document.hidden && controllerPanel.hidden;
      updateCamera(elapsed); world.update(state.pos, state.progress, animate ? elapsed : 0);
      effects.update(elapsed, state, tractor, animate, renderer.domElement.height || innerHeight);
      sound.update(state, input, running && !paused && focused && !document.hidden, elapsed, cameraMode);
      hudTimer += elapsed; if (hudTimer > .08) { updateUI(); hudTimer = 0; }
      renderer.render(scene, camera); requestAnimationFrame(frame);
    }
    addEventListener("keydown", event => {
      if (!controllerPanel.hidden) {
        if (event.code === "Escape") { event.preventDefault(); closeController(); }
        if (event.code === "Tab") {
          const buttons = [$("controllerBegin"), $("controllerCancel"), $("controllerClose")].filter(b => !b.disabled && !b.hidden);
          const index = buttons.indexOf(document.activeElement);
          buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus(); event.preventDefault();
        }
        return;
      }
      if (event.target.tagName === "INPUT" || event.target.tagName === "SELECT") return;
      if (keyMap[event.code] && running && !paused && !aftermath) { sound.unlock(); keys.add(event.code); event.preventDefault(); }
      if (event.repeat) return;
      if (event.code === "KeyC" && (running || crashView)) setCamera((cameraMode + 1) % cameraNames.length);
      if (event.code === "KeyR") recover();
      if (event.code === "Escape") setPaused(!paused);
      if (event.code === "F3") { diagnostics = !diagnostics; ui.diagnostics.hidden = !diagnostics; event.preventDefault(); }
    });
    addEventListener("keyup", event => { keys.delete(event.code); if (keyMap[event.code] && running) event.preventDefault(); });
    addEventListener("blur", () => { focused = false; clearInput(); if (running) setPaused(true); });
    addEventListener("focus", () => { focused = true; pad.suspend(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && running) setPaused(true); });
    addEventListener("pagehide", () => { if (running) setPaused(true); sound.dispose(); });
    document.querySelectorAll("[data-control]").forEach(button => {
      const action = button.dataset.control;
      button.addEventListener("pointerdown", e => {
        e.preventDefault(); if (!running || paused || aftermath) return;
        sound.unlock();
        button.setPointerCapture(e.pointerId); touch[action] = true; button.classList.add("active");
      });
      const release = () => { touch[action] = false; button.classList.remove("active"); };
      button.addEventListener("pointerup", release); button.addEventListener("pointercancel", release); button.addEventListener("lostpointercapture", release);
    });
    const steer = $("steer");
    steer.addEventListener("input", () => { input.touchSteer = Number(steer.value) / 100; });
    const centerSteering = () => { steer.value = "0"; input.touchSteer = 0; };
    steer.addEventListener("pointerup", () => { centerSteering(); steer.blur(); }); steer.addEventListener("pointercancel", centerSteering); steer.addEventListener("blur", centerSteering);
    renderer.domElement.addEventListener("pointerdown", event => {
      if (cameraMode !== 2 || (!running && !crashView)) return;
      drag = { x: event.clientX, y: event.clientY, id: event.pointerId }; renderer.domElement.setPointerCapture(event.pointerId);
    });
    renderer.domElement.addEventListener("pointermove", event => {
      if (!drag || event.pointerId !== drag.id) return;
      orbitAngle -= (event.clientX - drag.x) * .006; orbitHeight = R.clamp(orbitHeight + (event.clientY - drag.y) * .004, .12, .92);
      drag.x = event.clientX; drag.y = event.clientY;
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) renderer.domElement.addEventListener(name, () => drag = null);
    renderer.domElement.addEventListener("wheel", event => {
      if (cameraMode !== 2 || (!running && !crashView)) return;
      event.preventDefault(); orbitDistance = R.clamp(orbitDistance + event.deltaY * .018, 13, 40);
    }, { passive: false });
    ui.drive.addEventListener("click", start);
    $("soundVolume").value = String(Math.round(sound.status().volume * 100));
    $("soundToggle").addEventListener("click", () => {
      const s = sound.status(); sound.setEnabled(!(s.enabled && s.ready));
      sound.unlock(); soundUI();
    });
    $("soundVolume").addEventListener("input", () => {
      sound.setVolume(Number($("soundVolume").value) / 100); soundUI();
    });
    $("controllerSetup").addEventListener("click", openController);
    $("controllerOptions").addEventListener("click", openController);
    $("controllerClose").addEventListener("click", closeController);
    $("controllerBegin").addEventListener("click", () => { pad.beginSetup(); controllerUI(); });
    $("controllerCancel").addEventListener("click", () => { pad.cancelSetup(); controllerUI(); });
    $("again").addEventListener("click", () => { if (crashView) start(); else menu(); });
    ui.pause.addEventListener("click", () => setPaused(!paused)); $("resume").addEventListener("click", () => setPaused(false));
    ui.camera.addEventListener("click", () => { if (running || crashView) setCamera((cameraMode + 1) % cameraNames.length); });
    ui.quality.addEventListener("click", () => setQuality((quality + 1) % 3)); $("recover").addEventListener("click", recover);
    document.querySelectorAll("[data-preset]").forEach(button => button.addEventListener("click", () => {
      selectedPreset = button.dataset.preset;
      document.querySelectorAll("[data-preset]").forEach(b => { b.classList.toggle("active", b === button); b.setAttribute("aria-pressed", String(b === button)); });
    }));
    if (L) {
      $("menu").addEventListener("click", menu); $("retry").addEventListener("click", start); $("retryResult").addEventListener("click", start);
      document.querySelectorAll("[data-test]").forEach(button => button.addEventListener("click", () => {
        selectedTest = button.dataset.test;
        document.querySelectorAll("[data-test]").forEach(b => { b.classList.toggle("active", b === button); b.setAttribute("aria-pressed", String(b === button)); });
        $("testDescription").textContent = L.tests[selectedTest].hint;
        reset(); updateCamera(1 / 60, true);
      }));
    }
    addEventListener("resize", () => {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    });
    renderer.domElement.addEventListener("webglcontextlost", event => {
      event.preventDefault(); if (running) setPaused(true);
      window.showBootError("The graphics connection was lost. Reload the game and choose LOW detail.");
    });
    setQuality(1); reset(); updateCamera(1 / 60, true); world.update(state.pos, state.progress); renderer.render(scene, camera);
    pad.poll(); controllerUI();
    ui.drive.disabled = false; ui.drive.textContent = L ? "START HANDLING TEST" : "BEGIN DESCENT";
    $("bootStatus").textContent = `3D ready · ${L ? "Handling Lab" : "Stormbreak Pass"} · Build 0.5.7`;
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error); window.showBootError(error.message || "3D graphics could not start. Try a browser with hardware acceleration enabled.");
  }
})();
