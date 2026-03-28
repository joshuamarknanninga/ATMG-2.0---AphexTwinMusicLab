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
  assert.match(root.body, /ATMG 2\.0 music engine is running/);
  assert.equal(favicon.statusCode, 204);

  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});
