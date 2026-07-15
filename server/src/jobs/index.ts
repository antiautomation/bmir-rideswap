import cron from 'node-cron';
import { pruneExpiredTokens } from '../auth/tokens.js';
import { runDigestTick } from './digests.js';

export function startJobs(): void {
  if (process.env.JOBS_DISABLED === '1') {
    console.log('jobs disabled via JOBS_DISABLED=1');
    return;
  }
  cron.schedule('* * * * *', () => {
    runDigestTick().catch((err) => console.error('digest tick failed', err));
  });
  cron.schedule('0 4 * * *', () => {
    pruneExpiredTokens().catch((err) => console.error('token prune failed', err));
  });
  console.log('jobs started: digest tick (1m), token prune (daily)');
}
