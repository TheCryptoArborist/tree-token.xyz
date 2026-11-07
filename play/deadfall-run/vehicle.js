/* Detailed, original procedural logging rig. Units are metres. */
(function (root) {
  "use strict";
  const W = root.DeadfallWorld, M = W.materials, { box, cylinder, at } = W;
  function profile(width, points, material, bevel = .045) {
    const shape = new THREE.Shape();
    points.forEach(([z, y], i) => i ? shape.lineTo(-z, y) : shape.moveTo(-z, y)); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSegments: 2,
      steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 3 });
    g.rotateY(Math.PI / 2); g.translate(-width / 2, 0, 0);
    const mesh = new THREE.Mesh(g, material); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
  }
  function pipe(points, radius, material) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 3, radius, 6, false), material);
    mesh.castShadow = true; return mesh;
  }
  function reshapePipe(mesh) {
    const g = mesh.geometry, { path, tubularSegments: n, radialSegments: sides, radius } = g.parameters;
    path.updateArcLengths();
    const frames = path.computeFrenetFrames(n, false), center = new THREE.Vector3(), normal = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      path.getPointAt(i / n, center);
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * Math.PI * 2, index = i * (sides + 1) + j;
        normal.copy(frames.normals[i]).multiplyScalar(-Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
        g.attributes.position.setXYZ(index, center.x + radius * normal.x, center.y + radius * normal.y, center.z + radius * normal.z);
        g.attributes.normal.setXYZ(index, normal.x, normal.y, normal.z);
      }
    }
    g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere();
  }
  function wheel() {
    const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.add(spin);
    const tire = cylinder(.52, .29, M.tire, 28); tire.rotation.z = Math.PI / 2; spin.add(tire);
    for (const side of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.37, .145, 7, 28), M.tire);
      ring.rotation.y = Math.PI / 2; at(spin, ring, side * .085, 0, 0); ring.castShadow = true;
      const hub = cylinder(.272, .025, M.chrome, 20); hub.rotation.z = Math.PI / 2; at(spin, hub, side * .155, 0, 0);
      const cap = cylinder(.105, .065, M.darkMetal, 14); cap.rotation.z = Math.PI / 2; at(spin, cap, side * .18, 0, 0);
      const bolts = [];
      for (let n = 0; n < 8; n++) {
        const a = n / 8 * Math.PI * 2, bolt = new THREE.BoxGeometry(.025, .031, .031);
        bolt.translate(side * .176, Math.cos(a) * .19, Math.sin(a) * .19); bolts.push(bolt);
      }
      spin.add(new THREE.Mesh(W.merge(bolts), M.darkMetal));
    }
    // Three tread grooves and subtle blocks give the tyres readable depth.
    const tread = [];
    for (let n = 0; n < 28; n++) {
      const a = n / 28 * Math.PI * 2;
      const g = new THREE.BoxGeometry(.24, .019, .062); g.rotateX(a);
      g.translate(0, Math.cos(a) * .515, Math.sin(a) * .515); tread.push(g);
    }
    spin.add(new THREE.Mesh(W.merge(tread), M.black));
    pivot.userData.spin = spin; return pivot;
  }
  function addAxle(group, z, dual, data, steering = false) {
    const axle = cylinder(.08, 2.36, M.darkMetal, 10); axle.rotation.z = Math.PI / 2; at(group, axle, 0, .52, z);
    data.axles.push(axle);
    for (const sign of [-1, 1]) for (const x of (dual ? [1.01, 1.32] : [1.18])) {
      const w = at(group, wheel(), sign * x, .52, z); data.wheels.push(w);
      if (steering) data.front.push(w);
    }
  }
  function decal(text, subtext) {
    return W.texture(512, 256, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.fillStyle = "#d0d8c4";
      c.textAlign = "center"; c.font = "bold 65px sans-serif"; c.fillText(text, w / 2, 102);
      c.fillStyle = "#92bb93"; c.font = "22px sans-serif"; c.fillText(subtext, w / 2, 149);
      c.fillRect(115, 175, 282, 5);
    });
  }
  function make() {
    const group = new THREE.Group(), tractor = new THREE.Group(), trailer = new THREE.Group();
    tractor.name = "Logging tractor"; trailer.name = "Articulated log semitrailer"; group.add(tractor, trailer);
    const td = tractor.userData = { wheels: [], front: [], axles: [] }, rd = trailer.userData = { wheels: [], logs: [], logX: [], axles: [], straps: [] };
    const dust = W.texture(256, 128, (c, w, h) => {
      const random = root.DeadfallRoute.random(728);
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) {
        const y = random() * h;
        c.fillStyle = `rgba(155,139,111,${.08 + y / h * .18})`;
        c.fillRect(random() * w, y, 1 + random() * 3, 1 + random() * 2);
      }
    });
    const dustMaterial = new THREE.MeshStandardMaterial({ map: dust, transparent: true, depthWrite: false, roughness: 1 });
    // Ladder chassis and visible driveline.
    for (const x of [-.71, .71]) at(tractor, box(.19, .29, 7.1, M.darkMetal), x, .92, -.05);
    for (const z of [-3.2, -.8, .65, 2.4, 3.05]) at(tractor, box(1.63, .16, .17, M.darkMetal), 0, .96, z);
    const shaft = cylinder(.10, 4.6, M.darkMetal, 10); shaft.rotation.x = Math.PI / 2; at(tractor, shaft, 0, .67, .1);
    addAxle(tractor, -3.18, false, td, true); addAxle(tractor, .88, true, td); addAxle(tractor, 2.22, true, td);
    // Sloped day-cab, shaped bonnet, separate doors and sills (not stacked cubes).
    tractor.add(profile(2.22, [[-2.46, 1.12], [-.02, 1.12], [-.02, 3.30], [-.36, 3.52], [-1.94, 3.52], [-2.38, 2.39]], M.purple));
    tractor.add(profile(1.77, [[-4.45, 1.12], [-2.41, 1.12], [-2.41, 2.32], [-3.7, 2.08], [-4.45, 1.94]], M.purple));
    for (const side of [-1, 1]) {
      at(tractor, box(.06, 1.25, 1.54, M.purple), side * 1.143, 1.94, -1.2);
      at(tractor, box(.068, .87, 1.26, M.glass), side * 1.153, 2.91, -1.16);
      at(tractor, box(.075, .05, 1.31, M.chrome), side * 1.162, 2.44, -1.16);
      at(tractor, box(.10, .07, .28, M.chrome), side * 1.2, 2.24, -.51);
      at(tractor, box(.07, .15, 2.02, M.green), side * 1.18, 1.71, -1.22);
      const doorDust = new THREE.Mesh(new THREE.PlaneGeometry(1.47, .44), dustMaterial);
      doorDust.rotation.y = side * Math.PI / 2; at(tractor, doorDust, side * 1.179, 1.45, -1.2);
      at(tractor, box(.40, .13, 1.28, M.chrome), side * 1.15, .72, -1.12);
      at(tractor, box(.25, .12, 1.24, M.darkMetal), side * 1.16, 1.03, -1.12);
      const fender = new THREE.Mesh(new THREE.TorusGeometry(.64, .10, 5, 20, Math.PI), M.purple);
      fender.rotation.y = Math.PI / 2; at(tractor, fender, side * 1.17, .55, -3.18); fender.castShadow = true;
      at(tractor, box(.52, .24, 1.72, M.purple), side * 1.12, 1.24, -3.24);
      const tank = cylinder(.34, 1.12, M.chrome, 24); tank.rotation.x = Math.PI / 2; at(tractor, tank, side * 1.02, .86, -.17);
      for (const z of [-.53, .2]) { const band = cylinder(.35, .07, M.darkMetal, 24); band.rotation.x = Math.PI / 2; at(tractor, band, side * 1.02, .86, z); }
      at(tractor, cylinder(.075, 2.42, M.chrome, 14), side * 1.02, 2.4, .28);
      at(tractor, cylinder(.12, 1.03, M.darkMetal, 14), side * 1.02, 1.88, .28);
      at(tractor, box(.22, .035, .21, M.chrome), side * 1.02, 3.63, .28);
      tractor.add(pipe([[side * 1.15, 2.53, -1.97], [side * 1.54, 2.52, -2.06], [side * 1.54, 3.02, -2.06], [side * 1.12, 3.03, -1.97]], .028, M.chrome));
      at(tractor, box(.18, .44, .25, M.black), side * 1.57, 2.79, -2.06);
      at(tractor, box(.19, .38, .015, M.glass), side * 1.57, 2.79, -1.923);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.06, .53), new THREE.MeshStandardMaterial({ map: decal("TREE", "STORM RECOVERY  ·  07"), transparent: true, depthWrite: false, roughness: .8 }));
      label.rotation.y = side * Math.PI / 2; at(tractor, label, side * 1.184, 2.07, -1.21);
      // Rear mudguards and flexible-looking rubber flaps.
      at(tractor, box(.64, .10, 2.62, M.darkMetal), side * 1.15, 1.20, 1.57);
      at(tractor, box(.66, .56, .05, M.tire), side * 1.16, .50, 2.87);
    }
    for (const x of [-.54, .54]) {
      const glass = at(tractor, box(1.01, 1.01, .035, M.glass), x, 2.92, -2.201); glass.rotation.x = .363;
      const wiper = at(tractor, box(.48, .024, .025, M.black), x, 2.61, -2.401); wiper.rotation.z = x < 0 ? -.13 : .13;
    }
    const divider = at(tractor, box(.044, 1.09, .06, M.chrome), 0, 2.92, -2.22); divider.rotation.x = .363;
    const visor = at(tractor, box(2.32, .075, .37, M.purple), 0, 3.47, -2.06); visor.rotation.x = .07;
    at(tractor, box(1.62, .92, .10, M.chrome), 0, 1.44, -4.5);
    at(tractor, box(1.43, .77, .035, M.black), 0, 1.44, -4.56);
    for (let x = -.63; x <= .64; x += .14) at(tractor, box(.025, .76, .04, M.chrome), x, 1.44, -4.59);
    for (let y = 1.11; y < 1.83; y += .14) at(tractor, box(1.40, .018, .035, M.darkMetal), 0, y, -4.60);
    at(tractor, box(2.65, .30, .23, M.chrome), 0, .75, -4.55);
    at(tractor, box(.46, .12, .245, M.black), 0, .75, -4.58);
    for (const side of [-1, 1]) {
      at(tractor, box(.42, .27, .12, M.chrome), side * 1.08, 1.18, -4.14);
      at(tractor, box(.32, .17, .025, M.headlamp), side * 1.08, 1.18, -4.21);
      at(tractor, box(.16, .08, .025, M.amber), side * 1.10, 1.39, -4.19);
    }
    for (const x of [-.83, -.43, 0, .43, .83]) at(tractor, box(.12, .075, .12, M.amber), x, 3.59, -1.72);
    const fifth = cylinder(.69, .12, M.darkMetal, 32); at(tractor, fifth, 0, 1.36, 2.25);
    at(tractor, box(.16, .016, .76, M.black), 0, 1.428, 2.56);
    // Air and electrical lines have visible depth and terminate at the coupling area.
    tractor.add(pipe([[-.42, 1.75, .09], [-.44, 2.10, .65], [-.15, 1.69, 1.44], [0, 1.50, 2.25]], .032, M.black));
    tractor.add(pipe([[.42, 1.75, .09], [.44, 1.97, .6], [.21, 1.65, 1.48], [0, 1.50, 2.25]], .025, M.green));
    // Open logging trailer with rear tandems. No stray front axle beside the cab.
    for (const x of [-.76, .76]) at(trailer, box(.18, .36, 9.7, M.darkMetal), x, 1.19, 0);
    for (const z of [-4.48, -2.8, 0, 2.8, 4.46]) at(trailer, box(2.63, .20, .21, M.chrome), 0, 1.39, z);
    at(trailer, box(1.43, .16, 1.04, M.darkMetal), 0, 1.43, -4.45);
    at(trailer, cylinder(.09, .22, M.chrome, 16), 0, 1.32, -4.85);
    addAxle(trailer, 2.25, true, rd); addAxle(trailer, 3.57, true, rd);
    for (const side of [-1, 1]) {
      at(trailer, box(.63, .10, 2.62, M.darkMetal), side * 1.16, 1.18, 2.91);
      at(trailer, box(.66, .60, .05, M.tire), side * 1.17, .47, 4.22);
      for (const z of [-3.95, -.2, 3.86]) {
        at(trailer, box(.135, 2.0, .17, M.darkMetal), side * 1.33, 2.26, z);
        at(trailer, box(.15, .07, .19, M.chrome), side * 1.33, 3.29, z);
        at(trailer, box(.035, .1, .15, M.amber), side * 1.405, 1.30, z);
      }
    }
    for (const z of [-3.95, -.2, 3.86]) at(trailer, box(2.79, .18, .34, M.darkMetal), 0, 1.47, z);
    const positions = [[-.81, 1.99], [0, 1.99], [.81, 1.99], [-.405, 2.69], [.405, 2.69]];
    positions.forEach(([x, y], i) => {
      const wood = M.bark.clone(); wood.map = M.bark.map.clone(); wood.map.offset.x = i * .19;
      wood.bumpMap = M.bark.bumpMap.clone(); wood.bumpMap.offset.x = i * .19;
      wood.color.multiplyScalar(.91 + i * .035);
      const geometry = new THREE.CylinderGeometry(.378, .402, 8.50 + (i % 3) * .13, 28, 16);
      const p = geometry.attributes.position;
      for (let n = 0; n < p.count; n++) {
        const angle = Math.atan2(p.getZ(n), p.getX(n));
        const rough = 1 + .018 * Math.sin(angle * 7 + i) + .012 * Math.sin(p.getY(n) * 2.8 + angle * 3 + i);
        p.setX(n, p.getX(n) * rough); p.setZ(n, p.getZ(n) * rough);
      }
      geometry.computeVertexNormals();
      const log = new THREE.Mesh(geometry, [wood, M.endgrain, M.endgrain]); log.castShadow = log.receiveShadow = true;
      log.rotation.x = Math.PI / 2; at(trailer, log, x, y, .08 * (i % 2)); rd.logs.push(log); rd.logX.push(x);
    });
    for (const z of [-2.75, 2.8]) {
      const strap = pipe([[-1.32, 1.51, z], [-1.27, 2.30, z], [-.55, 3.105, z], [.55, 3.105, z], [1.27, 2.30, z], [1.32, 1.51, z]], .038, M.strap);
      strap.userData.rest = strap.geometry.parameters.path.points.map(p => p.clone());
      rd.straps.push(strap); trailer.add(strap);
      at(trailer, box(.16, .22, .12, M.chrome), -1.36, 1.80, z);
    }
    at(trailer, box(2.55, .25, .18, M.darkMetal), 0, .91, 4.86);
    // Reflective tape, crossmember fasteners and leaf-spring detail.
    const whiteTape = [], redTape = [], fasteners = [];
    for (const side of [-1, 1]) {
      for (let n = 0; n < 18; n++) {
        const strip = new THREE.BoxGeometry(.018, .07, .24);
        strip.translate(side * .858, 1.24, -4.35 + n * .50); (n % 2 ? whiteTape : redTape).push(strip);
      }
      for (const z of [-3.95, -.2, 3.86]) for (const y of [1.61, 1.78]) {
        const bolt = new THREE.BoxGeometry(.025, .043, .043); bolt.translate(side * 1.408, y, z); fasteners.push(bolt);
      }
      for (const body of [tractor, trailer]) {
        const z = body === tractor ? 1.55 : 2.91;
        for (let leaf = 0; leaf < 3; leaf++) at(body, box(.12, .025, 1.32 - leaf * .18, M.black), side * .74, .72 + leaf * .028, z);
      }
    }
    for (let n = 0; n < 8; n++) {
      const strip = new THREE.BoxGeometry(.28, .07, .018); strip.translate(-1.07 + n * .305, .88, 4.96);
      (n % 2 ? whiteTape : redTape).push(strip);
    }
    trailer.add(new THREE.Mesh(W.merge(whiteTape), M.edge), new THREE.Mesh(W.merge(redTape), new THREE.MeshStandardMaterial({ color: 0xa94232, roughness: .5 })), new THREE.Mesh(W.merge(fasteners), M.chrome));
    const brakeMaterial = M.brake.clone(); td.brakeMaterial = rd.brakeMaterial = brakeMaterial;
    for (const body of [tractor, trailer]) for (const side of [-1, 1]) {
      const z = body === trailer ? 4.966 : 3.47;
      at(body, box(.34, .13, .03, brakeMaterial), side * 1.00, .96, z);
      at(body, box(.13, .10, .031, M.amber), side * 1.26, .96, z);
    }
    // Move the secured bundle together so logs cannot intersect one another.
    rd.cargoPivot = at(trailer, new THREE.Group(), 0, 2.35, 0); rd.cargoPivot.name = "Secured log bundle";
    const cargo = at(rd.cargoPivot, new THREE.Group(), 0, -2.35, 0);
    for (const log of rd.logs) cargo.add(log);
    // Physical roots and wheel steering pivots are unchanged. Sprung visual
    // frames rotate about the exact existing fifth-wheel/kingpin anchors.
    for (const body of [tractor, trailer]) {
      const data = body.userData, pinZ = body === tractor ? 2.25 : -4.85;
      const children = body.children.slice(), unsprung = new Set([...data.wheels, ...data.axles]);
      data.ridePivot = at(body, new THREE.Group(), 0, 1.42, pinZ);
      data.ridePivot.name = body === tractor ? "Tractor suspension frame" : "Trailer suspension frame";
      data.visual = at(data.ridePivot, new THREE.Group(), 0, -1.42, -pinZ);
      for (const child of children) if (!unsprung.has(child)) data.visual.add(child);
      data.shocks = [];
      for (const axle of data.axles) for (const side of [-1, 1]) {
        const shock = cylinder(.045, 1, M.chrome, 8); body.add(shock);
        shock.userData.anchor = new THREE.Vector3(side * .74, 1.04, axle.position.z);
        shock.userData.axle = axle; data.shocks.push(shock);
      }
    }
    td.exhaustPoints = [-1, 1].map(side => at(td.visual, new THREE.Object3D(), side * 1.02, 3.69, .28));
    rd.lastStrapPose = "";
    group.userData = { tractor, trailer }; return group;
  }
  function update(truck, state, input, ride) {
    const { tractor, trailer } = truck.userData;
    const motion = ride?.value || {};
    tractor.userData.front.forEach(w => w.rotation.y = -state.steer);
    for (const [name, body] of [["tractor", tractor], ["trailer", trailer]]) {
      const data = body.userData, pivot = data.ridePivot;
      pivot.rotation.set(motion[name + "Pitch"] || 0, 0, motion[name + "Roll"] || 0);
      for (const axle of data.axles) {
        const sample = motion.axles?.[name]?.find(a => a.z === axle.position.z);
        const left = sample?.left ?? .52, right = sample?.right ?? .52;
        axle.position.y = (left + right) / 2; axle.rotation.z = Math.PI / 2 + Math.atan2(right - left, 2.36);
        for (const w of data.wheels) if (w.position.z === axle.position.z) {
          w.position.y = (left + right) / 2 + w.position.x / 2.36 * (right - left);
          w.userData.spin.rotation.x = state.wheelRotation;
        }
      }
      for (const shock of data.shocks) {
        const top = shock.userData.anchor.clone().sub(pivot.position).applyQuaternion(pivot.quaternion).add(pivot.position);
        const axle = shock.userData.axle, bottom = new THREE.Vector3(shock.userData.anchor.x,
          axle.position.y + Math.tan(axle.rotation.z - Math.PI / 2) * shock.userData.anchor.x, axle.position.z);
        const direction = top.clone().sub(bottom);
        shock.position.copy(top).add(bottom).multiplyScalar(.5); shock.scale.y = Math.max(.02, direction.length());
        shock.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      }
    }
    const rd = trailer.userData, cargo = rd.cargoPivot;
    rd.logs.forEach((log, i) => { log.visible = i < state.logs; });
    cargo.position.set(motion.cargoX || 0, 2.35, motion.cargoZ || 0);
    cargo.rotation.set(motion.cargoPitch || 0, 0, motion.cargoRoll || 0); cargo.updateMatrix();
    const pose = [cargo.position.x, cargo.position.z, cargo.rotation.x, cargo.rotation.z].map(n => n.toFixed(5)).join(",");
    if (pose !== rd.lastStrapPose) {
      for (const strap of rd.straps) {
        const points = strap.geometry.parameters.path.points;
        points.forEach((p, i) => {
          p.copy(strap.userData.rest[i]);
          // End anchors stay on the frame; the middle follows the restrained load.
          if (i > 0 && i < points.length - 1) p.sub(new THREE.Vector3(0, 2.35, 0)).applyMatrix4(cargo.matrix);
        });
        reshapePipe(strap);
      }
      rd.lastStrapPose = pose;
    }
    tractor.updateMatrixWorld(true); trailer.updateMatrixWorld(true);
    tractor.userData.brakeMaterial.emissiveIntensity = input.brake ? 2.5 : .25;
  }
  root.DeadfallVehicle = { make, update };
})(typeof window !== "undefined" ? window : globalThis);
