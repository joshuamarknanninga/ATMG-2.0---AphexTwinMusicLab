import { analyzeClip } from '../services/generator.js';
import { asArray, asNumber, ensureObject } from '../utils/validate.js';

export const analyzeNotes = (body) => {
  const payload = ensureObject(body);
  const notes = asArray(payload.notes, 'notes', { max: 4096, fallback: [] }).map((note, index) => {
    const item = ensureObject(note, `notes[${index}]`);

    return {
      midi: asNumber(item.midi, `notes[${index}].midi`, { min: 0, max: 127, integer: true }),
      beat: asNumber(item.beat, `notes[${index}].beat`, { min: 0 }),
      duration: asNumber(item.duration, `notes[${index}].duration`, { min: Number.MIN_VALUE }),
      velocity: asNumber(item.velocity, `notes[${index}].velocity`, { min: 1, max: 127, integer: true }),
    };
  });

  return analyzeClip({ notes });
};
