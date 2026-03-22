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
  bpm: 124,
  bars: 8,
  key: 'A',
  scale: 'minor',
  mood: 'ambient',
  density: 0.62,
  swing: 0.08,
  seed: 'aphex-twin-music-lab',
};

const DRUM_MAP = {
  kick: 36,
  snare: 38,
  hat: 42,
  openHat: 46,
  clap: 39,
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

const makeNote = ({ lane, midi, beat, duration, velocity }) => ({
  lane,
  midi,
  beat: Number(beat.toFixed(3)),
  duration: Number(duration.toFixed(3)),
  velocity: clamp(Math.round(velocity), 1, 127),
});

const rotate = (pattern, offset) => pattern.map((_, index) => pattern[(index + offset) % pattern.length]);

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

const addDrumLane = ({ events, lane, midi, pattern, barIndex, velocityBase, swing }) => {
  pattern.forEach((hit, stepIndex) => {
    if (!hit) {
      return;
    }

    const beat = barIndex * 4 + stepIndex * 0.25 + grooveOffset(stepIndex, swing);
    events.push(
      makeNote({
        lane,
        midi,
        beat,
        duration: lane === 'hat' ? 0.11 : 0.18,
        velocity: velocityBase - (stepIndex % 4 === 0 ? 0 : 7),
      }),
    );
  });
};

const createChordTrack = ({ progression, bars, key, scale, random }) => {
  const events = [];
  let previousChord = null;

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const degree = progression[barIndex % progression.length];
    const rawChord = buildChord({ key, scale, degree, octave: 4, width: 4 });
    const chord = invertChordNear(rawChord, previousChord);
    previousChord = chord;

    chord.forEach((midi, voiceIndex) => {
      events.push(
        makeNote({
          lane: 'chords',
          midi,
          beat: barIndex * 4 + voiceIndex * 0.02,
          duration: 3.75,
          velocity: 64 + Math.round(random() * 12),
        }),
      );
    });
  }

  return { events, finalChord: previousChord };
};

const createBassTrack = ({ progression, bars, key, scale, density, random }) => {
  const events = [];

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const degree = progression[barIndex % progression.length];
    const root = degreeToMidi({ key, scale, degree, octave: 2 });
    const fifth = degreeToMidi({ key, scale, degree: degree + 4, octave: 2 });
    const pickup = quantizeToScale({ midi: root + choose(random, [2, 3, 5, 7]), key, scale, min: 28, max: 60 });
    const barStart = barIndex * 4;

    events.push(makeNote({ lane: 'bass', midi: root, beat: barStart, duration: 0.9, velocity: 104 }));
    events.push(makeNote({ lane: 'bass', midi: fifth, beat: barStart + 1.5, duration: 0.6, velocity: 88 }));

    if (density > 0.45) {
      events.push(makeNote({ lane: 'bass', midi: root, beat: barStart + 2.5, duration: 0.45, velocity: 92 }));
    }

    if (density > 0.58) {
      events.push(makeNote({ lane: 'bass', midi: pickup, beat: barStart + 3.5, duration: 0.35, velocity: 84 }));
    }
  }

  return events;
};

const mutateMotif = (motif, random) => {
  const variants = [
    motif,
    [...motif].reverse(),
    motif.map((step, index) => step + (index % 2 === 0 ? 2 : -1)),
    motif.map((step, index) => step + (index === 2 ? 3 : 0)),
  ];

  return choose(random, variants);
};

const createMelodyTrack = ({ progression, bars, key, scale, density, swing, random }) => {
  const events = [];
  let motif = [1, 3, 5, 6];

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    const degree = progression[barIndex % progression.length];
    const barStart = barIndex * 4;
    if (barIndex % 2 === 0) {
      motif = mutateMotif(motif, random);
    }

    motif.forEach((interval, index) => {
      if (random() > density + 0.12) {
        return;
      }

      const beat = barStart + index * 0.75 + grooveOffset(index, swing * 0.6);
      const midi = quantizeToScale({
        midi: degreeToMidi({ key, scale, degree: degree + interval, octave: 5 }) + choose(random, [-2, 0, 0, 2]),
        key,
        scale,
        min: 60,
        max: 88,
      });

      events.push(
        makeNote({
          lane: 'melody',
          midi,
          beat,
          duration: choose(random, [0.23, 0.35, 0.5, 0.75]),
          velocity: 76 + Math.round(random() * 28),
        }),
      );
    });
  }

  return events.sort((left, right) => left.beat - right.beat);
};

const createDrumTrack = ({ bars, density, swing }) => {
  const events = [];
  const kick = euclidean(Math.round(4 + density * 4), 16);
  const snare = rotate(euclidean(2, 16), 4);
  const hat = euclidean(Math.round(8 + density * 4), 16);
  const openHat = rotate(euclidean(density > 0.7 ? 3 : 2, 16), 2);

  for (let barIndex = 0; barIndex < bars; barIndex += 1) {
    addDrumLane({ events, lane: 'kick', midi: DRUM_MAP.kick, pattern: kick, barIndex, velocityBase: 120, swing });
    addDrumLane({ events, lane: 'snare', midi: DRUM_MAP.snare, pattern: snare, barIndex, velocityBase: 110, swing });
    addDrumLane({ events, lane: 'hat', midi: DRUM_MAP.hat, pattern: hat, barIndex, velocityBase: 88, swing });
    addDrumLane({ events, lane: 'openHat', midi: DRUM_MAP.openHat, pattern: openHat, barIndex, velocityBase: 82, swing });
  }

  return events.sort((left, right) => left.beat - right.beat);
};

const buildSections = (bars) => {
  if (bars <= 4) {
    return [{ name: 'loop', startBar: 0, endBar: bars }];
  }

  const splitA = Math.max(2, Math.floor(bars * 0.25));
  const splitB = Math.max(splitA + 2, Math.floor(bars * 0.75));

  return [
    { name: 'intro', startBar: 0, endBar: splitA },
    { name: 'core', startBar: splitA, endBar: splitB },
    { name: 'outro', startBar: splitB, endBar: bars },
  ];
};

export const generateProject = (input = {}) => {
  const overrides = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
  const settings = {
    ...DEFAULTS,
    ...overrides,
    bars: clamp(Number(overrides.bars ?? DEFAULTS.bars), 2, 64),
    bpm: clamp(Number(overrides.bpm ?? DEFAULTS.bpm), 70, 180),
    density: clamp(Number(overrides.density ?? DEFAULTS.density), 0.2, 0.95),
    swing: clamp(Number(overrides.swing ?? DEFAULTS.swing), 0, 0.2),
  };

  const random = mulberry32(seedToInt(settings.seed));
  const progression = getProgressionDegrees(settings.mood);
  const chordTrack = createChordTrack({ ...settings, progression, random });
  const bassTrack = createBassTrack({ ...settings, progression, random });
  const melodyTrack = createMelodyTrack({ ...settings, progression, random });
  const drumTrack = createDrumTrack(settings);

  const tracks = {
    chords: chordTrack.events,
    bass: bassTrack,
    melody: melodyTrack,
    drums: drumTrack,
  };

  return {
    meta: {
      ...settings,
      progression,
      sections: buildSections(settings.bars),
      totalEvents: Object.values(tracks).reduce((sum, track) => sum + track.length, 0),
      finalChord: noteSummary(chordTrack.finalChord ?? []),
    },
    tracks,
  };
};

export const analyzeClip = ({ notes = [] }) => {
  const sorted = [...notes].sort((left, right) => left.beat - right.beat);
  const durations = sorted.map((note) => note.duration).filter(Boolean);
  const velocities = sorted.map((note) => note.velocity).filter(Boolean);

  return {
    noteCount: sorted.length,
    beatSpan: sorted.length ? Number((sorted.at(-1).beat + sorted.at(-1).duration - sorted[0].beat).toFixed(3)) : 0,
    pitchRange: sorted.length ? { min: sorted[0].midi, max: sorted.reduce((max, note) => Math.max(max, note.midi), sorted[0].midi) } : null,
    averageDuration: durations.length ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(3)) : 0,
    averageVelocity: velocities.length ? Number((velocities.reduce((sum, value) => sum + value, 0) / velocities.length).toFixed(2)) : 0,
  };
};
