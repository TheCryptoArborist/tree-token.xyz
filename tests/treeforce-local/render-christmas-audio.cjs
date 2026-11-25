// Reproducible source-backed OfflineAudioContext renders, not live play recordings.
const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");
const output =
  process.env.TREEFORCE_AUDIO_DIR ||
  "/workspace/treeforce-feedback-evidence/sound-review";
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(
      "http://127.0.0.1:4196/__local/practice?lab=1&revision=r15&theme=christmas",
    );
    const summaries = [];
    for (const name of ['normal', 'bonus']) {
      const samples = await page.evaluate(async (name) => {
        const base = "/play/treeforce89/assets/";
        const { scoreStep } = await import(
          base + "sound-identity-r10.js"
        );
        const { AudioLifecycle } = await import(base + "audio-lifecycle-r8.js");
        const c = new OfflineAudioContext(1, Math.ceil(19.8 * 22050), 22050);
        const life = { blocked: () => false, voices: new Set() };
        const tone = (f, t, d, type, v) =>
          AudioLifecycle.prototype.tone.call(life, c, f, t, d, type, v);
          for (let i = 0; i < 128; i++)
            for (const n of (await import(base + "christmas-audio-local.js")).holidayNotes(scoreStep(name, i), name, true))
              tone(
                n.frequency,
                i * 0.15 + 0.025,
                n.duration,
                n.type,
                n.volume * 0.55,
              );
        return Array.from((await c.startRendering()).getChannelData(0));
      }, name);
      const peak = samples.reduce((m, n) => Math.max(m, Math.abs(n)), 0),
        rms = Math.sqrt(
          samples.reduce((s, n) => s + n * n, 0) / samples.length,
        );
      assert.ok(peak < 1 && rms > 0);
      const wav = Buffer.alloc(44 + samples.length * 2);
      wav.write("RIFF");
      wav.writeUInt32LE(wav.length - 8, 4);
      wav.write("WAVEfmt ", 8);
      wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20);
      wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(22050, 24);
      wav.writeUInt32LE(44100, 28);
      wav.writeUInt16LE(2, 32);
      wav.writeUInt16LE(16, 34);
      wav.write("data", 36);
      wav.writeUInt32LE(samples.length * 2, 40);
      samples.forEach((v, i) =>
        wav.writeInt16LE(Math.round(v * 32767), 44 + i * 2),
      );
      fs.writeFileSync(path.join(output, name + ".wav"), wav);
      summaries.push({ name, seconds: samples.length / 22050, peak, rms });
    }
    fs.writeFileSync(
      path.join(output, "raw-metrics.json"),
      JSON.stringify(summaries, null, 2),
    );
    console.log(JSON.stringify(summaries, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
