// Seasonal orchestration of the existing original score; no extra audio timer/voices.
export function holidayNotes(notes, mood, enabled) {
  if (!enabled || mood === 'boss') return notes;
  return notes.map((note, index) => {
    // The melody is the first short pitched note. Leave bass/percussion intact.
    if (index !== 0 || note.duration !== .13) return note;
    return {...note, frequency: note.frequency * 2, type: 'sine', duration: .23,
      volume: note.volume * .85};
  });
}
