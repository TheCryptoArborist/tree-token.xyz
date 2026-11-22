/* Bounded world-space exhaust, dust, sparks and wood/leaf particles. */
(function (root) {
  "use strict";
  function create(scene) {
    const capacity = 240, position = new Float32Array(capacity * 3), color = new Float32Array(capacity * 3);
    const size = new Float32Array(capacity), alpha = new Float32Array(capacity), particles = [];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { viewport: { value: 900 } }]),
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
uniform float viewport; varying float vAlpha; varying vec3 vColor;
#include <fog_pars_vertex>
void main(){ vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
gl_Position=projectionMatrix*mvPosition;
gl_PointSize=clamp(aSize*viewport*projectionMatrix[1][1]*.5/max(.1,-mvPosition.z),0.0,110.0);
vAlpha=aAlpha;vColor=aColor;
#include <fog_vertex>
}`,
      fragmentShader: `varying float vAlpha; varying vec3 vColor;
#include <fog_pars_fragment>
void main(){float radius=length(gl_PointCoord-vec2(.5))*2.0;
float opacity=(1.0-smoothstep(.15,1.0,radius))*vAlpha;
if(opacity<.003)discard;gl_FragColor=vec4(vColor,opacity);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}` });
    const cloud = new THREE.Points(geometry, material); cloud.name = "Exhaust and impact particles"; cloud.frustumCulled = false; scene.add(cloud);
    const random = root.DeadfallRoute.random(541), tint = new THREE.Color();
    let cursor = 0, smokeTime = 0, dustTime = 0;
    function emit(point, velocity, life, scale, opacity, hex, gravity = 0) {
      tint.setHex(hex); particles[cursor] = { position: point.clone(), velocity, age: 0, life, scale, opacity,
        color: [tint.r, tint.g, tint.b], gravity };
      cursor = (cursor + 1) % capacity;
    }
    function impact(event) {
      const steel = event.object.kind === "barrier", tree = event.object.kind === "tree" || event.object.kind === "limb";
      const count = Math.min(30, 8 + Math.floor(event.speed * 1.5));
      for (let i = 0; i < count; i++) {
        const velocity = event.normal.clone().multiplyScalar(1 + random() * 3);
        velocity.x += random() * 2 - 1; velocity.z += random() * 2 - 1; velocity.y = 1 + random() * 3;
        emit(event.point, velocity, .4 + random() * .8, steel ? .065 : .1 + random() * .1, .9,
          steel ? 0xe7be7c : tree ? (i % 2 ? 0x71804a : 0x9d7549) : 0xaba18b, 7);
      }
    }
    function update(dt, state, tractor, running, viewport = 900) {
      dt = Math.max(0, Math.min(.1, dt)); material.uniforms.viewport.value = Math.max(1, viewport);
      if (!running) dt = 0;
      if (running && !state.disabled) {
        const load = Math.max(0, Math.min(1, state.throttle || 0));
        smokeTime += dt * (3 + load * 13);
        while (smokeTime >= 1) {
          smokeTime--;
          for (const [index, side] of [[0, -1], [1, 1]]) {
            const emitter = tractor.userData.exhaustPoints?.[index];
            const point = emitter ? emitter.getWorldPosition(new THREE.Vector3()) : tractor.localToWorld(new THREE.Vector3(side * 1.02, 3.69, .28));
            emit(point, new THREE.Vector3(.35 + random() * .18, .8 + load * .6, .12 + random() * .2),
              1.1 + random() * .8, .18 + load * .09, .10 + load * .17, load > .65 ? 0x77786f : 0xb9bdb5);
          }
        }
        if (state.offroad && Math.abs(state.speed) > 1) {
          dustTime += dt * Math.min(18, Math.abs(state.speed) * 1.4);
          while (dustTime >= 1) { dustTime--; const side = random() > .5 ? 1 : -1;
            const point = tractor.localToWorld(new THREE.Vector3(side * 1.2, .15, 2.3));
            emit(point, new THREE.Vector3(random() - .5, .5, random() - .5), .9, .35, .18, 0xa49b80); }
        } else dustTime = 0;
      }
      for (let i = 0; i < capacity; i++) {
        const p = particles[i]; alpha[i] = 0; size[i] = 0;
        if (!p) continue;
        p.age += dt;
        if (p.age >= p.life) { particles[i] = null; continue; }
        p.velocity.y -= p.gravity * dt; p.position.addScaledVector(p.velocity, dt);
        const age = p.age / p.life;
        position.set(p.position.toArray(), i * 3); color.set(p.color, i * 3);
        size[i] = p.scale * (1 + age * (p.gravity ? .1 : 3.5));
        alpha[i] = p.opacity * Math.min(1, age * 12 + .1) * (1 - age);
      }
      for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
    }
    return { cloud, impact, update, reset() { particles.length = 0; alpha.fill(0); size.fill(0); smokeTime = dustTime = 0;
      geometry.attributes.aAlpha.needsUpdate = geometry.attributes.aSize.needsUpdate = true; } };
  }
  root.DeadfallEffects = { create };
})(typeof window !== "undefined" ? window : globalThis);
