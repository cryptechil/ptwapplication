import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const submitQueue = new Queue('ptw-submit', { connection: redis });
export const schemaSnapshotQueue = new Queue('schema-snapshot', { connection: redis });

export type SubmitJobData = { requestId: string };
