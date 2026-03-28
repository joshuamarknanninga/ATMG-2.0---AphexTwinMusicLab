import crypto from 'node:crypto';

import {
  buildChord,
  degreeToMidi,
  getProgressionDegrees,
  invertChordNear,
  noteSummary,
  quantizeToScale,
} from './musicTheory.js';

const DEFAULTS = {
  bpm: 132,
  bars: 24,
  key: 'A',
  scale: 'minor',
  mood: 'restless',
  preset: 'fractured',
  density: 0.42,
  swing: 0.04,
  syncopation: 0.46,
  mutation: 0.34,
  instability: 0.22,
  brightness: 0.48,
  texture: 0.58,
  seed: 'atmg-experimental-idm',
};

const PRESET_PROFILES = {
  fractured: {
    mood: 'restless',
    scale: 'minor',
    density: 0.5,
    syncopation: 0.62,
    mutation: 0.48,
    instability: 0.34,
    brightness: 0.42,
    texture: 0.62,
    swing: 0.05,
  },
  lucid: {
    mood: 'euphoric',
    scale: 'dorian',
    density: 0.4,
    syncopation: 0.48,
    mutation: 0.3,
    instability: 0.18,
    brightness: 0.66,
    texture: 0.72,
    swing: 0.04,
  },
  corrosive: {
    mood: 'dark',
    scale: 'phrygian',
    density: 0.56,
    syncopation: 0.6,
    mutation: 0.58,
    instability: 0.42,
    brightness: 0.24,
    texture: 0.44,
    swing: 0.07,
  },
  hypnotic: {
    mood: 'ambient',
    scale: 'mixolydian',
    density: 0.34,
    syncopation: 0.36,
    mutation: 0.24,
    instability: 0.14,
    brightness: 0.58,
    texture: 0.84,
    swing: 0.03,
  },
};

const GROOVE_TEMPLATES = ['straight', 'dilla', 'broken_beat', 'garage_swing'];

const DRUM_MAP = {
  kick: 36,
  snare: 38,
  hat: 42,
  openHat: 46,
  perc: 45,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const mulberry32 = (seed) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const seedToInt = (seed) => {
  const hash = crypto.createHash('sha256').update(String(seed)).digest();
  return hash.readUInt32LE(0);
};

const choose = (random, items) => items[Math.floor(random() * items.length) % items.length];
const maybe = (random, probability) => random() < probability;

const makeNote = ({ lane, midi, beat, duration, velocity }) => ({
  lane,
  midi,
  beat: Number(beat.toFixed(3)),
  duration: Number(duration.toFixed(3)),
  velocity: clamp(Math.round(velocity), 1, 127),
});

const rotate = (pattern, offset) => pattern.map((_, index) => pattern[(index + offset + pattern.length) % pattern.length]);

export const euclidean = (pulses, steps) => {
  if (steps <= 0) {
    return [];
  }

  if (pulses <= 0) {
    return Array.from({ length: steps }, () => 0);
  }

  return Array.from({ length: steps }, (_, index) => (((index * pulses) % steps) < pulses ? 1 : 0));
};

const grooveOffset = (stepIndex, swingAmount) => (stepIndex % 2 === 1 ? swingAmount : 0);
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 4;

const barsForMinutes = (minutes, bpm) => Math.ceil((minutes * bpm) / 4);

const normalizeDuration = (settings) => {
  const minBars = barsForMinutes(MIN_DURATION_MINUTES, settings.bpm);
  const maxBars = barsForMinutes(MAX_DURATION_MINUTES, settings.bpm);
  const requestedBars = settings.bars;
  const normalizedBars = clamp(requestedBars, minBars, maxBars);
  return {
    ...settings,
    bars: normalizedBars,
    durationPolicy: {
      requestedBars,
      minBars,
      maxBars,
      adjusted: requestedBars !== normalizedBars,
      minMinutes: MIN_DURATION_MINUTES,
      maxMinutes: MAX_DURATION_MINUTES,
    },
  };
};


const mergeSettings = (input) => {
  const overrides = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
  const presetProfile = PRESET_PROFILES[overrides.preset] ?? PRESET_PROFILES[DEFAULTS.preset];
  return {
    ...DEFAULTS,
    ...presetProfile,
    ...overrides,
    bars: clamp(Number(overrides.bars ?? presetProfile.bars ?? DEFAULTS.bars), 2, 256),
    bpm: clamp(Number(overrides.bpm ?? presetProfile.bpm ?? DEFAULTS.bpm), 70, 180),
    density: clamp(Number(overrides.density ?? presetProfile.density ?? DEFAULTS.density), 0.15, 0.8),
    swing: clamp(Number(overrides.swing ?? presetProfile.swing ?? DEFAULTS.swing), 0, 0.2),
    syncopation: clamp(Number(overrides.syncopation ?? presetProfile.syncopation ?? DEFAULTS.syncopation), 0, 1),
    mutation: clamp(Number(overrides.mutation ?? presetProfile.mutation ?? DEFAULTS.mutation), 0, 1),
    instability: clamp(Number(overrides.instability ?? presetProfile.instability ?? DEFAULTS.instability), 0, 1),
    brightness: clamp(Number(overrides.brightness ?? presetProfile.brightness ?? DEFAULTS.brightness), 0, 1),
    texture: clamp(Number(overrides.texture ?? presetProfile.texture ?? DEFAULTS.texture), 0, 1),
    grooveTemplate: GROOVE_TEMPLATES.includes(String(overrides.grooveTemplate ?? ''))
      ? String(overrides.grooveTemplate)
      : 'straight',
  };
};

const grooveTransform = (note, grooveTemplate) => {
  if (grooveTemplate === 'straight') {
    return note;
  }

  const isOffbeat = Math.floor((note.beat % 1) * 4) % 2 === 1;
  const lane = note.lane;
  let offset = 0;
  let velocityScale = 1;

  if (grooveTemplate === 'dilla') {
    offset += isOffbeat ? 0.022 : -0.004;
    if (lane === 'snare' || lane === 'hat') {
      offset += 0.008;
      velocityScale = 0.92;
    }
  } else if (grooveTemplate === 'broken_beat') {
    offset += isOffbeat ? 0.03 : -0.01;
    if (lane === 'kick') {
      velocityScale = 0.95;
    }
    if (lane === 'perc' || lane === 'texture') {
      offset += 0.01;
      velocityScale = 0.88;
    }
  } else if (grooveTemplate === 'garage_swing') {
    offset += isOffbeat ? 0.038 : -0.002;
    if (lane === 'hat' || lane === 'openHat') {
      velocityScale = 0.9;
    }
    if (lane === 'snare') {
      offset += 0.006;
    }
  }

  return {
    ...note,
    beat: Number(Math.max(0, note.beat + offset).toFixed(3)),
    velocity: clamp(Math.round(note.velocity * velocityScale), 1, 127),
  };
};

const applyGrooveTemplate = (tracks, grooveTemplate) =>
  Object.fromEntries(
    Object.entries(tracks).map(([lane, events]) => [
      lane,
      events.map((note) => grooveTransform(note, grooveTemplate)).sort((left, right) => left.beat - right.beat),
    ]),
  );

const buildSections = (bars, settings) => {
  if (bars <= 4) {
    return [{ name: 'loop', startBar: 0, endBar: bars, energy: settings.density, mutation: settings.mutation, texture: settings.texture }];
  }

  const structure = bars >= 16
    ? [
      ['seed', 0.2, 0.35, 0.55],
      ['lift', 0.48, 0.58, 0.66],
      ['fracture', 0.78, 0.82, 0.5],
      ['release', 0.38, 0.44, 0.82],
    ]
    : [
      ['seed', 0.28, 0.42, 0.58],
      ['fracture', 0.74, 0.8, 0.48],
      ['release', 0.42, 0.46, 0.8],
    ];

  const lengths = Array.from({ length: structure.length }, () => Math.floor(bars / structure.length));
  lengths[lengths.length - 1] += bars - lengths.reduce((sum, value) => sum + value, 0);

  let cursor = 0;
  return structure.map(([name, energy, mutation, texture], index) => {
    const startBar = cursor;
    const endBar = cursor + lengths[index];
    cursor = endBar;
    return {
      name,
      startBar,
      endBar,
      energy: clamp((energy + settings.density) / 2, 0.2, 0.98),
      mutation: clamp((mutation + settings.mutation) / 2, 0, 1),
      texture: clamp((texture + settings.texture) / 2, 0, 1),
    };
  });
};

const sectionStateForBar = (barIndex, sections, settings) => {
  const section = sections.find((entry) => barIndex >= entry.startBar && barIndex < entry.endBar) ?? sections.at(-1);
  const localSpan = Math.max(1, section.endBar - section.startBar);
  const localProgress = (barIndex - section.startBar) / localSpan;

  return {
    ...section,
    localProgress,
    density: clamp(settings.density * (0.65 + section.energy * 0.35), 0.18, 0.72),
    syncopation: clamp(settings.syncopation * (0.7 + section.mutation * 0.45), 0, 1),
    instability: clamp(settings.instability * (0.72 + section.mutation * 0.55), 0, 1),
    brightness: clamp(settings.brightness * (0.66 + section.texture * 0.55), 0, 1),
  };
};

const createMotif = (random, settings) => {
  const length = choose(random, [4, 5, 6]);
  const pool = settings.brightness > 0.55 ? [1, 2, 3, 5, 6, 8] : [1, 3, 4, 5, 6, 7];
  return Array.from({ length }, () => choose(random, pool));
};

const mutateMotif = (motif, random, intensity) => {
  const amount = Math.max(1, Math.round(intensity * 3));
  const next = [...motif];

  for (let index = 0; index < amount; index += 1) {
    const mutationIndex = Math.floor(random() * next.length);
    const delta = choose(random, [-3, -2, -1, 1, 2, 3]);
    next[mutationIndex] = clamp(next[mutationIndex] + delta, 1, 10);
  }

  if (intensity > 0.65 && maybe(random, 0.45)) {
    return rotate(next, Math.floor(random() * next.length));
  }

  return next;
};

const createHarmonyTrack = ({ progression, bars, key, scale, sections, settings, random }) => {
  const events = [];
  let previousChord = null;
  let finalChord = null;

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const state = sectionStateForBar(barIndex, sections, settings);
    const degree = progression[barIndex % progression.length];
    const width = state.texture > 0.72 ? 5 : 4;
    const rawChord = buildChord({ key, scale, degree, octave: settings.brightness > 0.55 ? 4 : 3, width });
    const chord = invertChordNear(rawChord, previousChord);
    previousChord = chord;
    finalChord = chord;
    const barStart = barIndex * 4;

    if (state.energy < 0.45 && maybe(random, 0.55)) {
      chord.forEach((midi, voiceIndex) => {
        events.push(makeNote({ lane: 'chords', midi, beat: barStart + voiceIndex * 0.03, duration: 3.7, velocity: 56 + state.energy * 36 }));
      });
      continue;
    }

    const stabBeats = state.energy > 0.7 ? [0, 1.5, 2.75] : [0, 2];
    stabBeats.forEach((offset, hitIndex) => {
      chord.forEach((midi, voiceIndex) => {
        const velocity = 52 + state.energy * 42 + (voiceIndex === 0 ? 6 : 0) + hitIndex * 2;
        const duration = hitIndex === 0 ? 1.1 : 0.65 + state.texture * 0.35;
        events.push(makeNote({ lane: 'chords', midi, beat: barStart + offset + voiceIndex * 0.02, duration, velocity }));
      });
    });
  }

  return { events, finalChord };
};

const createBassTrack = ({ progression, bars, key, scale, sections, settings, random }) => {
  const events = [];

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const state = sectionStateForBar(barIndex, sections, settings);
    const degree = progression[barIndex % progression.length];
    const root = degreeToMidi({ key, scale, degree, octave: 2 });
    const fifth = degreeToMidi({ key, scale, degree: degree + 4, octave: 2 });
    const colorTone = quantizeToScale({ midi: root + choose(random, [2, 3, 5, 7, 9]), key, scale, min: 28, max: 60 });
    const barStart = barIndex * 4;
    const pattern = state.syncopation > 0.62 ? [0, 1.5, 2.75, 3.5] : [0, 2, 3.5];

    pattern.forEach((offset, stepIndex) => {
      const source = [root, fifth, root, colorTone][stepIndex % 4];
      const instabilityShift = maybe(random, state.instability * 0.22) ? choose(random, [-2, 2]) : 0;
      const midi = quantizeToScale({ midi: source + instabilityShift, key, scale, min: 28, max: 60 });
      events.push(makeNote({
        lane: 'bass',
        midi,
        beat: barStart + offset + (stepIndex === 1 ? settings.swing * 0.4 : 0),
        duration: stepIndex === 0 ? 0.95 : 0.3 + state.energy * 0.45,
        velocity: 86 + state.energy * 28,
      }));
    });
  }

  return events;
};

const createMelodyTrack = ({ progression, bars, key, scale, sections, settings, random }) => {
  const events = [];
  const seedMotif = createMotif(random, settings);
  let motif = seedMotif;

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const state = sectionStateForBar(barIndex, sections, settings);
    const degree = progression[barIndex % progression.length];
    const barStart = barIndex * 4;

    if (barIndex === sections.at(-1)?.startBar) {
      motif = maybe(random, 0.65) ? [...seedMotif] : mutateMotif(seedMotif, random, state.mutation);
    } else if (barIndex > 0 && (barIndex % 2 === 0 || maybe(random, state.mutation * 0.45))) {
      motif = mutateMotif(motif, random, state.mutation);
    }

    motif.forEach((interval, index) => {
      const restChance = clamp(0.52 - state.density * 0.18 + state.mutation * 0.1, 0.16, 0.68);
      if (maybe(random, restChance)) {
        return;
      }

      const rhythmicGrid = state.syncopation > 0.7 ? [0, 1, 2, 3.125] : [0, 1.25, 2.5];
      const offset = rhythmicGrid[index % rhythmicGrid.length] + grooveOffset(index, settings.swing * 0.75);
      const registerBase = settings.brightness > 0.56 ? 5 : 4;
      const contourShift = maybe(random, state.instability * 0.35) ? choose(random, [-3, -2, 2, 3]) : 0;
      const midi = quantizeToScale({
        midi: degreeToMidi({ key, scale, degree: degree + interval, octave: registerBase }) + contourShift,
        key,
        scale,
        min: 52,
        max: 92,
      });

      if (index > 2 && maybe(random, 0.45)) {
        return;
      }

      events.push(makeNote({
        lane: 'melody',
        midi,
        beat: barStart + offset,
        duration: choose(random, [0.18, 0.25, 0.33, 0.5, 0.75]),
        velocity: 70 + state.energy * 22 + state.brightness * 14,
      }));
    });
  }

  return { events: events.sort((left, right) => left.beat - right.beat), seedMotif };
};

const createTextureTrack = ({ progression, bars, key, scale, sections, settings, random }) => {
  const events = [];

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const state = sectionStateForBar(barIndex, sections, settings);
    const degree = progression[barIndex % progression.length];
    const barStart = barIndex * 4;
    const repetitions = Math.max(1, Math.round(state.texture * 2));

    if (state.texture < 0.5 && maybe(random, 0.45)) {
      continue;
    }

    for (let index = 0; index < repetitions; index += 1) {
      if (maybe(random, clamp(0.56 - state.texture * 0.16, 0.16, 0.62))) {
        continue;
      }

      const midi = quantizeToScale({
        midi: degreeToMidi({ key, scale, degree: degree + choose(random, [1, 3, 5, 7, 9]), octave: 5 + (state.brightness > 0.6 ? 1 : 0) }),
        key,
        scale,
        min: 64,
        max: 100,
      });

      const beat = barStart + index * (4 / (repetitions + 0.35)) + choose(random, [0, 0.125, 0.25]);
      events.push(makeNote({
        lane: 'texture',
        midi,
        beat,
        duration: 0.2 + state.texture * 0.9,
        velocity: 42 + state.texture * 34,
      }));
    }
  }

  return events.sort((left, right) => left.beat - right.beat);
};

const addDrumLane = ({ events, lane, midi, pattern, barIndex, velocityBase, swing, density, random, instability }) => {
  pattern.forEach((hit, stepIndex) => {
    if (!hit) {
      return;
    }

    const stutter = lane === 'perc' && maybe(random, instability * 0.35);
    const beat = barIndex * 4 + stepIndex * 0.25 + grooveOffset(stepIndex, swing);
    events.push(makeNote({ lane, midi, beat, duration: lane === 'hat' ? 0.08 : 0.16, velocity: velocityBase - (stepIndex % 4 === 0 ? 0 : 8) + density * 8 }));

    if (stutter) {
      events.push(makeNote({ lane, midi, beat: beat + 0.125, duration: 0.08, velocity: velocityBase - 20 }));
    }
  });
};

const createDrumTrack = ({ bars, sections, settings, random }) => {
  const events = [];

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const state = sectionStateForBar(barIndex, sections, settings);
    const kick = rotate(euclidean(Math.round(2 + state.density * 4), 16), maybe(random, state.syncopation * 0.4) ? 1 : 0);
    const snare = rotate(euclidean(2 + (state.energy > 0.72 ? 1 : 0), 16), 4);
    const hat = rotate(euclidean(Math.round(4 + state.density * 6), 16), Math.round(state.syncopation * 2));
    const perc = rotate(euclidean(Math.round(1 + state.syncopation * 4), 12).flatMap((step) => [step, 0]).slice(0, 16), 1);
    const openHat = rotate(euclidean(state.energy > 0.7 ? 2 : 1, 16), 2);

    addDrumLane({ events, lane: 'kick', midi: DRUM_MAP.kick, pattern: kick, barIndex, velocityBase: 118, swing: settings.swing * 0.35, density: state.density, random, instability: state.instability });
    addDrumLane({ events, lane: 'snare', midi: DRUM_MAP.snare, pattern: snare, barIndex, velocityBase: 108, swing: settings.swing, density: state.density, random, instability: state.instability });
    addDrumLane({ events, lane: 'hat', midi: DRUM_MAP.hat, pattern: hat, barIndex, velocityBase: 84, swing: settings.swing * 0.9, density: state.density, random, instability: state.instability });
    addDrumLane({ events, lane: 'openHat', midi: DRUM_MAP.openHat, pattern: openHat, barIndex, velocityBase: 76, swing: settings.swing, density: state.density, random, instability: state.instability });
    addDrumLane({ events, lane: 'perc', midi: DRUM_MAP.perc, pattern: perc, barIndex, velocityBase: 72, swing: settings.swing * 0.5, density: state.density, random, instability: state.instability });

    if (state.mutation > 0.66 && maybe(random, 0.42)) {
      const fillStart = barIndex * 4 + 3;
      [0, 0.25, 0.5, 0.75].forEach((offset, index) => {
        events.push(makeNote({
          lane: 'glitch',
          midi: choose(random, [39, 45, 46]),
          beat: fillStart + offset,
          duration: 0.08,
          velocity: 70 + index * 8,
        }));
      });
    }
  }

  return events.sort((left, right) => left.beat - right.beat);
};

const summarizeTrack = (events) => ({
  count: events.length,
  averageVelocity: Number(average(events.map((note) => note.velocity)).toFixed(2)),
  spanBeats: events.length ? Number((events.at(-1).beat + events.at(-1).duration - events[0].beat).toFixed(3)) : 0,
});

export const generateProject = (input = {}) => {
  const settings = normalizeDuration(mergeSettings(input));
  const random = mulberry32(seedToInt(settings.seed));
  const sections = buildSections(settings.bars, settings);
  const progression = getProgressionDegrees(settings.mood);
  const harmonyTrack = createHarmonyTrack({ progression, bars: settings.bars, key: settings.key, scale: settings.scale, sections, settings, random });
  const bassTrack = createBassTrack({ progression, bars: settings.bars, key: settings.key, scale: settings.scale, sections, settings, random });
  const melodyTrack = createMelodyTrack({ progression, bars: settings.bars, key: settings.key, scale: settings.scale, sections, settings, random });
  const textureTrack = createTextureTrack({ progression, bars: settings.bars, key: settings.key, scale: settings.scale, sections, settings, random });
  const drumTrack = createDrumTrack({ bars: settings.bars, sections, settings, random });

  const rawTracks = {
    chords: harmonyTrack.events,
    bass: bassTrack,
    melody: melodyTrack.events,
    texture: textureTrack,
    drums: drumTrack,
  };
  const tracks = applyGrooveTemplate(rawTracks, settings.grooveTemplate);

  const trackSummary = Object.fromEntries(Object.entries(tracks).map(([name, events]) => [name, summarizeTrack(events)]));
  const durationBeats = settings.bars * 4;
  const durationMinutes = Number((durationBeats / settings.bpm).toFixed(3));

  return {
    meta: {
      ...settings,
      measures: settings.bars,
      durationBeats,
      durationMinutes,
      presetProfile: PRESET_PROFILES[settings.preset],
      progression,
      sections,
      seedMotif: melodyTrack.seedMotif,
      totalEvents: Object.values(tracks).reduce((sum, track) => sum + track.length, 0),
      finalChord: noteSummary(harmonyTrack.finalChord ?? []),
      trackSummary,
    },
    tracks,
  };
};

export const analyzeClip = ({ notes = [] }) => {
  const sorted = [...notes].sort((left, right) => left.beat - right.beat);
  const durations = sorted.map((note) => note.duration).filter(Boolean);
  const velocities = sorted.map((note) => note.velocity).filter(Boolean);
  const intervals = sorted.slice(1).map((note, index) => Math.abs(note.midi - sorted[index].midi));

  return {
    noteCount: sorted.length,
    beatSpan: sorted.length ? Number((sorted.at(-1).beat + sorted.at(-1).duration - sorted[0].beat).toFixed(3)) : 0,
    pitchRange: sorted.length ? { min: sorted[0].midi, max: sorted.reduce((max, note) => Math.max(max, note.midi), sorted[0].midi) } : null,
    averageDuration: durations.length ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(3)) : 0,
    averageVelocity: velocities.length ? Number((velocities.reduce((sum, value) => sum + value, 0) / velocities.length).toFixed(2)) : 0,
    averageIntervalLeap: intervals.length ? Number((average(intervals)).toFixed(2)) : 0,
  };
};
