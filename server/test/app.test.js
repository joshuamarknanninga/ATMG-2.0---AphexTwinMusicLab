import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from '../src/app.js';

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
  assert.equal(favicon.statusCode, 204);

  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});
