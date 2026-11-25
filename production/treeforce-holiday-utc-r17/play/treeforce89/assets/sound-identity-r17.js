import {holidayMusicEnabled} from "./holiday-mode-r17.js";
import {holidayNotes} from "./christmas-audio-r16.js";
// Original Tree Force phrases: eight bars at the existing 150ms step (19.2s).
// No reference-game music, samples or melodies are imported.
import { CueMixer } from "./combat-feedback-r6.js";
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const THEMES = {
  normal: [
    [62, 0, 65, 69, 0, 67, 65, 0, 62, 0, 64, 65, 0, 69, 67, 0],
    [60, 0, 64, 67, 0, 69, 67, 0, 64, 0, 62, 60, 0, 64, 67, 0],
    [58, 0, 62, 65, 0, 67, 69, 0, 65, 0, 62, 60, 0, 62, 65, 0],
    [57, 0, 61, 64, 0, 67, 64, 0, 61, 0, 64, 67, 0, 69, 0, 0],
    [74, 0, 72, 69, 0, 65, 67, 0, 69, 0, 72, 74, 0, 77, 74, 0],
    [72, 0, 69, 67, 0, 64, 67, 0, 69, 0, 67, 64, 0, 62, 60, 0],
    [65, 0, 69, 70, 0, 69, 65, 0, 62, 0, 65, 67, 0, 65, 62, 0],
    [61, 0, 64, 67, 0, 69, 67, 0, 65, 0, 64, 61, 62, 0, 0, 0],
  ],
  bonus: [
    [74, 78, 81, 0, 78, 0, 74, 0, 76, 79, 83, 0, 79, 0, 76, 0],
    [73, 76, 81, 0, 76, 0, 73, 0, 74, 78, 81, 0, 86, 0, 81, 0],
    [71, 74, 78, 0, 81, 0, 78, 0, 71, 74, 78, 0, 83, 0, 81, 0],
    [69, 73, 76, 0, 81, 0, 76, 0, 73, 76, 79, 0, 81, 0, 0, 0],
    [86, 0, 81, 78, 0, 81, 86, 0, 83, 0, 79, 76, 0, 79, 83, 0],
    [81, 0, 76, 73, 0, 76, 81, 0, 78, 0, 74, 78, 0, 81, 86, 0],
    [83, 0, 81, 78, 0, 74, 78, 0, 81, 0, 78, 74, 0, 71, 74, 0],
    [76, 0, 79, 81, 0, 79, 76, 0, 73, 0, 76, 81, 86, 0, 0, 0],
  ],
  boss: [
    [50, 0, 0, 57, 0, 53, 0, 0, 50, 0, 56, 0, 57, 0, 0, 0],
    [49, 0, 0, 56, 0, 52, 0, 0, 49, 0, 55, 0, 56, 0, 0, 0],
    [46, 0, 0, 53, 0, 50, 0, 0, 46, 0, 52, 0, 53, 0, 0, 0],
    [45, 0, 0, 52, 0, 49, 0, 0, 45, 0, 51, 0, 52, 0, 0, 0],
    [62, 0, 65, 0, 68, 0, 69, 0, 62, 0, 0, 65, 0, 69, 0, 0],
    [61, 0, 64, 0, 67, 0, 68, 0, 61, 0, 0, 64, 0, 68, 0, 0],
    [58, 0, 62, 0, 65, 0, 68, 0, 65, 0, 62, 0, 58, 0, 0, 0],
    [57, 0, 61, 0, 64, 0, 67, 0, 69, 0, 67, 64, 61, 0, 0, 0],
  ],
};
const ROOTS = {
  normal: [38, 36, 34, 33, 38, 36, 34, 33],
  bonus: [50, 49, 47, 45, 50, 49, 47, 45],
  boss: [38, 37, 34, 33, 38, 37, 34, 33],
};
export function encounterMood(game) {
  try {
    const s = game?.scene.getScene("game");
    if (!s?.sys.isActive()) return "normal";
    if (s.challenge || s.windfall) return "bonus";
    return s.run?.wave === 9 && !s.waveClearing ? "boss" : "normal";
  } catch {
    return "normal";
  }
}
export function scoreStep(mood, index) {
  if (!THEMES[mood]) throw Error("Unknown score mood");
  const step = ((index % 128) + 128) % 128,
    bar = Math.floor(step / 16),
    beat = step % 16,
    notes = [];
  const add = (frequency, duration, type, volume) =>
    notes.push({ frequency, duration, type, volume });
  const melody = THEMES[mood][bar][beat];
  if (melody)
    add(
      hz(melody),
      mood === "boss" ? 0.17 : 0.13,
      mood === "bonus" ? "square" : "triangle",
      mood === "bonus" ? 0.012 : 0.024,
    );
  if (beat % 4 === 0 || (mood === "boss" && beat % 4 === 2))
    add(
      hz(ROOTS[mood][bar] + (beat === 8 ? 7 : 0)),
      0.24,
      mood === "boss" ? "sawtooth" : "triangle",
      mood === "boss" ? 0.024 : 0.038,
    );
  if (beat % 4 === 0) add(48, 0.1, "sine", 0.055);
  if (beat % 4 === 2)
    add(mood === "bonus" ? 220 : 165, 0.045, "triangle", 0.018);
  return notes;
}
export class CanopyScore {
  constructor() {
    this.mood = null;
    this.step = 0;
  }
  tick(lifecycle, context, mixer) {
    const mood = encounterMood(lifecycle.owner);
    if (mood !== this.mood) {
      this.mood = mood;
      this.step = 0;
    }
    const gain =
      mixer.musicVolume * (context.currentTime < mixer.duckUntil ? 0.35 : 1);
    for (const note of holidayNotes(scoreStep(mood, this.step++), mood, holidayMusicEnabled(lifecycle.owner)))
      lifecycle.tone(
        context,
        note.frequency,
        context.currentTime + 0.025,
        note.duration,
        note.type,
        note.volume * gain,
      );
  }
  reset() {
    this.mood = null;
    this.step = 0;
  }
}
export class IdentityMixer extends CueMixer {
  combatTone(category, frequency, duration, volume, priority) {
    const base = { step: duration / 2, volume, priority };
    if (category === "fire")
      return {
        ...base,
        notes: [frequency, frequency * 1.5],
        type: frequency < 400 ? "triangle" : "square",
      };
    if (category === "enemyFire")
      return { ...base, notes: [frequency, frequency * 0.6], type: "sawtooth" };
    if (category === "hit")
      return { ...base, notes: [frequency * 1.8, frequency], type: "triangle" };
    if (category === "kill")
      return {
        ...base,
        notes: [frequency, frequency * 0.42],
        type: frequency < 170 ? "sawtooth" : "triangle",
      };
    return super.combatTone(category, frequency, duration, volume, priority);
  }
}
