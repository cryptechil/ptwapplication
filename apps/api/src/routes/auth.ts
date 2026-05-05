import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import {
  createSession,
  destroySession,
  getCurrentUser,
  requireAuth,
  verifyPassword,
} from '../auth.js';
import { audit } from '../audit.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_input' });
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.active) {
      return reply.status(401).send({ error: 'invalid_credentials' });
    }
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      await audit(req, 'login_failed', 'user', user.id);
      return reply.status(401).send({ error: 'invalid_credentials' });
    }
    await createSession(req, reply, user.id);
    await audit(req, 'login', 'user', user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyName: user.companyName,
      },
    };
  });

  app.post('/auth/logout', { preHandler: requireAuth() }, async (req, reply) => {
    await audit(req, 'logout', 'user', req.user!.id);
    await destroySession(req, reply);
    return { ok: true };
  });

  app.get('/auth/me', async (req) => {
    const user = await getCurrentUser(req);
    if (!user) return { user: null };
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyName: user.companyName,
      },
    };
  });
}
