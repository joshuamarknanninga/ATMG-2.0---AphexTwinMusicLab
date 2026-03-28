import { createServer } from 'node:http';

import { env } from './config/env.js';
import { requireSession } from './middleware/auth.js';
import { createGuestSession } from './routes/auth.routes.js';
import { generateProject } from './services/generator.js';
import { getMusicPresets, validateGeneratorRequest } from './routes/music.routes.js';
import { createProject, getProject, listProjects } from './routes/project.routes.js';
import { analyzeNotes } from './routes/upload.routes.js';
import { HttpError } from './utils/errors.js';
import { fail, ok, readJsonBody } from './utils/http.js';

const resolveOrigin = (req) => (env.CORS_ORIGIN === '*' ? '*' : req.headers.origin ?? env.CORS_ORIGIN);

const commonHeaders = (origin) => ({
  'access-control-allow-origin': origin,
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'x-content-type-options': 'nosniff',
});

const sendHtml = (res, status, body, origin) => {
  res.writeHead(status, {
    ...commonHeaders(origin),
    'content-type': 'text/html; charset=utf-8',
  });
  res.end(body);
};

const sendEmpty = (res, status, origin) => {
  res.writeHead(status, commonHeaders(origin));
  res.end();
};

const renderLandingPage = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ATMG 2.0 Music Engine</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif; background: #0a0f1d; color: #e9eefb; }
      .wrap { max-width: 840px; margin: 0 auto; padding: 48px 24px; }
      .tag { display: inline-block; border: 1px solid #3955b8; border-radius: 999px; padding: 6px 12px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: #9db0ff; }
      h1 { margin: 18px 0 8px; font-size: clamp(28px, 5vw, 44px); line-height: 1.05; }
      p { color: #c8d2f2; line-height: 1.55; }
      ul { margin-top: 24px; padding-left: 0; list-style: none; display: grid; gap: 12px; }
      li { background: #111936; border: 1px solid #2a3d88; border-radius: 12px; }
      a { display: block; padding: 14px 16px; color: #dbe5ff; text-decoration: none; }
      a:hover { background: #16214b; }
      code { color: #9db0ff; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <span class="tag">ATMG 2.0</span>
      <h1>Music engine is running.</h1>
      <p>Use one of the endpoints below to generate deterministic arrangements, inspect presets, and check service health.</p>
      <ul>
        <li><a href="/health"><code>GET /health</code> — service status</a></li>
        <li><a href="/api/music/presets"><code>GET /api/music/presets</code> — available presets and defaults</a></li>
      </ul>
      <p>Tip: send JSON to <code>POST /api/music/generate</code> to build a project from a seed.</p>
    </main>
  </body>
</html>`;

const routeRequest = async (req, res) => {
  const origin = resolveOrigin(req);
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    return ok(res, { allow: ['GET', 'POST', 'OPTIONS'] }, 200, origin);
  }

  if (req.method === 'GET' && url.pathname === '/') {
    return sendHtml(res, 200, renderLandingPage(), origin);
  }

  if (req.method === 'GET' && url.pathname === '/favicon.ico') {
    return sendEmpty(res, 204, origin);
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return ok(res, { service: 'ATMG 2.0 music engine', status: 'ok' }, 200, origin);
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/guest') {
    return ok(res, createGuestSession(await readJsonBody(req)), 201, origin);
  }

  if (req.method === 'GET' && url.pathname === '/api/music/presets') {
    return ok(res, getMusicPresets(), 200, origin);
  }

  if (req.method === 'POST' && url.pathname === '/api/music/generate') {
    return ok(res, generateProject(validateGeneratorRequest(await readJsonBody(req))), 200, origin);
  }

  if (url.pathname === '/api/projects' && req.method === 'GET') {
    const session = requireSession(req);
    return ok(res, listProjects(session.id), 200, origin);
  }

  if (url.pathname === '/api/projects' && req.method === 'POST') {
    const session = requireSession(req);
    return ok(res, createProject({ userId: session.id, body: await readJsonBody(req) }), 201, origin);
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/projects/')) {
    const session = requireSession(req);
    const projectId = url.pathname.split('/').at(-1);
    return ok(res, getProject({ userId: session.id, projectId }), 200, origin);
  }

  if (req.method === 'POST' && url.pathname === '/api/uploads/analyze') {
    return ok(res, analyzeNotes(await readJsonBody(req)), 200, origin);
  }

  throw new HttpError(404, 'Route not found');
};

export const createApp = () =>
  createServer(async (req, res) => {
    try {
      await routeRequest(req, res);
    } catch (error) {
      const origin = resolveOrigin(req);
      const status = error.status ?? (error instanceof SyntaxError ? 400 : 500);
      const message = error instanceof SyntaxError ? 'Invalid JSON payload' : error.message ?? 'Unexpected server error';
      const details = error instanceof HttpError ? error.details : undefined;
      fail(res, status, message, details, origin);
    }
  });
