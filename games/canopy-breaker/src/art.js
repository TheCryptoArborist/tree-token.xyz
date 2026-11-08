import {W,H,BIOMES,PICKUPS,paddleWidth} from './engine.js';
import {drawPickup} from './pickup-art.js';
import {drawBlock} from './block-art.js';
import {drawBackground} from './background-art.js';
// src/art.js
function round(c, x, y, w, h, r = 8) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}
function leaf(c, x, y, scale, color, angle = 0) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(scale, scale);
  c.beginPath();
  c.moveTo(0, -12);
  c.bezierCurveTo(20, -10, 16, 10, 0, 15);
  c.bezierCurveTo(-16, 8, -12, -4, 0, -12);
  c.fillStyle = color;
  c.fill();
  c.strokeStyle = "#cbf6b857";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, 12);
  c.lineTo(1, -6);
  c.stroke();
  c.restore();
}
function paddle(c, s) {
  const w = paddleWidth(s), x = s.paddle, y = 828;
  c.save();
  c.translate(x, y);
  c.shadowColor = "#7ef3a0";
  c.shadowBlur = 14;
  round(c, -w / 2, -6, w, 9, 5);
  c.fillStyle = "#86f2a9";
  c.fill();
  c.shadowBlur = 0;
  const bark = c.createLinearGradient(0, 0, 0, 21);
  bark.addColorStop(0, "#7f6944");
  bark.addColorStop(0.5, "#3d3829");
  bark.addColorStop(1, "#1e281f");
  round(c, -w / 2, -3, w, 22, 8);
  c.fillStyle = bark;
  c.fill();
  c.strokeStyle = "#b5af69";
  c.stroke();
  c.strokeStyle = "#242b1e";
  c.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.moveTo(-w / 2 + i * 33, 6);
    c.quadraticCurveTo(i * 20 - w / 2 + 25, 16, i * 29 - w / 2 + 45, 10);
    c.stroke();
  }
  leaf(c, -w / 2 + 10, -6, 0.8, "#9befa0", -0.8);
  leaf(c, w / 2 - 10, -6, 0.8, "#69bf83", 0.8);
  c.fillStyle = "#173d2c";
  c.strokeStyle = "#a9de89";
  c.beginPath();
  c.moveTo(0, -9);
  c.lineTo(12, 5);
  c.lineTo(0, 20);
  c.lineTo(-12, 5);
  c.closePath();
  c.fill();
  c.stroke();
  if (s.effects.laser) {
    c.fillStyle = "#72e0b0";
    for (const x2 of [-w / 2 + 14, w / 2 - 14]) {
      c.beginPath();
      c.moveTo(x2 - 5, -2);
      c.lineTo(x2, -23);
      c.lineTo(x2 + 5, -2);
      c.fill();
    }
  }
  c.restore();
}
function draw(c, s, { time = 0, motion: motion2 = true } = {}) {
  c.clearRect(0, 0, W, H);
  const biome = Math.floor((s.level - 1) / 6), color = BIOMES[biome].color;
  drawBackground(c, biome, { time, motion: motion2 });
  c.fillStyle = "#bfe2c7";
  c.font = '600 14px "DM Sans",sans-serif';
  c.textAlign = "center";
  c.letterSpacing = "3px";
  c.fillText(BIOMES[biome].name.toUpperCase(), 400, 59);
  c.letterSpacing = "0px";
  c.fillStyle = "#6f9a86";
  c.font = '11px "DM Sans",sans-serif';
  c.fillText(s.level % 6 === 0 ? "BLIGHT SPORES \xB7 WATCH YOUR ROOTS" : "RESTORE THE FOREST", 400, 81);
  for (const b of s.bricks) drawBlock(c, b);
  if (s.boss) {
    const b = s.boss;
    c.save();
    c.translate(b.x, b.y);
    c.fillStyle = "#36233d";
    c.strokeStyle = "#bd79bc";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-60, 35);
    c.lineTo(-75, -25);
    c.lineTo(-40, -11);
    c.lineTo(-25, -60);
    c.lineTo(0, -27);
    c.lineTo(35, -65);
    c.lineTo(42, -12);
    c.lineTo(78, -28);
    c.lineTo(62, 36);
    c.closePath();
    c.fill();
    c.stroke();
    c.shadowColor = "#edaa43";
    c.shadowBlur = 20;
    c.fillStyle = "#ffcd70";
    c.fillRect(-32, -3, 18, 8);
    c.fillRect(14, -3, 18, 8);
    c.shadowBlur = 0;
    c.strokeStyle = "#17111e";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(-24, 20);
    c.lineTo(0, 28);
    c.lineTo(25, 17);
    c.stroke();
    c.restore();
    round(c, 250, 109, 300, 8, 4);
    c.fillStyle = "#392432";
    c.fill();
    round(c, 250, 109, 300 * b.hp / b.maxHp, 8, 4);
    c.fillStyle = "#dc84ce";
    c.fill();
  }
  for (const p of s.pickups) drawPickup(c, p.type, p.x, p.y, { time, motion: motion2 });
  for (const h of s.hazards) {
    c.fillStyle = "#773a65";
    c.strokeStyle = "#db86bd";
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      let a = i / 10 * TAU, r = i % 2 ? 7 : 14;
      c.lineTo(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.stroke();
  }
  for (const b of s.balls) {
    c.save();
    c.shadowColor = s.effects.hot ? "#ffb851" : b.primary ? color : "#8fc8ff";
    c.shadowBlur = 22;
    c.fillStyle = s.effects.hot ? "#ffd26e" : b.primary ? "#edffb8" : "#b1e2ff";
    c.beginPath();
    c.arc(b.x, b.y, b.primary ? 8 : 6, 0, TAU);
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = "#030810";
    c.lineWidth = 1.6;
    c.stroke();
    c.strokeStyle = "#406843";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(b.x - 3, b.y + 5);
    c.quadraticCurveTo(b.x - 5, b.y - 3, b.x + 3, b.y - 6);
    c.stroke();
    c.restore();
  }
  for (const shot of s.shots) {
    c.fillStyle = "#a6ffd2";
    c.beginPath();
    c.moveTo(shot.x, shot.y - 18);
    c.lineTo(shot.x - 3, shot.y + 4);
    c.lineTo(shot.x + 3, shot.y + 4);
    c.fill();
  }
  for (const e of s.events) {
    const age = s.tick - e.tick;
    if (age < 24 && ["break", "hit", "paddle"].includes(e.type) && motion2) {
      c.globalAlpha = 1 - age / 24;
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6, d = age * 1.5;
        c.fillStyle = i % 2 ? color : "#dbc893";
        c.fillRect(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 4, 4);
      }
      c.globalAlpha = 1;
    }
  }
  paddle(c, s);
  const effects = Object.keys(s.effects);
  if (effects.length) {
    c.font = "11px sans-serif";
    c.textAlign = "center";
    c.fillStyle = color;
    c.fillText(effects.map((id) => PICKUPS.find((p) => p.id === id)?.name + " " + Math.ceil(s.effects[id] / 60) + "s").join("   \xB7   "), 400, 775);
  }
  c.textAlign = "center";
  c.font = '10px "DM Sans",sans-serif';
  c.fillStyle = "#6b9579";
  c.fillText("THE ROOTS HOLD. THE CANOPY RISES.", 400, 886);
}
var TAU;
TAU = Math.PI * 2;
export {draw};
