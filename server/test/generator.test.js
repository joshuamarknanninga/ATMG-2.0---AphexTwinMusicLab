import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeClip, euclidean, generateProject } from '../src/services/generator.js';

test('euclidean spreads hits across the bar', () => {
  assert.deepEqual(euclidean(3, 8), [1, 0, 0, 1, 0, 0, 1, 0]);
});

test('project generation is deterministic for a seed', () => {
  const first = generateProject({ seed: 'same-seed', bars: 8, preset: 'fractured' });
  const second = generateProject({ seed: 'same-seed', bars: 8, preset: 'fractured' });

  assert.deepEqual(first, second);
  assert.equal(first.meta.totalEvents > 0, true);
  assert.equal(first.tracks.melody.length > 0, true);
  assert.equal(first.tracks.texture.length > 0, true);
  assert.deepEqual(Object.keys(first.meta.trackSummary), ['chords', 'bass', 'melody', 'texture', 'drums']);
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
