/* Offline, procedural 3D environment. All textures are made locally at startup. */
(function (root) {
  "use strict";
  const R = root.DeadfallRoute, rand = R.random(20260922);
  function texture(w, h, draw, repeat = false) {
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    draw(canvas.getContext("2d"), w, h);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    if (repeat) map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
    return map;
  }
  function box(w, h, d, material, shadow = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.castShadow = shadow; m.receiveShadow = true; return m;
  }
  function cylinder(r, length, material, sides = 16, top = r) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(top, r, length, sides), material);
    m.castShadow = true; m.receiveShadow = true; return m;
  }
  function at(group, mesh, x, y, z) { mesh.position.set(x, y, z); group.add(mesh); return mesh; }
  function merge(parts) {
    const positions = [], normals = [], uvs = [];
    for (const part of parts) {
      const g = part.index ? part.toNonIndexed() : part;
      positions.push(...g.attributes.position.array);
      normals.push(...g.attributes.normal.array);
      if (g.attributes.uv) uvs.push(...g.attributes.uv.array);
      if (g !== part) g.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    if (uvs.length === positions.length / 3 * 2) g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    for (const part of parts) part.dispose();
    return g;
  }
  const asphalt = texture(512, 512, (c, w, h) => {
    c.fillStyle = "#777d7b"; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 37000; i++) {
      const v = 75 + Math.floor(rand() * 92); c.fillStyle = `rgba(${v},${v + 3},${v + 2},.45)`;
      c.fillRect(rand() * w, rand() * h, .5 + rand() * 2, .5 + rand() * 2);
    }
    for (let i = 0; i < 28; i++) {
      c.strokeStyle = "#333d3820"; c.lineWidth = .5; c.beginPath();
      const x = rand() * w, y = rand() * h; c.moveTo(x, y); c.lineTo(x + rand() * 30, y + rand() * 50); c.stroke();
    }
  }, true);
  const bark = texture(256, 512, (c, w, h) => {
    c.fillStyle = "#624632"; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const x = rand() * w, y = rand() * h, light = rand() > .5;
      c.strokeStyle = light ? "#aa826a66" : "#271e1977";
      c.lineWidth = .5 + rand() * 3; c.beginPath(); c.moveTo(x, y);
      c.lineTo(x + rand() * 4 - 2, y + rand() * 45 + 3); c.stroke();
    }
  }, true);
  const endgrain = texture(256, 256, (c, w, h) => {
    c.fillStyle = "#c39660"; c.fillRect(0, 0, w, h);
    for (let r = 5; r < 135; r += 3 + rand() * 5) {
      c.strokeStyle = rand() > .5 ? "#72502e88" : "#efd09b66"; c.lineWidth = 1.5;
      c.beginPath();
      for (let n = 0; n <= 80; n++) {
        const a = n / 80 * Math.PI * 2, rr = r + Math.sin(a * 4) * 1.6 + Math.cos(a * 7) * .8;
        const x = 127 + Math.cos(a) * rr, y = 132 + Math.sin(a) * rr;
        if (n) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.stroke();
    }
    c.strokeStyle = "#473323aa"; c.lineWidth = 2;
    for (let n = 0; n < 4; n++) {
      const a = rand() * Math.PI * 2; c.beginPath();
      c.moveTo(128 + Math.cos(a) * 117, 128 + Math.sin(a) * 117);
      c.lineTo(128 + Math.cos(a + .03) * 69, 128 + Math.sin(a + .03) * 69); c.stroke();
    }
  });
  const M = {
    road: new THREE.MeshStandardMaterial({ color: 0x696c6c, map: asphalt, bumpMap: asphalt, bumpScale: .035, roughness: .95 }),
    shoulder: new THREE.MeshStandardMaterial({ color: 0x8a8170, map: asphalt, roughness: 1 }),
    line: new THREE.MeshStandardMaterial({ color: 0xdfc57b, roughness: 1 }),
    edge: new THREE.MeshStandardMaterial({ color: 0xc5c5b5, roughness: 1 }),
    terrain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    purple: new THREE.MeshStandardMaterial({ color: 0x4e315e, metalness: .42, roughness: .31 }),
    green: new THREE.MeshStandardMaterial({ color: 0x4a8661, metalness: .3, roughness: .4 }),
    black: new THREE.MeshStandardMaterial({ color: 0x202725, roughness: .78 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x1c211f, roughness: .93 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xc1c9c7, metalness: .62, roughness: .32 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x4b5351, metalness: .55, roughness: .58 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x376072, metalness: .34, roughness: .16, clearcoat: 1 }),
    bark: new THREE.MeshStandardMaterial({ color: 0xbba798, map: bark, bumpMap: bark, bumpScale: .075, roughness: 1 }),
    endgrain: new THREE.MeshStandardMaterial({ map: endgrain, roughness: .97 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x777974, roughness: .95 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x455b49, roughness: 1 }),
    timber: new THREE.MeshStandardMaterial({ color: 0x655346, roughness: 1 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xffbf56, emissive: 0xff9200, emissiveIntensity: .5 }),
    headlamp: new THREE.MeshStandardMaterial({ color: 0xfff7dd, emissive: 0xffdda1, emissiveIntensity: 1 }),
    brake: new THREE.MeshStandardMaterial({ color: 0x9e2722, emissive: 0xe52212, emissiveIntensity: .25 }),
    strap: new THREE.MeshStandardMaterial({ color: 0x6f785c, roughness: .9 })
  };
  function ribbon(from, to, left, right, elevation, material, step = 2) {
    const p = [], uv = [], ix = [];
    const count = Math.ceil((to - from) / step);
    for (let i = 0; i <= count; i++) {
      const d = from + (to - from) * i / count;
      for (const side of [left, right]) {
        const v = R.frame(d, side).p;
        p.push(v.x, v.y + elevation, v.z); uv.push(side / 6, d / 8);
      }
      if (i < count) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ix); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, material); mesh.receiveShadow = true; return mesh;
  }
  function terrain() {
    const lanes = [];
    for (let x = -600; x < -40; x += 12) lanes.push(x);
    lanes.push(-40, -32, -26, -20, -16, -12, -10, -8.4, -6, -3, 0, 3, 6, 8.4, 10, 12, 16, 20, 26, 32, 40);
    for (let x = 48; x <= 600; x += 12) lanes.push(x);
    const nx = lanes.length - 1, nz = 600, p = [], colors = [], ix = [], c = new THREE.Color();
    for (let j = 0; j <= nz; j++) {
      const z = 240 - j / nz * 2400;
      for (let i = 0; i <= nx; i++) {
        const x = R.point(120 - z).x + lanes[i], y = R.terrainHeight(x, z);
        p.push(x, y, z);
        const grain = .5 + .25 * Math.sin(x * .031 + z * .047) + .25 * Math.sin(x * .089 - z * .03);
        c.setHSL(.235 + grain * .038, .16 + grain * .12, .205 + grain * .07);
        const slope = Math.abs(R.terrainHeight(x + 3, z) - y) / 3;
        if (slope > .55) c.lerp(new THREE.Color(0x797972), Math.min(.72, slope * .4));
        colors.push(c.r, c.g, c.b);
        if (j < nz && i < nx) { const a = j * (nx + 1) + i; ix.push(a, a + 1, a + nx + 1, a + 1, a + nx + 2, a + nx + 1); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); g.setIndex(ix); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, M.terrain); mesh.receiveShadow = true; mesh.name = "Continuous mountain terrain"; return mesh;
  }
  function foliageGeometry() {
    const parts = [];
    for (let tier = 0; tier < 8; tier++) {
      const y = 1.8 + tier * .68, radius = 2.0 * (1 - tier / 9.2);
      for (let b = 0; b < 5; b++) {
        const a = b / 5 * Math.PI * 2 + tier * 1.71;
        const g = new THREE.ConeGeometry(radius * .58, 1.7 - tier * .095, 7, 1);
        const vertices = g.attributes.position;
        for (let k = 0; k < vertices.count; k++) {
          vertices.setX(k, vertices.getX(k) * (.88 + rand() * .25));
          vertices.setZ(k, vertices.getZ(k) * (.88 + rand() * .25));
        }
        g.rotateZ(Math.sin(a) * .21); g.rotateX(Math.cos(a) * .21);
        g.translate(Math.cos(a) * radius * .44, y, Math.sin(a) * radius * .44);
        g.computeVertexNormals(); parts.push(g);
      }
    }
    return merge(parts);
  }
  function addForest(scene) {
    const foliage = foliageGeometry(), trunk = new THREE.CylinderGeometry(.08, .23, 5.1, 7);
    const dummy = new THREE.Object3D(), tint = new THREE.Color(), chunks = [];
    for (let start = -25; start < R.LENGTH + 90; start += 150) {
      const group = new THREE.Group(), trees = [];
      for (let d = start; d < start + 150; d += 13) for (const sign of [-1, 1]) {
        for (let row = 0; row < 4; row++) {
          const lane = sign * (12 + row * 13 + rand() * 9), f = R.frame(d + rand() * 12, lane);
          if (d > 1735 && sign === 1 && row < 2) continue;
          trees.push({ p: f.p, scale: .9 + rand() * .9 + row * .08, turn: rand() * 6.28 });
        }
      }
      const crowns = new THREE.InstancedMesh(foliage, M.foliage, trees.length);
      const trunks = new THREE.InstancedMesh(trunk, M.timber, trees.length);
      trees.forEach((tree, i) => {
        dummy.position.copy(tree.p); dummy.position.y = R.terrainHeight(tree.p.x, tree.p.z);
        dummy.rotation.set(0, tree.turn, 0); dummy.scale.setScalar(tree.scale); dummy.updateMatrix();
        crowns.setMatrixAt(i, dummy.matrix);
        tint.setHSL(.28 + rand() * .06, .15 + rand() * .14, .51 + rand() * .17); crowns.setColorAt(i, tint);
        dummy.position.y += 2.4 * tree.scale; dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
      });
      crowns.castShadow = true; crowns.receiveShadow = true; trunks.castShadow = true;
      crowns.computeBoundingSphere(); trunks.computeBoundingSphere();
      group.add(crowns, trunks); scene.add(group); chunks.push({ group, d: start + 75, crowns, trunks });
    }
    return chunks;
  }
  function addMountains(scene) {
    for (let layer = 0; layer < 3; layer++) {
      const p = [], ix = [], count = 100;
      for (let i = 0; i <= count; i++) {
        const x = -2100 + i / count * 4200;
        const peak = 180 + layer * 55 + Math.sin(i * .24 + layer * 2) * 110 + Math.sin(i * .63 + layer) * 52 + rand() * 24;
        const z = -2250 - layer * 310 + Math.sin(i * .12) * 130;
        p.push(x, -340, z, x, peak, z);
        if (i < count) { const a = i * 2; ix.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: [0x657d83, 0x799098, 0x92a5aa][layer], side: THREE.DoubleSide, fog: false }));
      scene.add(m);
    }
  }
  function sign(scene, d, lane, title, subtitle, wide = 2.5) {
    const map = texture(512, 256, (c, w, h) => {
      c.fillStyle = "#233c35"; c.fillRect(0, 0, w, h); c.strokeStyle = "#d4d7bc"; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
      c.fillStyle = "#f2efd8"; c.textAlign = "center"; c.font = "bold 36px sans-serif"; c.fillText(title, w / 2, 115);
      c.font = "22px sans-serif"; c.fillText(subtitle, w / 2, 163);
    });
    const f = R.frame(d, lane), group = new THREE.Group();
    at(group, box(.10, 3.5, .10, M.darkMetal), -.85, 1.75, 0);
    at(group, box(.10, 3.5, .10, M.darkMetal), .85, 1.75, 0);
    const board = at(group, box(wide, wide / 2, .12, M.darkMetal), 0, 3.15, 0);
    at(group, new THREE.Mesh(new THREE.PlaneGeometry(wide, wide / 2), new THREE.MeshStandardMaterial({ map, roughness: .8 })), 0, 3.15, .065);
    group.position.copy(f.p); group.position.y = R.terrainHeight(f.p.x, f.p.z); group.rotation.y = -f.yaw;
    scene.add(group); return board;
  }
  function rail(scene, from, to, lane) {
    const group = new THREE.Group(), parts = [];
    for (let d = from; d < to; d += 3) {
      const a = R.frame(d, lane).p, b = R.frame(Math.min(to, d + 3.02), lane).p;
      const segment = box(.11, .24, a.distanceTo(b), M.chrome, false);
      segment.position.copy(a).add(b).multiplyScalar(.5); segment.position.y += .85; segment.lookAt(b.clone().add(new THREE.Vector3(0, .85, 0)));
      segment.updateMatrix(); parts.push(segment.geometry.clone().applyMatrix4(segment.matrix)); segment.geometry.dispose();
      const post = new THREE.BoxGeometry(.11, .93, .13); post.translate(a.x, a.y + .47, a.z); parts.push(post);
    }
    const mesh = new THREE.Mesh(merge(parts), M.darkMetal); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); scene.add(group);
  }
  function addMill(scene) {
    const p = R.frame(1785, 25).p, group = new THREE.Group();
    at(group, box(15, 5.5, 21, new THREE.MeshStandardMaterial({ color: 0x746756, roughness: .9 })), 0, 2.75, 0);
    at(group, box(9, 4.3, .16, M.black), 0, 2.15, 10.57);
    for (const side of [-1, 1]) {
      const roof = at(group, box(8.7, .18, 23, M.darkMetal), side * 4, 6.3, 0); roof.rotation.z = -side * .2;
    }
    for (let i = 0; i < 7; i++) {
      const log = cylinder(.55, 12, [M.bark, M.endgrain, M.endgrain], 16);
      log.rotation.x = Math.PI / 2; at(group, log, -15 + (i % 4) * 1.1, .6 + Math.floor(i / 4) * .93, 0);
    }
    group.position.copy(p); group.position.y = R.terrainHeight(p.x, p.z); scene.add(group);
    sign(scene, 1745, 9.5, "RECOVERY MILL", "DELIVERY ENTRANCE  /  50 M", 3.5);
    scene.add(ribbon(1784, 1784.5, -6, 6, .07, M.edge, .5));
  }
  function create(scene) {
    scene.background = new THREE.Color(0xbbccce); scene.fog = new THREE.FogExp2(0xafc1c1, .00225);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3400, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x547c97) }, horizon: { value: new THREE.Color(0xd4d9cc) } },
      vertexShader: "varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader: "uniform vec3 top;uniform vec3 horizon;varying vec3 vP;void main(){float h=clamp(normalize(vP).y,0.0,1.0);gl_FragColor=vec4(mix(horizon,top,pow(h,.55)),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}"
    })); sky.frustumCulled = false; scene.add(sky);
    scene.add(new THREE.HemisphereLight(0xd7e6ed, 0x66664a, 2.05));
    const sun = new THREE.DirectionalLight(0xffe6be, 3.1); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 240;
    Object.assign(sun.shadow.camera, { left: -52, right: 52, top: 52, bottom: -52 });
    sun.shadow.bias = -.00025; sun.shadow.normalBias = .035; scene.add(sun, sun.target);
    scene.add(terrain()); addMountains(scene);
    const road = new THREE.Group(); road.name = "Continuous road surface";
    road.add(ribbon(-45, 1840, -8.2, 8.2, -.018, M.shoulder), ribbon(-45, 1840, -6, 6, .045, M.road));
    for (const side of [-1, 1]) road.add(ribbon(-45, 1840, side * 5.72 - .055, side * 5.72 + .055, .055, M.edge));
    const markings = [];
    for (let d = -40; d < 1840; d += 17) markings.push(ribbon(d, d + 6, -.075, .075, .059, M.line).geometry);
    road.add(new THREE.Mesh(merge(markings), M.line));
    scene.add(road);
    const forest = addForest(scene);
    for (const [from, to] of [[160, 420], [660, 880], [1080, 1360]]) rail(scene, from, to, -7.3);
    const markerParts = [], reflectorParts = [];
    for (let d = 15; d < R.LENGTH; d += 32) for (const side of [-1, 1]) {
      const f = R.frame(d, side * 6.8);
      const post = new THREE.BoxGeometry(.10, .83, .10); post.translate(f.p.x, f.p.y + .41, f.p.z); markerParts.push(post);
      const reflector = new THREE.BoxGeometry(.115, .16, .115); reflector.translate(f.p.x, f.p.y + .72, f.p.z); reflectorParts.push(reflector);
    }
    scene.add(new THREE.Mesh(merge(markerParts), M.edge), new THREE.Mesh(merge(reflectorParts), M.amber));
    sign(scene, 32, 9.8, "STORMBREAK PASS", "LOW GEAR  /  7% DESCENT");
    sign(scene, 215, 9.8, "FALLEN TIMBER", "KEEP YOUR LOAD STEADY");
    sign(scene, 845, 9.8, "LONG GRADE", "USE ENGINE BRAKE"); addMill(scene);
    const obstacles = [{ d: 280, lane: -2.8, type: "rock" }, { d: 490, lane: 2.5, type: "limb" },
      { d: 720, lane: -1.1, type: "rock" }, { d: 990, lane: 3, type: "limb" },
      { d: 1260, lane: -2.6, type: "rock" }, { d: 1510, lane: 1.4, type: "limb" }];
    for (const o of obstacles) {
      const f = R.frame(o.d, o.lane), group = new THREE.Group();
      if (o.type === "rock") {
        const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(.98, 1), M.rock);
        mesh.scale.set(1.25, .78, .9); mesh.rotation.set(.23, 1.6, .37); mesh.castShadow = true; mesh.receiveShadow = true;
        at(group, mesh, 0, .64, 0);
      } else {
        const limb = cylinder(.23, 5.5, [M.bark, M.endgrain, M.endgrain], 12); limb.rotation.z = Math.PI / 2; at(group, limb, 0, .26, 0);
        for (const x of [-1.3, .8]) { const branch = cylinder(.08, 1.5, M.bark, 8, .04); branch.rotation.z = x < 0 ? .9 : -.8; at(group, branch, x, .6, 0); }
        group.rotation.y = -f.yaw + .35;
      }
      group.position.copy(f.p); group.position.y += .07; scene.add(group); o.mesh = group;
    }
    // Rock outcrops break up the shoulder without adding hundreds of draw calls.
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 1), M.rock, 160), dummy = new THREE.Object3D();
    for (let i = 0; i < 160; i++) {
      const d = rand() * 1880 - 25, f = R.frame(d, (rand() > .45 ? 1 : -1) * (11 + rand() * 54));
      dummy.position.copy(f.p); dummy.position.y = R.terrainHeight(f.p.x, f.p.z);
      const s = .6 + rand() * 2.8; dummy.scale.set(s * 1.4, s * .66, s);
      dummy.rotation.set(rand(), rand() * 6.28, rand()); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.castShadow = true; rocks.receiveShadow = true; rocks.computeBoundingSphere(); scene.add(rocks);
    return { sun, obstacles, sky, forest, update(pos, progress) {
      sky.position.copy(pos); sun.position.copy(pos).add(new THREE.Vector3(-65, 88, -30)); sun.target.position.copy(pos);
      for (const chunk of forest) {
        chunk.group.visible = Math.abs(chunk.d - progress) < 800;
        chunk.crowns.castShadow = chunk.trunks.castShadow = Math.abs(chunk.d - progress) < 145;
      }
    } };
  }
  root.DeadfallWorld = { create, materials: M, texture, box, cylinder, at, merge, ribbon, sign, foliageGeometry };
})(typeof window !== "undefined" ? window : globalThis);
