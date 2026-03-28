import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from '../src/app.js';
import { generateProject } from '../src/services/generator.js';

const request = (port, path) =>
  new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });

    req.on('error', reject);
    req.end();
  });

const postJson = (port, path, payload) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
      },
    );
    req.on('error', reject);
    req.end(JSON.stringify(payload));
  });

test('root and favicon endpoints avoid confusing browser 404s', async () => {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  const root = await request(port, '/');
  const favicon = await request(port, '/favicon.ico');

  assert.equal(root.statusCode, 200);
  assert.match(root.body, /<title>ATMG 2\.0 Music Engine<\/title>/);
  assert.match(root.body, /FX pedalboard UI/);
  assert.match(root.body, /Generate Project/);
  assert.match(root.body, /Play Project/);
  assert.match(root.body, /FX Pedalboard/);
  assert.match(root.body, /Connect MIDI/);
  assert.match(root.body, /Drum Machine Pads/);
  assert.match(root.body, /Lock Pattern/);
  assert.match(root.body, /Sync Play/);
  assert.match(root.body, /Tape Delay/);
  assert.match(root.body, /Warmth/);
  assert.match(root.body, /Humanize/);
  assert.match(root.body, /Download Mix \(MP3\)/);
  assert.match(root.body, /Export MIDI/);
  assert.match(root.body, /Export Stems JSON/);
  assert.match(root.body, /Mix Banks \+ Auto Beat Matching/);
  assert.match(root.body, /Auto Match Banks/);
  assert.match(root.body, /Tempo Match/);
  assert.match(root.body, /Randomizer Visualizer/);
  assert.match(root.body, /Randomize Visuals/);
  assert.match(root.body, /Amen Break/);
  assert.match(root.body, /Funky Drummer/);
  assert.match(root.body, /When the Levee Breaks/);
  assert.match(root.body, /Apache Break/);
  assert.equal(favicon.statusCode, 204);

  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('export endpoints produce midi and stem bundle artifacts', async () => {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const project = generateProject({ seed: 'export-test', bars: 8, bpm: 120 });

  const midi = await postJson(port, '/api/exports/midi', { project });
  const stems = await postJson(port, '/api/exports/stems', { project });

  assert.equal(midi.statusCode, 200);
  assert.equal(midi.headers['content-type'], 'audio/midi');
  assert.equal(midi.body.subarray(0, 4).toString('utf8'), 'MThd');

  assert.equal(stems.statusCode, 200);
  assert.equal(stems.headers['content-type'], 'application/json; charset=utf-8');
  const stemPayload = JSON.parse(stems.body.toString('utf8'));
  assert.equal(typeof stemPayload.stems, 'object');
  assert.equal(Array.isArray(stemPayload.stems.drums.notes), true);

  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});
