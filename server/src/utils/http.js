export const sendJson = (res, status, payload, origin = '*') => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
};

export const ok = (res, data, status = 200, origin = '*') =>
  sendJson(res, status, { ok: true, data }, origin);

export const fail = (res, status, error, details, origin = '*') =>
  sendJson(res, status, {
    ok: false,
    error,
    ...(details ? { details } : {}),
  }, origin);

export const readJsonBody = async (req) => {
  let body = '';

  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new Error('Payload too large');
    }
  }

  if (!body) {
    return {};
  }

  return JSON.parse(body);
};
