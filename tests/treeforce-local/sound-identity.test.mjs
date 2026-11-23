import test from "node:test";
import assert from "node:assert/strict";
import {
  scoreStep,
  encounterMood,
  CanopyScore,
  IdentityMixer,
} from "../../treeforce89/frontend/game/sound-identity.mjs";
import { CUES } from "../../treeforce89/frontend/game/audio-cues.mjs";
test("three distinct eight-bar phrases with rests and bounded music density", () => {
  const signatures = [];
  for (const mood of ["normal", "bonus", "boss"]) {
    const phrase = Array.from({ length: 128 }, (_, i) => scoreStep(mood, i));
    assert.equal(
      new Set(
        Array.from({ length: 8 }, (_, i) =>
          JSON.stringify(phrase.slice(i * 16, i * 16 + 16)),
        ),
      ).size,
      8,
    );
    assert.ok(phrase.some((notes) => notes.length === 0));
    assert.ok(
      phrase.every(
        (notes) =>
          notes.length <= 3 &&
          notes.every(
            (n) =>
              n.volume > 0 &&
              n.volume <= 0.055 &&
              n.frequency > 0 &&
              n.duration <= 0.24,
          ),
      ),
    );
    assert.deepEqual(scoreStep(mood, 128), scoreStep(mood, 0));
    signatures.push(JSON.stringify(phrase));
  }
  assert.equal(new Set(signatures).size, 3);
});
test("actual scene flags choose bonus before boss and normal after clear", () => {
  const s = { sys: { isActive: () => true }, run: { wave: 0 } },
    game = { scene: { getScene: () => s } };
  assert.equal(encounterMood(game), "normal");
  s.run.wave = 9;
  assert.equal(encounterMood(game), "boss");
  s.challenge = {};
  assert.equal(encounterMood(game), "bonus");
  s.challenge = null;
  s.windfall = {};
  assert.equal(encounterMood(game), "bonus");
  s.windfall = null;
  s.waveClearing = true;
  assert.equal(encounterMood(game), "normal");
});
test("encounter transitions reset phrase once; pause preserves cursor; reset clears it", () => {
  const score = new CanopyScore(),
    scene = { sys: { isActive: () => true }, run: { wave: 0 } },
    calls = [];
  const life = {
    owner: { scene: { getScene: () => scene } },
    tone: (...args) => calls.push(args),
  };
  const mixer = { musicVolume: 0.55, duckUntil: 0 },
    context = { currentTime: 1 };
  score.tick(life, context, mixer);
  score.tick(life, context, mixer);
  assert.equal(score.step, 2);
  scene.run.wave = 9;
  score.tick(life, context, mixer);
  assert.equal(score.mood, "boss");
  assert.equal(score.step, 1);
  score.tick(life, context, mixer);
  assert.equal(score.step, 2);
  score.reset();
  assert.equal(score.step, 0);
  assert.equal(score.mood, null);
});
test("reward ducking affects every music layer", () => {
  const score = new CanopyScore(),
    calls = [],
    context = { currentTime: 1 };
  score.tick({ owner: null, tone: (...args) => calls.push(args) }, context, {
    musicVolume: 1,
    duckUntil: 2,
  });
  assert.deepEqual(
    calls.map((args) => args.at(-1)),
    scoreStep("normal", 0).map((n) => n.volume * 0.35),
  );
});
test("combat identities retain two voices and named motifs", () => {
  const m = new IdentityMixer(),
    profiles = ["fire", "enemyFire", "hit", "kill"].map((c) =>
      m.combatTone(c, 230, 0.06, 0.04, 4),
    );
  assert.equal(
    new Set(profiles.map((p) => JSON.stringify([p.notes, p.type]))).size,
    4,
  );
  assert.ok(
    profiles.every(
      (p) =>
        p.notes.length === 2 &&
        p.step === 0.03 &&
        p.volume === 0.04 &&
        p.priority === 4,
    ),
  );
  assert.equal(Object.keys(CUES).length, 24);
});
