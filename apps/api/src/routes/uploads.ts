import type { FastifyInstance } from 'fastify';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { env } from '../env.js';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function uploadRoutes(app: FastifyInstance) {
  await fs.mkdir(env.UPLOAD_DIR, { recursive: true });

  app.post('/requests/:id/attachments', { preHandler: requireAuth() }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const u = req.user!;
    const r = await prisma.ptwRequest.findUnique({ where: { id } });
    if (!r) return reply.status(404).send({ error: 'not_found' });
    if (u.role !== 'admin' && r.createdById !== u.id) {
      return reply.status(403).send({ error: 'forbidden' });
    }
    const file = await req.file();
    if (!file) return reply.status(400).send({ error: 'no_file' });

    const stored = `${randomUUID()}-${file.filename.replace(/[^\w.\-]/g, '_')}`;
    const dest = path.join(env.UPLOAD_DIR, stored);
    let written = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      written += chunk.length;
      if (written > MAX_BYTES) {
        return reply.status(413).send({ error: 'too_large' });
      }
      chunks.push(chunk as Buffer);
    }
    await fs.writeFile(dest, Buffer.concat(chunks));

    const att = await prisma.attachment.create({
      data: {
        requestId: id,
        filename: file.filename,
        mimetype: file.mimetype,
        size: written,
        storagePath: stored,
      },
    });
    return reply.status(201).send({ attachment: att });
  });

  app.get('/attachments/:id', { preHandler: requireAuth() }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const u = req.user!;
    const att = await prisma.attachment.findUnique({
      where: { id },
      include: { request: true },
    });
    if (!att) return reply.status(404).send({ error: 'not_found' });
    if (u.role !== 'admin' && att.request.createdById !== u.id) {
      return reply.status(403).send({ error: 'forbidden' });
    }
    const filePath = path.join(env.UPLOAD_DIR, att.storagePath);
    return reply.type(att.mimetype).header('content-disposition', `attachment; filename="${att.filename}"`).send(await fs.readFile(filePath));
  });
}
