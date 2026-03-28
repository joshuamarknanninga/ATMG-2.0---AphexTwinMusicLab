import crypto from 'node:crypto';

import { HttpError } from '../utils/errors.js';

const SESSION_SECRET = 'atmg-local-session';

const signPayload = (payload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
};

const verifyToken = (token) => {
  const [encoded, signature] = token.split('.');

  if (!encoded || !signature) {
    return null;
  }

  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  if (signature !== expected) {
    return null;
  }

  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
};

export const issueSessionToken = ({ id, name }) =>
  signPayload({
    id,
    name,
    issuedAt: new Date().toISOString(),
  });

export const requireSession = (req) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new HttpError(401, 'Missing Bearer token');
  }

  const session = verifyToken(token);
  if (!session) {
    throw new HttpError(401, 'Invalid session token');
  }

  return session;
};
