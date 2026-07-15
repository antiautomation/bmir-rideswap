import { randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import type { SessionUser } from './tokens.js';

const ADJECTIVES = [
  'dusty', 'ember', 'neon', 'cosmic', 'sunny', 'windy', 'sparkly', 'shiny',
  'wild', 'happy', 'brave', 'gentle', 'mellow', 'groovy', 'electric', 'lucky',
  'sandy', 'starry', 'misty', 'blazing', 'dawn', 'dusk', 'golden', 'silver',
  'copper', 'rusty', 'velvet', 'crystal', 'radiant', 'roaming', 'drifting', 'dancing',
  'glowing', 'cozy', 'salty', 'peppy', 'zesty', 'funky', 'jolly', 'quirky',
  'sleepy', 'speedy', 'sturdy', 'tiny', 'giant', 'humble', 'noble', 'plucky',
  'rowdy', 'serene', 'smoky', 'snappy', 'spicy', 'swift', 'toasty', 'trusty',
  'vivid', 'wavy', 'whimsy', 'zen', 'amber', 'azure', 'coral', 'indigo',
  'jade', 'lilac', 'magenta', 'olive', 'pearl', 'ruby', 'scarlet', 'teal',
  'violet', 'blissful', 'bouncy', 'breezy', 'chill', 'daring', 'dreamy', 'eager',
  'fiery', 'fuzzy', 'giddy', 'hazy', 'jaunty', 'keen', 'lively', 'loyal',
  'magic', 'merry', 'nimble', 'perky', 'quiet', 'rugged', 'shaggy', 'silly',
  'sly', 'solar', 'lunar', 'stellar', 'thirsty', 'twinkly', 'vast', 'warm',
  'weird', 'witty', 'zippy', 'artsy', 'boho', 'candy', 'disco', 'echo',
  'feral', 'gonzo', 'hardy', 'ionic', 'jumbo', 'kindly', 'loopy', 'mystic',
  'nomad', 'opal', 'punky', 'quartz', 'retro', 'sonic', 'tidal', 'ultra',
] as const;

const NOUNS = [
  'camel', 'coyote', 'raven', 'falcon', 'lizard', 'jackal', 'bison', 'badger',
  'ferret', 'gecko', 'heron', 'ibis', 'jaguar', 'koala', 'lemur', 'marmot',
  'newt', 'otter', 'panda', 'quail', 'rabbit', 'skunk', 'toad', 'urchin',
  'vulture', 'walrus', 'yak', 'zebra', 'playa', 'dune', 'mirage', 'oasis',
  'tumbleweed', 'cactus', 'sage', 'mesa', 'canyon', 'arroyo', 'basin', 'ridge',
  'summit', 'valley', 'delta', 'lagoon', 'reef', 'comet', 'nebula', 'nova',
  'orbit', 'quasar', 'saturn', 'venus', 'meteor', 'aurora', 'eclipse', 'zenith',
  'bicycle', 'trailer', 'wagon', 'rover', 'scooter', 'zeppelin', 'glider', 'kayak',
  'lantern', 'compass', 'anchor', 'beacon', 'bell', 'candle', 'drum', 'flute',
  'banjo', 'fiddle', 'gong', 'harp', 'kazoo', 'maraca', 'sitar', 'ukulele',
  'goggle', 'bandana', 'parasol', 'poncho', 'sarong', 'tutu', 'visor', 'boots',
  'teapot', 'kettle', 'ladle', 'skillet', 'thermos', 'canteen', 'cooler', 'jug',
  'hammock', 'yurt', 'teepee', 'dome', 'awning', 'tarp', 'stake', 'rope',
  'flint', 'spark', 'torch', 'bonfire', 'flare', 'glowstick', 'prism', 'strobe',
  'whale', 'octopus', 'anglerfish', 'mantis', 'firefly', 'moth', 'beetle', 'cricket',
  'phoenix', 'dragon', 'griffin', 'sphinx', 'unicorn', 'yeti', 'kraken', 'wizard',
] as const;

export function generateRecoveryCode(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  const digits = randomInt(0, 10000).toString().padStart(4, '0');
  return `${adjective}-${noun}-${digits}`;
}

export function normalizeRecoveryCode(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_.]+/g, '-')
    .replace(/-+/g, '-');
}

export async function createAnonUser(): Promise<SessionUser> {
  // Retry on the vanishingly-unlikely recovery-code collision (unique constraint).
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const inserted = await db
        .insert(users)
        .values({ recoveryCode: generateRecoveryCode() })
        .returning();
      return inserted[0]!;
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  throw new Error('unreachable');
}

export async function findUserByRecoveryCode(code: string): Promise<SessionUser | null> {
  const normalized = normalizeRecoveryCode(code);
  if (!/^[a-z0-9]+-[a-z0-9]+-\d{4}$/.test(normalized)) return null;
  const rows = await db.select().from(users).where(eq(users.recoveryCode, normalized)).limit(1);
  return rows[0] ?? null;
}
