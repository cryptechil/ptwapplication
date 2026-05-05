import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './env.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { requestRoutes } from './routes/requests.js';
import { schemaRoutes } from './routes/schema.js';
import { uploadRoutes } from './routes/uploads.js';
import { ensureSeedAdmin } from './seed.js';

const app = Fastify({ logger: { level: 'info' } });

await app.register(cookie, { secret: env.SESSION_SECRET });
await app.register(cors, {
  origin: env.PUBLIC_WEB_URL,
  credentials: true,
});
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

app.get('/health', async () => ({ ok: true }));

await app.register(authRoutes);
await app.register(userRoutes);
await app.register(requestRoutes);
await app.register(schemaRoutes);
await app.register(uploadRoutes);

await ensureSeedAdmin();

app.listen({ port: env.API_PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`PTW API listening on :${env.API_PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
