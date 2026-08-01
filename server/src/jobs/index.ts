import cron from 'node-cron';
import { pruneExpiredTokens } from '../auth/tokens.js';
import { pruneDeadMatches } from '../matching/score.js';
import { sweepOrphanPhotos } from '../routes/messagePhoto.js';
import { runCampaignTick } from './campaigns.js';
import { runDigestTick } from './digests.js';

export function startJobs(): void {
  if (process.env.JOBS_DISABLED === '1') {
    console.log('jobs disabled via JOBS_DISABLED=1');
    return;
  }
  cron.schedule('* * * * *', () => {
    runDigestTick().catch((err) => console.error('digest tick failed', err));
  });
  cron.schedule('* * * * *', () => {
    runCampaignTick().catch((err) => console.error('campaign tick failed', err));
  });
  cron.schedule('0 4 * * *', () => {
    pruneExpiredTokens().catch((err) => console.error('token prune failed', err));
    pruneDeadMatches().catch((err) => console.error('match prune failed', err));
    sweepOrphanPhotos().catch((err) => console.error('orphan photo sweep failed', err));
  });
  console.log('jobs started: digest tick (1m), campaign tick (1m), token prune (daily)');
}
