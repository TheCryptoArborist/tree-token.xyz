(function (root) {
  "use strict";
  const R = root.DeadfallRoute, W = root.DeadfallWorld, M = W.materials;
  function create(scene) {
    const solids = [], response = W.reactions();
    scene.background = new THREE.Color(0xc7cec3);
    scene.fog = new THREE.Fog(0xc7cec3, 240, 850);
    const sky = W.atmosphere(scene);
    const sun = new THREE.DirectionalLight(0xffe7c2, 2.4);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 260 });
    sun.shadow.bias = -.0002; sun.shadow.normalBias = .022; sun.shadow.radius = 2;
    scene.add(sun, sun.target);
    const terrain = M.terrain.clone(); terrain.vertexColors = false; terrain.color.set(0x64715a);
    const ground = W.ribbon(-100, 1000, -180, 180, -.16, terrain);
    ground.name = "Handling terrain"; scene.add(ground);
    const road = new THREE.Group(); road.name = "Handling road";
    road.add(W.ribbon(-40, 960, -8, 8, .015, M.shoulder), W.ribbon(-40, 960, -7, 7, .045, M.road));
    road.add(W.ribbon(5, 200, -25, 25, .046, M.road));
    for (const side of [-1, 1]) road.add(W.ribbon(205, 940, side * 6.7 - .065, side * 6.7 + .065, .065, M.edge));
    for (let d = 210; d < 930; d += 16) road.add(W.ribbon(d, d + 5, -.06, .06, .065, M.line));
    scene.add(road);
    W.roadRepairs(scene, 205, 940, 7);
    W.sign(scene, 12, 28, "TREE PROVING GROUND", "STORM RECOVERY  /  HANDLING LAB", 6);
    W.sign(scene, 270, 9.5, "7% DESCENT", "CONTROL SPEED  /  ENGINE BRAKE", 4);
    W.sign(scene, 545, 9.5, "TRAILER TRACKING", "18 MPH MAX  /  WATCH THE INSIDE", 4);
    const shed = new THREE.Group();
    W.at(shed, W.box(12, 4, 19, M.darkMetal), 0, 2, 0);
    W.at(shed, W.box(12.8, .2, 20, M.chrome), 0, 4.1, 0);
    W.at(shed, W.box(.1, 3.2, 7, M.black), -6.05, 1.6, 0);
    shed.position.copy(R.frame(72, 39).p); scene.add(shed);
    // Instanced original trees keep the test yard readable without a large download.
    const random = R.random(518), dummy = new THREE.Object3D(), count = 160;
    const crowns = new THREE.InstancedMesh(W.foliageGeometry(), M.foliage, count);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.10, .24, 5, 7), M.timber, count);
    for (let i = 0; i < count; i++) {
      const d = -35 + random() * 1000, lane = (i % 2 ? 1 : -1) * (48 + random() * 65);
      dummy.position.copy(R.frame(d, lane).p); dummy.position.y = R.terrainHeight(dummy.position.x, dummy.position.z);
      dummy.scale.setScalar(1 + random()); dummy.rotation.y = random() * 6.28; dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
      const base = dummy.position.clone(), scale = dummy.scale.y, turn = dummy.rotation.y;
      dummy.position.y += 2.4 * dummy.scale.y; dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
      const solid = { id: `lab-tree-${i}`, kind: "tree", a: base, radius: .23 * scale, minY: base.y, maxY: base.y + 6.7 * scale };
      solids.push(solid); response.tree(crowns, trunks, i, base, scale, turn, solid);
    }
    crowns.castShadow = true; trunks.castShadow = true; scene.add(crowns, trunks);
    const groups = {}, cones = {};
    const orange = new THREE.MeshStandardMaterial({ color: 0xe39a45, roughness: .7 });
    const green = new THREE.MeshStandardMaterial({ color: 0xb4dba3, roughness: 1 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe3bb6d, roughness: 1 });
    const coneGeometry = new THREE.ConeGeometry(.24, .72, 12);
    for (const id of ["braking", "grade", "turns", "reverse"]) { groups[id] = new THREE.Group(); cones[id] = []; scene.add(groups[id]); }
    function cone(id, d, lane) {
      const mesh = new THREE.Group();
      W.at(mesh, W.box(.55, .06, .55, M.black), 0, .03, 0);
      W.at(mesh, new THREE.Mesh(coneGeometry, orange), 0, .42, 0);
      W.at(mesh, W.cylinder(.14, .10, M.edge, 12, .10), 0, .46, 0);
      mesh.position.copy(R.frame(d, lane).p); mesh.position.y += .06;
      groups[id].add(mesh); cones[id].push({ id: `${id}-${d}-${lane}`, d, mesh });
    }
    groups.braking.add(W.ribbon(90, 90.45, -4.5, 4.5, .07, M.edge), W.ribbon(124.6, 125, -4.5, 4.5, .07, green));
    for (const side of [-1, 1]) {
      groups.braking.add(W.ribbon(90, 125, side * 4.5 - .04, side * 4.5 + .04, .07, green));
      for (const d of [90, 100, 110, 120, 125]) cone("braking", d, side * 4.8);
    }
    W.sign(groups.braking, 84, 8.5, "20 MPH", "BRAKE AT THE WHITE LINE", 4);
    W.sign(groups.braking, 125, 8.5, "STOP LIMIT", "35 M FROM WHITE LINE", 4);
    for (const d of [590, 650, 710]) for (const side of [-1, 1]) {
      cone("turns", d - 1.5, side * 4.8); cone("turns", d + 1.5, side * 4.8);
    }
    groups.turns.add(W.ribbon(775, 775.4, -6, 6, .07, green));
    for (const side of [-1, 1]) {
      groups.reverse.add(W.ribbon(118.5, 131.5, side * 2.3 - .06, side * 2.3 + .06, .07, gold));
      for (const d of [118, 125, 132]) cone("reverse", d, side * 2.65);
    }
    groups.reverse.add(W.ribbon(118.5, 118.7, -2.3, 2.3, .07, gold));
    groups.reverse.add(W.ribbon(124.8, 125.2, -.4, .4, .07, gold));
    W.sign(groups.reverse, 111, 7.5, "REVERSE BAY", "TRAILER CENTER  /  HOLD BRAKE", 4);
    groups.grade.add(W.ribbon(475, 475.4, -6, 6, .07, green));
    let selected = "braking";
    return { sun, obstacles: [], solids, impact: response.impact, reset: response.reset, get cones() { return cones[selected]; }, selectTest(id) {
      selected = id; for (const key of Object.keys(groups)) groups[key].visible = key === id;
    }, update(pos, progress, dt = 0) {
      response.update(dt);
      sky.position.copy(pos);
      sun.position.copy(pos).add(new THREE.Vector3(-55, 95, 35)); sun.target.position.copy(pos);
    } };
  }
  root.DeadfallHandlingWorld = { create };
})(typeof window !== "undefined" ? window : globalThis);
