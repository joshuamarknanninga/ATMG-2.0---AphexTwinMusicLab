import { generateProject } from '../services/generator.js';
import { asEnum, asNumber, asString, ensureObject } from '../utils/validate.js';

const SCALE_OPTIONS = ['major', 'minor', 'dorian', 'mixolydian', 'phrygian'];
const MOOD_OPTIONS = ['ambient', 'dark', 'euphoric', 'restless'];

export const getMusicPresets = () => ({
  moods: MOOD_OPTIONS,
  scales: SCALE_OPTIONS,
  defaults: generateProject().meta,
});

export const validateGeneratorRequest = (body) => {
  const payload = ensureObject(body);

  return {
    bpm: payload.bpm == null ? undefined : asNumber(payload.bpm, 'bpm', { min: 70, max: 180 }),
    bars: payload.bars == null ? undefined : asNumber(payload.bars, 'bars', { min: 2, max: 64, integer: true }),
    key: payload.key == null ? undefined : asString(payload.key, 'key', { min: 1, max: 2 }),
    scale: payload.scale == null ? undefined : asEnum(payload.scale, 'scale', SCALE_OPTIONS),
    mood: payload.mood == null ? undefined : asEnum(payload.mood, 'mood', MOOD_OPTIONS),
    density: payload.density == null ? undefined : asNumber(payload.density, 'density', { min: 0.2, max: 0.95 }),
    swing: payload.swing == null ? undefined : asNumber(payload.swing, 'swing', { min: 0, max: 0.2 }),
    seed: payload.seed == null ? undefined : asString(payload.seed, 'seed', { min: 1, max: 200 }),
  };
};
