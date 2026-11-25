import test from "node:test";
import assert from "node:assert/strict";
import { enemyImpact } from "../../treeforce89/frontend/game/impact-effects.mjs";
function fixture() {
  const objects = [],
    tweens = [];
  const create =
    (type) =>
    (...args) => {
      const p = {
        type,
        args,
        once(_, fn) {
          this.end = fn;
          return this;
        },
        setDepth(v) {
          this.depth = v;
          return this;
        },
        setAngle() {
          return this;
        },
        setPosition(x, y) {
          this.x = x;
          this.y = y;
          return this;
        },
        setAlpha(a) {
          this.alpha = a;
          return this;
        },
        setScale() {
          return this;
        },
        destroy() {
          if (!this.dead) {
            this.dead = true;
            this.end();
          }
        },
      };
      objects.push(p);
      return p;
    };
  return {
    objects,
    tweens,
    scene: {
      add: {
        circle: create("dust"),
        rectangle: create("bark"),
        triangle: create("shatter"),
      },
      tweens: { add: (t) => tweens.push(t) },
    },
  };
}
test("each family keeps original draw counts/ranges and distinct shapes", () => {
  for (const [kind, count, shape] of [
    ["bat", 9, "shatter"],
    ["spore", 9, "dust"],
    ["borer", 16, "bark"],
  ]) {
    const f = fixture(),
      draws = [];
    enemyImpact(f.scene, 100, 100, kind, (a, b) => {
      draws.push([a, b]);
      return a;
    });
    assert.equal(f.objects.length, count);
    assert.equal(draws.length, count * 3);
    for (let i = 0; i < count; i++)
      assert.deepEqual(draws.slice(i * 3, i * 3 + 3), [
        [-65, 65],
        [-70, 55],
        [280, 620],
      ]);
    assert.ok(f.objects.every((p) => p.type === shape && p.depth === 4));
  }
});
test("busy scenes cap particles while retaining random consumption, then recover after destruction", () => {
  const f = fixture();
  let calls = 0;
  const sample = (a, b) => {
    calls++;
    return a;
  };
  for (let i = 0; i < 8; i++)
    assert.equal(enemyImpact(f.scene, 0, 0, "bat", sample), true);
  assert.equal(enemyImpact(f.scene, 0, 0, "bat", sample), false);
  assert.equal(f.objects.length, 72);
  assert.equal(calls, 9 * 27);
  f.objects.forEach((p) => p.destroy());
  assert.equal(enemyImpact(f.scene, 0, 0, "borer", sample), true);
});
test("effect trajectories stay localized and disappear without timers or physics APIs", () => {
  for (const kind of ["bat", "spore", "borer"]) {
    const f = fixture();
    enemyImpact(f.scene, 200, 200, kind, (a, b) => b);
    for (const tween of f.tweens) {
      assert.ok(tween.duration <= 520);
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        tween.targets.impactProgress = t;
        tween.onUpdate();
        assert.ok(Math.abs(tween.targets.x - 200) <= 35);
        assert.ok(Math.abs(tween.targets.y - 200) <= 50);
      }
      assert.equal(tween.targets.alpha, 0);
      tween.onComplete();
      assert.equal(tween.targets.dead, true);
    }
  }
});
