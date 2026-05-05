import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './db.js';
import { env } from './env.js';
import type { Role, User } from '@prisma/client';

const SESSION_COOKIE = 'ptw_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export async function hashPassword(p: string) {
  return argon2.hash(p, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, p: string) {
  try {
    return await argon2.verify(hash, p);
  } catch {
    return false;
  }
}

function newSessionId() {
  return randomBytes(32).toString('base64url');
}

export async function createSession(req: FastifyRequest, reply: FastifyReply, userId: string) {
  const id = newSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.session.create({
    data: {
      id,
      userId,
      expiresAt,
      userAgent: req.headers['user-agent']?.slice(0, 255) ?? null,
      ip: req.ip,
    },
  });
  reply.setCookie(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: env.PUBLIC_API_URL.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    domain: env.COOKIE_DOMAIN || undefined,
    expires: expiresAt,
  });
}

export async function destroySession(req: FastifyRequest, reply: FastifyReply) {
  const id = req.cookies[SESSION_COOKIE];
  if (id) await prisma.session.deleteMany({ where: { id } });
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function getCurrentUser(req: FastifyRequest): Promise<User | null> {
  const id = req.cookies[SESSION_COOKIE];
  if (!id) return null;
  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  if (!session.user.active) return null;
  return session.user;
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await getCurrentUser(req);
    if (!user) return reply.status(401).send({ error: 'unauthenticated' });
    if (!roles.includes(user.role)) return reply.status(403).send({ error: 'forbidden' });
    (req as FastifyRequest & { user: User }).user = user;
  };
}

export function requireAuth() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await getCurrentUser(req);
    if (!user) return reply.status(401).send({ error: 'unauthenticated' });
    (req as FastifyRequest & { user: User }).user = user;
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}
