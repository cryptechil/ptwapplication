import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireRole, requireAuth } from '../auth.js';
import { audit } from '../audit.js';
import { schemaSnapshotQueue } from '../queue.js';
import { tevelFormSchema, SCHEMA_VERSION } from '@ptw/shared';

export async function schemaRoutes(app: FastifyInstance) {
  /** Schema as known by the running code (used by the React form generator). */
  app.get('/schema', { preHandler: requireAuth() }, async () => {
    return { version: SCHEMA_VERSION, fields: tevelFormSchema };
  });

  /** Status of the schema guard. */
  app.get('/schema/status', { preHandler: requireAuth() }, async () => {
    const latest = await prisma.formSchemaSnapshot.findFirst({
      orderBy: { capturedAt: 'desc' },
    });
    const latestApproved = await prisma.formSchemaSnapshot.findFirst({
      where: { approvedAt: { not: null } },
      orderBy: { capturedAt: 'desc' },
    });
    return {
      codeVersion: SCHEMA_VERSION,
      latest,
      latestApproved,
      inSync:
        latestApproved?.hash === SCHEMA_VERSION &&
        (!latest || latest.hash === SCHEMA_VERSION),
    };
  });

  /** Trigger a snapshot job (admin only). */
  app.post('/schema/snapshot', { preHandler: requireRole('admin') }, async (req) => {
    const job = await schemaSnapshotQueue.add('snapshot', {}, { removeOnComplete: 50 });
    await audit(req, 'schema_snapshot_triggered', 'schema_snapshot', String(job.id));
    return { jobId: job.id };
  });

  /** Approve a snapshot — admin confirms current state matches the code. */
  app.post('/schema/snapshots/:id/approve', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const snap = await prisma.formSchemaSnapshot.findUnique({ where: { id } });
    if (!snap) return reply.status(404).send({ error: 'not_found' });
    await prisma.formSchemaSnapshot.update({
      where: { id },
      data: { approvedById: req.user!.id, approvedAt: new Date() },
    });
    await audit(req, 'schema_snapshot_approved', 'schema_snapshot', id);
    return { ok: true };
  });
}
