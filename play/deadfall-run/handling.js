/* Observable test criteria. No wallet, network, or persisted score. */
(function (root) {
  "use strict";
  function create(R, P) {
    const tests = {
      braking: { title: "20 mph stop", start: 30, end: 125, limit: 120,
        hint: "Reach 18–22 mph at the white line. Then hold S and stop inside the marked zone." },
      grade: { title: "Downhill control", start: 250, end: 475, limit: 180,
        hint: "Starts rolling at 16 mph. Keep 12–22 mph using SPACE for engine braking and S when needed." },
      turns: { title: "Trailer tracking", start: 530, end: 790, limit: 180,
        hint: "Drive through all three cone gates below 18 mph. Leave room for the trailer to cut inside each bend." },
      reverse: { title: "Reverse docking", start: 175, end: 125, limit: 180,
        hint: "Stop, release the brakes, then hold V / D-pad DOWN to back into the gold bay. Straighten and hold S / B for 2 seconds." }
    };
    function prepare(id, state) {
      if (id === "grade") state.speed = 16 / 2.237;
      if (id === "reverse") { state.pos.x += 1.3; state.yaw += THREE.MathUtils.degToRad(6); }
    }
    function begin(id, state) {
      if (!tests[id]) throw new Error("Unknown handling test");
      return { id, config: tests[id], time: 0, phase: "approach", entrySpeed: null, stopDistance: 0,
        stopHold: 0, brakeStart: null, distance: 0, previous: state.pos.clone(), maxSpeed: 0,
        maxHeat: 0, maxArticulation: 0, maxGap: 0, maxLane: 0, serviceTime: 0, engineTime: 0,
        inBand: 0, gateCount: 0, coneHits: new Set(), done: false, success: false, reason: "" };
    }
    function end(s, success, reason) { s.done = true; s.success = success; s.reason = reason; }
    function sample(s, state, tractor, trailer, input, dt, cones = []) {
      if (s.done) return s;
      s.time += dt;
      s.distance += state.pos.distanceTo(s.previous); s.previous.copy(state.pos);
      const mph = Math.abs(state.speed) * 2.237, lane = R.nearest(state.pos).lane;
      const gap = tractor.localToWorld(P.HITCH.clone()).distanceTo(trailer.localToWorld(P.KINGPIN.clone()));
      s.maxSpeed = Math.max(s.maxSpeed, mph); s.maxHeat = Math.max(s.maxHeat, state.brakeHeat);
      s.maxGap = Math.max(s.maxGap, gap); s.maxLane = Math.max(s.maxLane, Math.abs(lane));
      s.maxArticulation = Math.max(s.maxArticulation, Math.abs(state.articulation) * 180 / Math.PI);
      if (input.brake && mph > .5) s.serviceTime += dt;
      if (input.engine && mph > .5) s.engineTime += dt;
      if (mph >= 12 && mph <= 22) s.inBand += dt;
      for (const cone of cones) {
        if (s.coneHits.has(cone.id) || Math.abs(state.progress - cone.d) > 24) continue;
        for (const body of [tractor, trailer]) {
          const p = body.worldToLocal(cone.mesh.position.clone());
          const back = body === tractor ? 3.4 : 4.99;
          if (Math.abs(p.x) < 1.75 && p.z > -5.1 && p.z < back + .25) {
            s.coneHits.add(cone.id); break;
          }
        }
      }
      if (s.maxGap > .001) end(s, false, "Hitch alignment exceeded 1 mm.");
      else if (state.logs < 5) end(s, false, "A log was lost. Retry with smaller corrections.");
      else if (s.time > s.config.limit) end(s, false, "Time limit reached. Retry the same setup.");
      else if (Math.abs(lane) > 23 || state.progress < -15 || state.progress > 920) end(s, false, "Outside the test area.");
      if (s.done) return s;
      if (s.id === "braking") {
        // The visible front bumper crossing the line starts the measurement.
        const nose = R.nearest(tractor.localToWorld(new THREE.Vector3(0, 0, -4.7))).d;
        if (s.entrySpeed === null && nose >= 90) { s.entrySpeed = mph; s.phase = "braking"; }
        if (s.entrySpeed !== null) {
          if (input.brake && s.brakeStart === null) s.brakeStart = s.distance;
          s.stopDistance = Math.max(s.stopDistance, nose - 90);
          s.stopHold = Math.abs(state.speed) < .08 && input.brake ? s.stopHold + dt : 0;
          if (s.stopHold >= 1) {
            const target = s.entrySpeed >= 18 && s.entrySpeed <= 22;
            end(s, target && s.stopDistance <= 35 && s.maxLane <= 4.2 && !s.coneHits.size,
              !target ? "Cross the white line at 18–22 mph for a valid comparison." :
              s.stopDistance > 35 ? "Stopped beyond the marked zone." :
              s.maxLane > 4.2 || s.coneHits.size ? "Keep both bodies inside the lane." : "Stopped inside the zone with the full load.");
          } else if (nose > 150 || nose < 85) end(s, false, "Missed the stopping zone.");
        }
      } else if (s.id === "grade" && state.progress >= s.config.end) {
        end(s, s.maxSpeed <= 25 && s.inBand / s.time >= .75 && s.maxLane <= 5.5,
          s.maxSpeed > 25 ? "Peak speed exceeded 25 mph." : s.inBand / s.time < .75 ? "Keep 12–22 mph for at least 75% of the descent." :
          s.maxLane > 5.5 ? "Keep the truck on the road." : "Grade controlled with all five logs.");
      } else if (s.id === "turns") {
        const rear = R.nearest(trailer.localToWorld(new THREE.Vector3(0, 0, 4.99))).d;
        s.gateCount = [590, 650, 710].filter(d => rear > d + 2).length;
        if (rear >= 775) end(s, !s.coneHits.size && s.maxSpeed <= 18 && s.maxLane <= 5.5,
          s.coneHits.size ? "A cone was touched. Give the trailer more room." : s.maxSpeed > 18 ? "Stay below 18 mph through the bends." :
          s.maxLane > 5.5 ? "Keep the truck on the course." : "Both bodies cleared every gate.");
      } else if (s.id === "reverse") {
        const center = R.nearest(trailer.position), heading = Math.abs(P.angle(state.trailerYaw)) * 180 / Math.PI;
        s.bayOffset = Math.abs(center.lane); s.bayDistance = center.d - 125;
        s.bayAngle = heading;
        const cornersFit = [-1.5, 1.5].every(x => [-4.85, 4.99].every(z => {
          const corner = R.nearest(trailer.localToWorld(new THREE.Vector3(x, 0, z)));
          return Math.abs(corner.lane) <= 2.3 && corner.d >= 118.5 && corner.d <= 131.5;
        }));
        const parked = cornersFit && Math.abs(center.d - 125) < 1.5 && Math.abs(center.lane) < .55 && heading < 5 && Math.abs(state.articulation) < .12;
        s.stopHold = parked && Math.abs(state.speed) < .08 && input.brake ? s.stopHold + dt : 0;
        if (s.stopHold >= 2) end(s, !s.coneHits.size, s.coneHits.size ? "Docked, but a cone was touched." : "Trailer centered, straight, and held at rest.");
      }
      return s;
    }
    function status(s) {
      if (s.id === "braking") return s.entrySpeed === null ? "Approach · 18–22 mph at the white line" : `Brake now · ${s.stopDistance.toFixed(1)} m from line`;
      if (s.id === "grade") return `In speed band · ${Math.round(s.inBand / Math.max(.01, s.time) * 100)}% (target 75%)`;
      if (s.id === "turns") return `${s.gateCount}/3 gates cleared · ${s.coneHits.size} cone touches`;
      return `Bay · ${Math.abs(s.bayDistance || 0).toFixed(1)} m away · ${(s.bayOffset || 0).toFixed(1)} m off-center`;
    }
    function report(s) {
      const rows = [["Test time", `${s.time.toFixed(1)} s`], ["Peak speed", `${s.maxSpeed.toFixed(1)} mph`],
        ["Peak brake heat", `${Math.round(s.maxHeat)}%`], ["Maximum hitch gap", `${(s.maxGap * 1000).toFixed(3)} mm`],
        ["Maximum articulation", `${s.maxArticulation.toFixed(1)}°`]];
      if (s.id === "braking") rows.unshift(["Speed at white line", s.entrySpeed === null ? "Not reached" : `${s.entrySpeed.toFixed(1)} mph`], ["Stop distance from line", `${s.stopDistance.toFixed(1)} m`]);
      if (s.id === "grade") rows.unshift(["Time at 12–22 mph", `${Math.round(s.inBand / Math.max(.01, s.time) * 100)}%`], ["Service / engine brake", `${s.serviceTime.toFixed(1)} / ${s.engineTime.toFixed(1)} s`]);
      if (s.id === "turns" || s.id === "reverse") rows.unshift(["Cone touches", String(s.coneHits.size)]);
      return rows;
    }
    return { tests, prepare, begin, sample, status, report, create };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { create };
  else root.DeadfallLab = create(root.DeadfallRoute, root.DeadfallPhysics);
})(typeof window !== "undefined" ? window : globalThis);
