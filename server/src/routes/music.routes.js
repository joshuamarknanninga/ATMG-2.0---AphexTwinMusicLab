import { generateProject } from '../services/generator.js';
import { asEnum, asNumber, asString, ensureObject } from '../utils/validate.js';

const SCALE_OPTIONS = ['major', 'minor', 'dorian', 'mixolydian', 'phrygian'];
const MOOD_OPTIONS = ['ambient', 'dark', 'euphoric', 'restless'];
const PRESET_OPTIONS = ['fractured', 'lucid', 'corrosive', 'hypnotic'];
const GROOVE_OPTIONS = ['straight', 'dilla', 'broken_beat', 'garage_swing'];

export const getMusicPresets = () => ({
  moods: MOOD_OPTIONS,
  scales: SCALE_OPTIONS,
  presets: PRESET_OPTIONS,
  defaults: generateProject().meta,
});

export const validateGeneratorRequest = (body) => {
  const payload = ensureObject(body);

  return {
    bpm: payload.bpm == null ? undefined : asNumber(payload.bpm, 'bpm', { min: 70, max: 180 }),
    bars: payload.bars == null ? undefined : asNumber(payload.bars, 'bars', { min: 2, max: 256, integer: true }),
    key: payload.key == null ? undefined : asString(payload.key, 'key', { min: 1, max: 2 }),
    scale: payload.scale == null ? undefined : asEnum(payload.scale, 'scale', SCALE_OPTIONS),
    mood: payload.mood == null ? undefined : asEnum(payload.mood, 'mood', MOOD_OPTIONS),
    preset: payload.preset == null ? undefined : asEnum(payload.preset, 'preset', PRESET_OPTIONS),
    grooveTemplate: payload.grooveTemplate == null ? undefined : asEnum(payload.grooveTemplate, 'grooveTemplate', GROOVE_OPTIONS),
    density: payload.density == null ? undefined : asNumber(payload.density, 'density', { min: 0.15, max: 0.8 }),
    swing: payload.swing == null ? undefined : asNumber(payload.swing, 'swing', { min: 0, max: 0.2 }),
    syncopation: payload.syncopation == null ? undefined : asNumber(payload.syncopation, 'syncopation', { min: 0, max: 1 }),
    mutation: payload.mutation == null ? undefined : asNumber(payload.mutation, 'mutation', { min: 0, max: 1 }),
    instability: payload.instability == null ? undefined : asNumber(payload.instability, 'instability', { min: 0, max: 1 }),
    brightness: payload.brightness == null ? undefined : asNumber(payload.brightness, 'brightness', { min: 0, max: 1 }),
    texture: payload.texture == null ? undefined : asNumber(payload.texture, 'texture', { min: 0, max: 1 }),
    seed: payload.seed == null ? undefined : asString(payload.seed, 'seed', { min: 1, max: 200 }),
  };
};
