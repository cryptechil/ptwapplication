import type { FastifyRequest } from 'fastify';
import { prisma } from './db.js';

export async function audit(
  req: FastifyRequest | null,
  action: string,
  entity: string,
  entityId?: string,
  payload?: unknown,
) {
  await prisma.auditLog.create({
    data: {
      userId: req?.user?.id ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      payload: (payload ?? null) as never,
      ip: req?.ip ?? null,
    },
  });
}
