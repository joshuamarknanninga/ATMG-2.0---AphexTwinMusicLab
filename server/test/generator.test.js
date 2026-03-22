import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeClip, euclidean, generateProject } from '../src/services/generator.js';

test('euclidean spreads hits across the bar', () => {
  assert.deepEqual(euclidean(3, 8), [1, 0, 0, 1, 0, 0, 1, 0]);
});

test('project generation is deterministic for a seed', () => {
  const first = generateProject({ seed: 'same-seed', bars: 4, mood: 'dark' });
  const second = generateProject({ seed: 'same-seed', bars: 4, mood: 'dark' });

  assert.deepEqual(first, second);
  assert.equal(first.meta.totalEvents > 0, true);
  assert.equal(first.tracks.melody.length > 0, true);
});

test('analysis summarizes symbolic clips', () => {
  const summary = analyzeClip({
    notes: [
      { midi: 60, beat: 0, duration: 1, velocity: 90 },
      { midi: 67, beat: 1.5, duration: 0.5, velocity: 84 },
    ],
  });

  assert.deepEqual(summary, {
    noteCount: 2,
    beatSpan: 2,
    pitchRange: { min: 60, max: 67 },
    averageDuration: 0.75,
    averageVelocity: 87,
  });
});
