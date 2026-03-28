import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';

const bootstrap = async () => {
  await connectDb();
  const server = createApp();

  server.listen(env.PORT, () => {
    console.log(`ATMG 2.0 music engine listening on http://localhost:${env.PORT}`);
  });
};

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
