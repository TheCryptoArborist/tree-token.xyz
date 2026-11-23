// Recovered from integration 55cb3ee65600fc5014c8eeaaadcdc0f0206d9a8b.
// Original synthesized TREE FORCE motifs. No Galaga samples or music are used.
const motif = (notes, type = "triangle", step = 0.075, priority = 2) =>
  Object.freeze({ notes: Object.freeze(notes), type, step, priority });
export const CUES = Object.freeze({
  windfallIntro: motif([294, 440, 587, 880], "triangle", 0.14, 4),
  ready: motif([440], "sine", 0.12, 4),
  go: motif([880, 1175], "sine", 0.08, 4),
  seed: motif([660, 990]),
  core: motif([440, 660, 880], "sine"),
  upgrade: motif([392, 494, 587, 784], "square", 0.09, 3),
  growth: motif([330, 440, 554, 660]),
  turbo: motif([740, 988, 1480], "sawtooth", 0.065),
  boom: motif([120, 70, 45], "sawtooth", 0.1, 3),
  shieldReady: motif([523, 659, 1047], "sine", 0.1, 3),
  shieldOn: motif([196, 392, 784], "sine", 0.09, 3),
  shieldOff: motif([392, 262], "sine", 0.08, 3),
  damage: motif([185, 110, 73], "sawtooth", 0.08, 3),
  lifeLost: motif([392, 294, 196, 98], "square", 0.12, 4),
  sector: motif([294, 370, 440, 587], "triangle", 0.12, 4),
  wave: motif([440, 554, 660], "triangle", 0.09, 3),
  challenge: motif([392, 523, 659, 784, 1047], "square", 0.1, 4),
  perfect: motif([523, 659, 784, 1047, 784, 1047], "triangle", 0.12, 4),
  clear: motif([392, 494, 587, 784], "triangle", 0.1, 3),
  boss: motif([147, 139, 147, 196], "sawtooth", 0.18, 4),
  bossPhase: motif([220, 277, 330], "sawtooth", 0.12, 3),
  victory: motif([392, 494, 587, 784, 988, 1175], "triangle", 0.15, 4),
  resume: motif([330, 440, 660, 880], "sine", 0.09, 4),
  rescue: motif([392, 523, 659, 1047], "triangle", 0.12, 3),
});

const MAX_VOICES = 10;
const IMPACT_VOICES = 4;
const COMBAT_CATEGORIES = new Set(["fire", "enemyFire", "hit", "kill"]);

export class CueMixer {
  constructor() {
    this.voices = [];
    this.last = new Map();
    this.duckUntil = 0;
    this.sfxVolume = 0.7;
    this.musicVolume = 0.55;
  }

  play(context, name) {
    const cue = CUES[name];
    return cue ? this.schedule(context, cue, name) : false;
  }

  // Preserve the legacy tone path for UI and other non-combat effects.
  shot(context, frequency, duration = 0.05, volume = 0.04) {
    return this.schedule(
      context,
      this.tone(frequency, duration, volume),
      "shot",
      0.065,
    );
  }

  tone(frequency, duration, volume, priority = 0) {
    return {
      notes: [frequency, frequency * 0.72],
      type: frequency < 170 ? "sawtooth" : "square",
      step: duration / 2,
      priority,
      volume,
    };
  }

  combat(context, category, frequency, duration = 0.05, volume = 0.04) {
    if (category === "legacy")
      return this.shot(context, frequency, duration, volume);
    if (!COMBAT_CATEGORIES.has(category))
      throw new Error("Unknown combat audio category");
    const impact = category === "hit" || category === "kill";
    // Impacts remain audible during reward cues, at reduced volume. Their short
    // voices are protected from cue preemption but never duck the music themselves.
    const gain = impact && context.currentTime < this.duckUntil ? 0.55 : 1;
    return this.schedule(
      context,
      this.tone(frequency, duration, volume * gain, impact ? 4 : 0),
      `combat:${category}`,
      impact ? 0.035 : category === "enemyFire" ? 0.09 : 0.065,
      impact ? "impact" : category,
    );
  }

  retire(voice, now) {
    const index = this.voices.indexOf(voice);
    if (index !== -1) this.voices.splice(index, 1);
    try {
      voice.osc.stop(now);
    } catch {}
  }

  schedule(context, cue, key, gap = 0.12, category) {
    const now = context.currentTime;
    if (!this.sfxVolume || now - (this.last.get(key) ?? -Infinity) < gap)
      return false;
    this.voices = this.voices.filter((voice) => voice.until > now);

    if (category) {
      const impact = category === "impact";
      const count = this.voices.filter(
        (voice) => voice.category === category,
      ).length;
      if (count + cue.notes.length > (impact ? IMPACT_VOICES : 2)) return false;
      if (
        !impact &&
        (now < this.duckUntil ||
          this.voices.length + cue.notes.length > MAX_VOICES - IMPACT_VOICES)
      )
        return false;
      if (impact) {
        // At capacity, replace expendable shot voices, never a named reward cue.
        for (const voice of [...this.voices]) {
          if (this.voices.length + cue.notes.length <= MAX_VOICES) break;
          if (voice.priority === 0) this.retire(voice, now);
        }
      }
    } else {
      if (
        cue.priority === 0 &&
        (this.voices.length >= 4 || now < this.duckUntil)
      )
        return false;
      if (cue.priority > 0) {
        for (const voice of [...this.voices]) {
          if (voice.priority < cue.priority) this.retire(voice, now);
        }
      }
    }

    if (this.voices.length + cue.notes.length > MAX_VOICES) return false;
    this.last.set(key, now);
    if (!category && cue.priority >= 3)
      this.duckUntil = now + cue.notes.length * cue.step + 0.1;
    cue.notes.forEach((frequency, index) => {
      const at = now + index * cue.step;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = cue.type;
      osc.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.exponentialRampToValueAtTime(
        (cue.volume ?? 0.075) * this.sfxVolume,
        at + 0.008,
      );
      gain.gain.exponentialRampToValueAtTime(0.001, at + cue.step * 0.9);
      osc.connect(gain);
      gain.connect(context.destination);
      const voice = {
        osc,
        until: at + cue.step,
        priority: cue.priority,
        category,
      };
      this.voices.push(voice);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        // A preempted voice may already have been removed. Never splice(-1).
        const index = this.voices.indexOf(voice);
        if (index !== -1) this.voices.splice(index, 1);
      };
      osc.start(at);
      osc.stop(at + cue.step);
    });
    return true;
  }

  stop() {
    for (const voice of [...this.voices]) this.retire(voice);
  }
}
