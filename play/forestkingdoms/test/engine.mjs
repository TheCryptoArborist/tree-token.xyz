/** Original, local-only Forest Kingdoms prologue rules. No network or payment code. */
export const SAVE_KEY = 'tree-arcade:forest-kingdoms:prologue:v1';
export const WORLD = Object.freeze({
  width: 1600, height: 1000,
  river: Object.freeze({ x: 744, w: 132 }),
  bridge: Object.freeze({ x: 718, y: 470, w: 184, h: 94 }),
  camp: Object.freeze({ x: 1240, y: 420 }),
  grove: Object.freeze({ x: 1130, y: 700 }),
  workshop: Object.freeze({ x: 1320, y: 330 }),
  cache: Object.freeze({ x: 1090, y: 430 })
});

const STAGES = ['meet', 'defend', 'repair', 'cross', 'plant', 'restore', 'complete'];
const finite = (v, fallback, min = 0, max = 1e6) => Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const point = (v, fallback) => ({ x: finite(v?.x, fallback.x, 60, 1540), y: finite(v?.y, fallback.y, 60, 940) });

function fresh() {
  return {
    version: 1, status: 'playing', stage: 'meet', time: 0,
    hero: { x: 270, y: 650, hp: 100, maxHp: 100, dirX: 1, dirY: 0, attack: 0, snare: 0, hit: 0, snareCooldown: 0, attackCooldown: 0 },
    engineer: { x: 430, y: 570, freed: false, route: 0 },
    villagers: [
      { x: 365, y: 610, kind: 'fox', safe: false, route: 0 },
      { x: 335, y: 665, kind: 'rabbit', safe: false, route: 0 },
      { x: 385, y: 700, kind: 'rabbit', safe: false, route: 0 }
    ],
    enemies: [], resources: { food: 6, materials: 12, seeds: 2 },
    world: { bridge: false, grove: false, workshop: false, cache: false, bonus: false, recruit: false },
    metrics: { defeated: 0, rescued: 0 },
    combat: { wave: 0, waveDelay: 0 }, bonusDiscount: 0
  };
}

/** Whitelist persistent data; reject incompatible saves and normalize invariants. */
function restore(saved) {
  let raw = saved;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return fresh(); } }
  if (!raw || raw.version !== 1 || !STAGES.includes(raw.stage)) return fresh();
  const s = fresh();
  const index = STAGES.indexOf(raw.stage);
  s.stage = raw.stage;
  s.time = finite(raw.time, 0, 0, 1e9);
  s.hero = { ...s.hero, ...point(raw.hero, s.hero), hp: finite(raw.hero?.hp, 100, 0, 100),
    dirX: finite(raw.hero?.dirX, 1, -1, 1), dirY: finite(raw.hero?.dirY, 0, -1, 1),
    snareCooldown: finite(raw.hero?.snareCooldown, 0, 0, 6), attackCooldown: finite(raw.hero?.attackCooldown, 0, 0, 0.38) };
  s.status = index === 6 ? 'complete' : s.hero.hp <= 0 ? 'down' : 'playing';
  if (s.status === 'complete') s.hero.hp = Math.max(1, s.hero.hp);
  s.engineer = { ...point(raw.engineer, s.engineer), freed: index >= 2,
    route: Math.floor(finite(raw.engineer?.route, index === 6 ? 4 : raw.engineer?.x > 900 ? 2 : 0, 0, 4)) };
  s.world = { bridge: index >= 3, grove: index >= 5, workshop: index === 6,
    cache: index >= 4 && raw.world?.cache === true, bonus: index === 6, recruit: index === 6 && raw.world?.recruit === true };
  for (const resource of ['food', 'materials', 'seeds']) s.resources[resource] = Math.floor(finite(raw.resources?.[resource], s.resources[resource], 0, 9999));
  s.metrics = { defeated: index >= 2 ? 5 : Math.floor(finite(raw.metrics?.defeated, 0, 0, 5)), rescued: index >= 4 ? 3 : 0 };
  s.bonusDiscount = s.world.bonus ? 0.2 : 0;
  s.villagers = s.villagers.map((v, i) => {
    const position = point(raw.villagers?.[i], v);
    let route = Math.floor(finite(raw.villagers?.[i]?.route, 0, 0, 3));
    // Preserve older saves that awarded rescue too early, but place those rescued families safely east.
    if (index >= 4 && position.x < 904) { position.x = 910 + i * 14; position.y = 515; route = 2; }
    return { ...position, kind: v.kind, safe: index >= 3 && position.x >= 904, route };
  });
  s.metrics.rescued = s.villagers.filter(v => v.safe).length;
  if (index === 1) {
    s.combat.wave = raw.combat?.wave === 2 ? 2 : 1;
    s.combat.waveDelay = finite(raw.combat?.waveDelay, 0, 0, 1.4);
    const ids = new Set();
    s.enemies = (Array.isArray(raw.enemies) ? raw.enemies : []).slice(0, 5).flatMap((e, i) => {
      if (!e || typeof e.id !== 'string' || ids.has(e.id)) return [];
      ids.add(e.id);
      const kind = e.kind === 'heavy' ? 'heavy' : 'raider';
      const maxHp = kind === 'heavy' ? 84 : 54;
      return [{ id: e.id.slice(0, 50), kind, ...point(e, { x: 550, y: 350 + i * 80 }), maxHp,
        hp: finite(e.hp, maxHp, 0, maxHp), rooted: finite(e.rooted, 0, 0, 3),
        attackCooldown: finite(e.attackCooldown, 0.6, 0, 1.2), hit: 0, spawning: finite(e.spawning, 0, 0, 1.4) }];
    });
  }
  // Never reload inside an impassable river.
  if (s.hero.x > 726 && s.hero.x < 894 && !(s.world.bridge && s.hero.y >= 486 && s.hero.y <= 548)) {
    s.hero.x = s.hero.x < 810 ? 726 : 894;
  }
  return s;
}

export class Game {
  constructor(saved = null) { this.state = restore(saved); this.events = []; }
  _event(type, text, extra = {}) { this.events.push({ type, ...(text ? { text } : {}), ...extra }); }
  _save() { this._event('save'); }
  _stage(stage) { this.state.stage = stage; this._event('stage', this.getObjective().title); this._save(); }
  drainEvents() { const pending = this.events; this.events = []; return pending; }
  serialize() { return restore(this.state); }

  _spawn(wave) {
    this.state.combat.wave = wave;
    this.state.combat.waveDelay = 0;
    const places = wave === 1
      ? [{ x: 520, y: 270 }, { x: 635, y: 475 }, { x: 500, y: 830 }]
      : [{ x: 590, y: 300 }, { x: 620, y: 800 }];
    this.state.enemies = places.map((p, i) => {
      if (distance(p, this.state.hero) < 180) p.y = p.y < 500 ? 820 : 220;
      const kind = wave === 2 && i === 1 ? 'heavy' : 'raider';
      const maxHp = kind === 'heavy' ? 84 : 54;
      return { id: `wave-${wave}-${i}`, kind, ...p, hp: maxHp, maxHp, rooted: 0,
        attackCooldown: 0.6 + i * 0.15, hit: 0, spawning: 1.4 };
    });
    this._event('message', wave === 1 ? 'Raiders approaching! Red markers show where they enter.' : 'Two more raiders! Watch the red entry markers.');
  }

  _move(body, dx, dy) {
    const nx = finite(body.x + dx, body.x, 60, 1540);
    let ny = finite(body.y + dy, body.y, 60, 940);
    const left = 726, right = 894;
    if (body.x > left && body.x < right && this.state.world.bridge) ny = Math.max(486, Math.min(548, ny));
    const inBridgeLane = this.state.world.bridge && ny >= 486 && ny <= 548;
    let x = nx;
    if (!inBridgeLane && nx > left && nx < right) x = body.x <= 810 ? left : right;
    body.x = x; body.y = ny;
  }

  update(dt, input = {}) {
    const s = this.state;
    if (s.status === 'down') return;
    const elapsed = finite(dt, 0, 0, 0.05);
    if (!elapsed) return;
    s.time += elapsed;
    const h = s.hero;
    for (const key of ['attack', 'snare', 'hit', 'snareCooldown', 'attackCooldown']) h[key] = Math.max(0, h[key] - elapsed);
    let dx = finite(input.x ?? input.dx ?? input.moveX, 0, -1, 1);
    let dy = finite(input.y ?? input.dy ?? input.moveY, 0, -1, 1);
    const length = Math.hypot(dx, dy);
    if (length) {
      dx /= Math.max(1, length); dy /= Math.max(1, length);
      h.dirX = dx / Math.hypot(dx, dy); h.dirY = dy / Math.hypot(dx, dy);
      this._move(h, dx * 200 * elapsed, dy * 200 * elapsed);
    }
    if (input.attack) this.attack();
    if (input.snare) this.snare();
    if (input.interact) this.interact();
    if (s.stage === 'defend') {
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        e.hit = Math.max(0, e.hit - elapsed);
        if (e.spawning > 0) { e.spawning = Math.max(0, e.spawning - elapsed); continue; }
        e.attackCooldown = Math.max(0, e.attackCooldown - elapsed);
        if (e.rooted > 0) { e.rooted = Math.max(0, e.rooted - elapsed); continue; }
        const d = distance(e, h);
        if (d > 37) {
          const speed = e.kind === 'heavy' ? 52 : 76;
          this._move(e, (h.x - e.x) / d * speed * elapsed, (h.y - e.y) / d * speed * elapsed);
        } else if (e.attackCooldown <= 0) {
          h.hp = Math.max(0, h.hp - 8); h.hit = 0.3; e.attackCooldown = 1.2;
          this._event('hit', undefined, { x: h.x, y: h.y, amount: 8 });
          if (h.hp === 0) { s.status = 'down'; this._event('message', 'The caravan needs you. Return to the checkpoint and try again.'); this._save(); break; }
        }
      }
      if (s.status !== 'down' && s.enemies.every(e => e.hp <= 0)) {
        if (s.combat.wave < 2) {
          s.combat.waveDelay += elapsed;
          if (s.combat.waveDelay >= 0.8) this._spawn(2);
        } else {
          s.engineer.freed = true; h.hp = Math.min(100, h.hp + 24);
          this._stage('repair');
          this._event('story', 'You held them off! Give me eight materials at the crossing and I can get these families home.', { speaker: 'Bram · Beaver engineer' });
        }
      }
    }
    if (s.world.bridge) this._moveCaravan(elapsed);
    if (s.stage === 'cross' && h.x > 900 && s.villagers.every(v => v.safe)) {
      this._stage('plant');
      this._event('story', 'All three families are safe. Plant the first grove to feed this outpost. There are building supplies in the abandoned cache.', { speaker: 'Bram' });
    }
  }

  _moveCaravan(dt) {
    const s = this.state;
    const engineerRoute = [{ x: 704, y: 515 }, { x: 910, y: 515 }, { x: 1220, y: 430 }];
    if (s.world.workshop) engineerRoute.push({ x: 1285, y: 370 });
    const engineerTarget = engineerRoute[s.engineer.route];
    if (engineerTarget) {
      const d = distance(s.engineer, engineerTarget);
      if (d < 7) { s.engineer.x = engineerTarget.x; s.engineer.y = engineerTarget.y; s.engineer.route++; }
      else this._move(s.engineer, (engineerTarget.x - s.engineer.x) / d * Math.min(d, 115 * dt), (engineerTarget.y - s.engineer.y) / d * Math.min(d, 115 * dt));
    }
    s.villagers.forEach((v, i) => {
      const route = [{ x: 704, y: 515 }, { x: 910, y: 515 }, { x: 1205 + i * 30, y: 470 + (i % 2) * 32 }];
      const target = route[v.route];
      if (!target) return;
      const d = distance(v, target);
      if (d < 7) { v.x = target.x; v.y = target.y; v.route++; }
      else this._move(v, (target.x - v.x) / d * Math.min(d, 115 * dt), (target.y - v.y) / d * Math.min(d, 115 * dt));
    });
    s.villagers.forEach(v => { if (v.x >= 904) v.safe = true; });
    s.metrics.rescued = s.villagers.filter(v => v.safe).length;
  }

  attack() {
    const s = this.state, h = s.hero;
    if (s.status !== 'playing' || h.attackCooldown > 0) return false;
    const targets = s.enemies.filter(e => e.hp > 0 && e.spawning <= 0 && distance(h, e) <= 100);
    const nearest = targets.reduce((best, e) => !best || distance(h, e) < distance(h, best) ? e : best, null);
    if (nearest) {
      const d = distance(h, nearest);
      if (d > 0.001) { h.dirX = (nearest.x - h.x) / d; h.dirY = (nearest.y - h.y) / d; }
    }
    h.attackCooldown = 0.38; h.attack = 0.22;
    this._event('attack', undefined, { x: h.x, y: h.y });
    for (const e of targets) {
      e.hp = Math.max(0, e.hp - 30); e.hit = 0.22;
      if (e.hp === 0) { s.metrics.defeated++; this._event('message', e.kind === 'heavy' ? 'Heavy raider defeated.' : 'Raider defeated.'); }
    }
    return true;
  }

  snare() {
    const s = this.state, h = s.hero;
    if (s.status !== 'playing' || h.snareCooldown > 0) return false;
    h.snareCooldown = 6; h.snare = 0.55;
    for (const e of s.enemies) if (e.hp > 0 && e.spawning <= 0 && distance(h, e) <= 180) e.rooted = 3;
    this._event('snare', undefined, { x: h.x, y: h.y, radius: 180 });
    return true;
  }

  _interactions() {
    const s = this.state, actions = [];
    const add = (id, label, location, enabled = true, reason) => actions.push({ id, label, ...location, enabled, ...(!enabled && reason ? { reason } : {}) });
    if (s.stage === 'meet') add('talk', 'Talk to Bram', s.engineer);
    if (s.stage === 'repair') add('bridge', 'Repair crossing · 8 materials', { x: 704, y: 517 }, s.resources.materials >= 8, 'You need 8 materials.');
    if (['plant', 'restore'].includes(s.stage) && !s.world.cache) add('cache', 'Collect supply cache · +14 materials', WORLD.cache);
    if (s.stage === 'plant') add('grove', 'Plant grove · 1 seed', WORLD.grove, s.resources.seeds >= 1, 'You need one seed.');
    if (s.stage === 'restore') add('workshop', 'Restore ancestral workshop · 10 materials', WORLD.workshop, s.resources.materials >= 10, 'Collect the supply cache to the southwest: +14 materials.');
    if (s.stage === 'complete' && !s.world.recruit) add('recruit', 'Recruit beaver guard · 8 materials + 4 food', WORLD.workshop, s.resources.materials >= 8 && s.resources.food >= 4, 'A guard costs 8 materials and 4 food with your 20% discount.');
    return actions;
  }

  getInteraction() {
    if (this.state.status === 'down') return null;
    return this._interactions().filter(a => distance(a, this.state.hero) <= 112).sort((a, b) => distance(a, this.state.hero) - distance(b, this.state.hero))[0] ?? null;
  }

  interact() {
    const action = this.getInteraction(), s = this.state;
    if (!action) return false;
    if (!action.enabled) { this._event('message', action.reason); return false; }
    if (action.id === 'talk') {
      this._stage('defend'); this._spawn(1);
      this._event('story', 'Raiders cut us off from our ancestral dam. Protect the families! Your root snare can hold the raiders still.', { speaker: 'Bram · Beaver engineer' });
    } else if (action.id === 'bridge') {
      s.resources.materials -= 8; s.world.bridge = true;
      s.engineer.x = 704; s.engineer.y = 545; s.engineer.route = 0;
      this._stage('cross'); this._event('story', 'The crossing is ready. Lead the caravan over the bridge, then wait on the eastern bank until all three families are across.', { speaker: 'Bram' });
    } else if (action.id === 'cache') {
      s.world.cache = true; s.resources.materials += 14;
      this._event('message', 'Supply cache recovered: +14 materials.'); this._save();
    } else if (action.id === 'grove') {
      s.resources.seeds--; s.resources.food += 6; s.world.grove = true;
      this._stage('restore'); this._event('story', 'The grove is growing! Its first harvest gives us six food. Restore our ancestral workshop to welcome the beaver guard.', { speaker: 'Bram' });
    } else if (action.id === 'workshop') {
      s.resources.materials -= 10; s.world.workshop = true; s.world.bonus = true; s.bonusDiscount = 0.2;
      s.status = 'complete';
      this._stage('complete');
      this._event('story', 'Our ancestral home is ours again. Beaver recruits now cost 20% fewer materials. But the river was diverted on purpose… something is moving upstream.', { speaker: 'Bram' });
      this._event('complete', 'The Broken Crossing · Prologue complete');
    } else if (action.id === 'recruit') return this.recruit();
    return true;
  }

  recruit() {
    const s = this.state;
    if (s.stage !== 'complete' || !s.world.bonus || s.world.recruit) return false;
    const materials = Math.round(10 * (1 - s.bonusDiscount));
    if (s.resources.materials < materials || s.resources.food < 4) { this._event('message', 'You need 8 materials and 4 food to recruit the guard.'); return false; }
    s.resources.materials -= materials; s.resources.food -= 4; s.world.recruit = true;
    this._event('message', 'Beaver guard recruited! You spent 8 materials instead of 10, plus 4 food.'); this._save();
    return true;
  }

  restartCheckpoint() {
    const s = this.state;
    if (s.status !== 'down') return false;
    s.status = 'playing'; s.hero = { ...fresh().hero, x: 350, y: 620 };
    if (s.stage === 'defend') { s.metrics.defeated = 0; this._spawn(1); }
    this._event('message', 'Checkpoint restored. Use your root snare when raiders gather.'); this._save();
    return true;
  }

  getObjective() {
    const s = this.state;
    const objectives = {
      meet: ['Find Bram the engineer', 'Approach the beaver beside the caravan and press E or Interact.', 1],
      defend: ['Protect the caravan', 'Space: attack nearby raiders. Q: root snare. Keep moving while your snare recharges.', 2],
      repair: ['Restore the river crossing', 'Meet Bram at the western bridge approach. Repair costs 8 materials.', 3],
      cross: ['Lead the caravan to safety', s.hero.x > 900
        ? `Wait on the eastern bank for the families. ${s.metrics.rescued} of 3 safely across.`
        : `Lead the families across the repaired bridge, then wait for everyone. ${s.metrics.rescued} of 3 safely across.`, 4],
      plant: ['Plant the first grove', 'Plant a seed in the southern grove. The abandoned cache holds +14 materials.', 5],
      restore: ['Reclaim the ancestral workshop', s.resources.materials < 10 ? 'Collect the abandoned supply cache southwest of the workshop, then restore the workshop.' : 'Restore the workshop in the northeast for 10 materials to unlock the beaver discount.', 6],
      complete: ['The crossing lives again', s.world.recruit ? 'Your beaver guard is ready. The next chapter follows the mystery upstream.' : 'Optional: recruit a beaver guard at the workshop and try your 20% materials discount.', 6]
    };
    const [title, hint, step] = objectives[s.stage];
    return { title, hint, step, total: 6 };
  }
}
