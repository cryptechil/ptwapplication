import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { audit } from '../audit.js';
import { submitQueue } from '../queue.js';
import { payloadSchema, SCHEMA_VERSION } from '@ptw/shared';

const createSchema = z.object({
  payload: z.record(z.unknown()),
});

export async function requestRoutes(app: FastifyInstance) {
  /** List requests visible to the current user. */
  app.get('/requests', { preHandler: requireAuth() }, async (req) => {
    const u = req.user!;
    const where = u.role === 'admin' ? {} : { createdById: u.id };
    const items = await prisma.ptwRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        internalNumber: true,
        status: true,
        createdAt: true,
        submittedAt: true,
        approvedAt: true,
        tevelApprovalNumber: true,
        tevelApprovalTitle: true,
        tevelApprovalLink: true,
        failureReason: true,
        createdBy: { select: { id: true, name: true, companyName: true } },
      },
    });
    return { items };
  });

  app.get('/requests/:id', { preHandler: requireAuth() }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const u = req.user!;
    const r = await prisma.ptwRequest.findUnique({
      where: { id },
      include: {
        attachments: true,
        attempts: { orderBy: { startedAt: 'desc' } },
        createdBy: { select: { id: true, name: true, email: true, companyName: true } },
      },
    });
    if (!r) return reply.status(404).send({ error: 'not_found' });
    if (u.role !== 'admin' && r.createdById !== u.id) {
      return reply.status(403).send({ error: 'forbidden' });
    }
    return { request: r };
  });

  /** Create a draft. */
  app.post('/requests', { preHandler: requireAuth() }, async (req, reply) => {
    const u = req.user!;
    if (u.role === 'guest') return reply.status(403).send({ error: 'forbidden' });
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_input' });

    const validated = payloadSchema.partial().safeParse(parsed.data.payload);
    if (!validated.success) {
      return reply.status(400).send({ error: 'payload_invalid', details: validated.error.flatten() });
    }

    const r = await prisma.ptwRequest.create({
      data: {
        createdById: u.id,
        status: 'draft',
        schemaVersion: SCHEMA_VERSION,
        payload: validated.data as never,
      },
    });
    await audit(req, 'request_created', 'request', r.id);
    return reply.status(201).send({ request: r });
  });

  app.patch('/requests/:id', { preHandler: requireAuth() }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const u = req.user!;
    const existing = await prisma.ptwRequest.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'not_found' });
    if (u.role !== 'admin' && existing.createdById !== u.id) {
      return reply.status(403).send({ error: 'forbidden' });
    }
    if (existing.status !== 'draft' && existing.status !== 'failed' && existing.status !== 'schema_mismatch') {
      return reply.status(409).send({ error: 'not_editable' });
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid_input' });
    const validated = payloadSchema.partial().safeParse(parsed.data.payload);
    if (!validated.success) return reply.status(400).send({ error: 'payload_invalid', details: validated.error.flatten() });
    const r = await prisma.ptwRequest.update({
      where: { id },
      data: { payload: validated.data as never, schemaVersion: SCHEMA_VERSION },
    });
    await audit(req, 'request_updated', 'request', r.id);
    return { request: r };
  });

  /** Submit a draft to Tevel via the submitter worker. */
  app.post('/requests/:id/submit', { preHandler: requireAuth() }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const u = req.user!;
    const r = await prisma.ptwRequest.findUnique({ where: { id } });
    if (!r) return reply.status(404).send({ error: 'not_found' });
    if (u.role !== 'admin' && r.createdById !== u.id) {
      return reply.status(403).send({ error: 'forbidden' });
    }
    if (!['draft', 'failed', 'schema_mismatch'].includes(r.status)) {
      return reply.status(409).send({ error: 'not_submittable' });
    }
    // Full validation (all required fields).
    const validated = payloadSchema.safeParse(r.payload);
    if (!validated.success) {
      return reply.status(400).send({ error: 'payload_invalid', details: validated.error.flatten() });
    }
    // Schema-guard check: latest approved snapshot must match current code hash.
    const latest = await prisma.formSchemaSnapshot.findFirst({
      where: { approvedAt: { not: null } },
      orderBy: { capturedAt: 'desc' },
    });
    if (latest && latest.hash !== SCHEMA_VERSION) {
      await prisma.ptwRequest.update({
        where: { id },
        data: { status: 'schema_mismatch', failureReason: 'Tevel form schema changed; admin must re-approve.' },
      });
      return reply.status(409).send({ error: 'schema_mismatch' });
    }

    await prisma.ptwRequest.update({
      where: { id },
      data: { status: 'queued', failureReason: null, schemaVersion: SCHEMA_VERSION },
    });
    await submitQueue.add('submit', { requestId: r.id }, { removeOnComplete: 100, removeOnFail: 100 });
    await audit(req, 'request_submitted', 'request', r.id);
    return { ok: true };
  });

  /** Create a guest share link. */
  app.post('/requests/:id/shares', { preHandler: requireAuth() }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const u = req.user!;
    const r = await prisma.ptwRequest.findUnique({ where: { id } });
    if (!r) return reply.status(404).send({ error: 'not_found' });
    if (u.role !== 'admin' && r.createdById !== u.id) {
      return reply.status(403).send({ error: 'forbidden' });
    }
    const token = randomBytes(24).toString('base64url');
    const share = await prisma.requestShare.create({
      data: { requestId: id, token, createdById: u.id },
    });
    await audit(req, 'share_created', 'share', share.id, { requestId: id });
    return { share: { id: share.id, token, url: `/share/${token}` } };
  });

  app.delete('/requests/:id/shares/:shareId', { preHandler: requireAuth() }, async (req, reply) => {
    const { id, shareId } = req.params as { id: string; shareId: string };
    const u = req.user!;
    const r = await prisma.ptwRequest.findUnique({ where: { id } });
    if (!r) return reply.status(404).send({ error: 'not_found' });
    if (u.role !== 'admin' && r.createdById !== u.id) {
      return reply.status(403).send({ error: 'forbidden' });
    }
    await prisma.requestShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  });

  /** Public read-only endpoint for guest share tokens (no auth). */
  app.get('/shares/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const share = await prisma.requestShare.findUnique({
      where: { token },
      include: {
        request: {
          include: {
            createdBy: { select: { name: true, companyName: true } },
          },
        },
      },
    });
    if (!share || share.revokedAt) return reply.status(404).send({ error: 'not_found' });
    if (share.expiresAt && share.expiresAt < new Date()) {
      return reply.status(410).send({ error: 'expired' });
    }
    const r = share.request;
    return {
      request: {
        id: r.id,
        internalNumber: r.internalNumber,
        status: r.status,
        createdAt: r.createdAt,
        submittedAt: r.submittedAt,
        approvedAt: r.approvedAt,
        tevelApprovalNumber: r.tevelApprovalNumber,
        tevelApprovalTitle: r.tevelApprovalTitle,
        tevelApprovalLink: r.tevelApprovalLink,
        payload: r.payload,
        createdBy: r.createdBy,
      },
    };
  });
}
