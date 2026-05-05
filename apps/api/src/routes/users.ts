import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { hashPassword, requireRole } from '../auth.js';
import { audit } from '../audit.js';

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['admin', 'subcontractor', 'guest']),
  companyName: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'subcontractor', 'guest']).optional(),
  companyName: z.string().nullable().optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export async function userRoutes(app: FastifyInstance) {
  app.get('/users', { preHandler: requireRole('admin') }, async () => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyName: true,
        active: true,
        createdAt: true,
      },
    });
    return { users };
  });

  app.post('/users', { preHandler: requireRole('admin') }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_input', details: parsed.error.flatten() });
    const data = parsed.data;
    const exists = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (exists) return reply.status(409).send({ error: 'email_taken' });
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: await hashPassword(data.password),
        name: data.name,
        role: data.role,
        companyName: data.companyName ?? null,
      },
    });
    await audit(req, 'user_created', 'user', user.id, { role: user.role });
    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyName: user.companyName,
        active: user.active,
      },
    });
  });

  app.patch('/users/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_input' });
    const { password, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (password) data.passwordHash = await hashPassword(password);
    const user = await prisma.user.update({ where: { id }, data });
    await audit(req, 'user_updated', 'user', user.id, rest);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyName: user.companyName,
        active: user.active,
      },
    };
  });
}
