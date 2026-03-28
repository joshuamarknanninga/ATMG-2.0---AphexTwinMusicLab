import crypto from 'node:crypto';

import { issueSessionToken } from '../middleware/auth.js';
import { userModel } from '../models/User.js';
import { asString, ensureObject } from '../utils/validate.js';

export const createGuestSession = (body) => {
  const payload = ensureObject(body);
  const name = asString(payload.name, 'name', { min: 2, max: 32, fallback: 'Guest Producer' });

  const user = userModel.save({
    id: crypto.randomUUID(),
    name,
    role: 'guest',
    createdAt: new Date().toISOString(),
  });

  return {
    user,
    token: issueSessionToken(user),
  };
};
