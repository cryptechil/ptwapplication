import { Worker } from 'bullmq';
import { redis, schemaSnapshotQueue } from '../queue.js';
import { runSubmit } from './submitter.js';
import { runSnapshot } from './snapshot.js';

const submitWorker = new Worker(
  'ptw-submit',
  async (job) => {
    const { requestId } = job.data as { requestId: string };
    return runSubmit(requestId);
  },
  { connection: redis, concurrency: 1 },
);

const snapshotWorker = new Worker(
  'schema-snapshot',
  async () => runSnapshot(),
  { connection: redis, concurrency: 1 },
);

submitWorker.on('failed', (job, err) => {
  console.error(`[submit] job ${job?.id} failed:`, err);
});
snapshotWorker.on('failed', (job, err) => {
  console.error(`[snapshot] job ${job?.id} failed:`, err);
});

// Daily schema snapshot at 04:30 server time.
await schemaSnapshotQueue.add(
  'daily-snapshot',
  {},
  {
    repeat: { pattern: '30 4 * * *' },
    removeOnComplete: 50,
    removeOnFail: 50,
    jobId: 'daily-snapshot',
  },
);

console.log('PTW workers started (ptw-submit, schema-snapshot); daily snapshot scheduled');
