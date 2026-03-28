const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

const MOOD_PROGRESSIONS = {
  ambient: [1, 6, 4, 5],
  dark: [1, 7, 6, 7],
  euphoric: [1, 5, 6, 4],
  restless: [1, 2, 6, 5],
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const noteNameToPitchClass = (noteName) => {
  const normalized = noteName.trim().toUpperCase();
  const index = NOTE_NAMES.findIndex((note) => note === normalized);

  if (index === -1) {
    throw new Error(`Unsupported key: ${noteName}`);
  }

  return index;
};

export const midiToNoteName = (midi) => {
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
};

export const buildScale = (rootName, scaleName) => {
  const intervals = SCALES[scaleName] ?? SCALES.minor;
  const root = noteNameToPitchClass(rootName);
  return intervals.map((interval) => (interval + root) % 12);
};

export const degreeToMidi = ({ key, scale, degree, octave = 4 }) => {
  const scalePitchClasses = buildScale(key, scale);
  const pitchClass = scalePitchClasses[(degree - 1 + scalePitchClasses.length) % scalePitchClasses.length];
  return octave * 12 + pitchClass + 12;
};

export const buildChord = ({ key, scale, degree, octave = 4, width = 3 }) => {
  return Array.from({ length: width }, (_, index) =>
    degreeToMidi({
      key,
      scale,
      degree: degree + index * 2,
      octave: octave + Math.floor((degree - 1 + index * 2) / 7),
    }),
  );
};

export const getProgressionDegrees = (mood) => MOOD_PROGRESSIONS[mood] ?? MOOD_PROGRESSIONS.ambient;

export const scoreVoiceLeading = (previous, next) => {
  if (!previous?.length) {
    return 0;
  }

  return next.reduce((sum, note, index) => sum + Math.abs(note - (previous[index] ?? note)), 0);
};

export const invertChordNear = (chord, previous) => {
  const candidates = [];

  for (let inversion = 0; inversion < chord.length; inversion += 1) {
    const working = chord.map((note, index) => note + (index < inversion ? 12 : 0)).sort((a, b) => a - b);
    candidates.push(working);
    candidates.push(working.map((note) => note - 12));
    candidates.push(working.map((note) => note + 12));
  }

  return candidates
    .map((candidate) => ({ candidate, score: scoreVoiceLeading(previous, candidate) }))
    .sort((left, right) => left.score - right.score)[0].candidate;
};

export const quantizeToScale = ({ midi, key, scale, min = 36, max = 96 }) => {
  const scalePitchClasses = buildScale(key, scale);
  const bounded = clamp(midi, min, max);
  let best = bounded;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let candidate = min; candidate <= max; candidate += 1) {
    if (!scalePitchClasses.includes(((candidate % 12) + 12) % 12)) {
      continue;
    }

    const distance = Math.abs(candidate - bounded);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
};

export const noteSummary = (midiNotes) => midiNotes.map(midiToNoteName);
