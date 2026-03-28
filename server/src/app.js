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

const sendText = (res, status, body, origin) => {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
};

const sendEmpty = (res, status, origin) => {
  res.writeHead(status, {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'x-content-type-options': 'nosniff',
  });
  res.end();
};

const routeRequest = async (req, res) => {
  const origin = resolveOrigin(req);
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    return ok(res, { allow: ['GET', 'POST', 'OPTIONS'] }, 200, origin);
  }

  if (req.method === 'GET' && url.pathname === '/') {
    return sendText(
      res,
      200,
      'ATMG 2.0 music engine is running. Use /health or /api/music/presets to begin.',
      origin,
    );
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
