import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeClip, euclidean, generateProject } from '../src/services/generator.js';

test('euclidean spreads hits across the bar', () => {
  assert.deepEqual(euclidean(3, 8), [1, 0, 0, 1, 0, 0, 1, 0]);
});

test('project generation is deterministic for a seed', () => {
  const first = generateProject({ seed: 'same-seed', bars: 132, preset: 'fractured' });
  const second = generateProject({ seed: 'same-seed', bars: 132, preset: 'fractured' });

  assert.deepEqual(first, second);
  assert.equal(first.meta.totalEvents > 0, true);
  assert.equal(first.tracks.melody.length > 0, true);
  assert.equal(first.tracks.texture.length > 0, true);
  assert.deepEqual(Object.keys(first.meta.trackSummary), ['chords', 'bass', 'melody', 'texture', 'drums']);
  assert.equal(first.meta.durationMinutes >= 4, true);
  assert.equal(first.meta.durationMinutes <= 12, true);
});

test('different presets reshape the arrangement profile', () => {
  const lucid = generateProject({ seed: 'preset-check', bars: 16, preset: 'lucid' });
  const corrosive = generateProject({ seed: 'preset-check', bars: 16, preset: 'corrosive' });

  assert.notDeepEqual(lucid.meta.seedMotif, corrosive.meta.seedMotif);
  assert.notEqual(lucid.meta.presetProfile.instability, corrosive.meta.presetProfile.instability);
  assert.equal(lucid.meta.sections.length, 4);
  assert.equal(corrosive.meta.sections.some((section) => section.name === 'fracture'), true);
});

test('analysis summarizes symbolic clips', () => {
  const summary = analyzeClip({
    notes: [
      { midi: 60, beat: 0, duration: 1, velocity: 90 },
      { midi: 67, beat: 1.5, duration: 0.5, velocity: 84 },
      { midi: 64, beat: 2.25, duration: 0.25, velocity: 78 },
    ],
  });

  assert.deepEqual(summary, {
    noteCount: 3,
    beatSpan: 2.5,
    pitchRange: { min: 60, max: 67 },
    averageDuration: 0.583,
    averageVelocity: 84,
    averageIntervalLeap: 5,
  });
});


test('duration policy clamps output between 4 and 12 minutes', () => {
  const tooShort = generateProject({ seed: 'duration-short', bpm: 120, bars: 16 });
  const tooLong = generateProject({ seed: 'duration-long', bpm: 120, bars: 500 });

  assert.equal(tooShort.meta.measures, 120);
  assert.equal(tooLong.meta.measures, 360);
  assert.equal(tooShort.meta.durationPolicy.adjusted, true);
  assert.equal(tooLong.meta.durationPolicy.adjusted, true);
  assert.equal(tooShort.meta.durationMinutes >= 4 && tooShort.meta.durationMinutes <= 12, true);
  assert.equal(tooLong.meta.durationMinutes >= 4 && tooLong.meta.durationMinutes <= 12, true);
});
