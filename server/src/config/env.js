const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: toNumber(process.env.PORT, 4000),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
};
