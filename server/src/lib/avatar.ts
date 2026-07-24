import sharp from 'sharp';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const FULL_SIZE = 512;
const THUMB_SIZE = 64;

function circleMask(size: number): Buffer {
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );
}

/** Processes an uploaded image into the two stored derivatives. The original is
 *  never persisted. The thumb is re-derived at genuinely low resolution plus a
 *  mild blur, so it cannot be "enhanced" back toward the full image. */
export async function processAvatar(input: Buffer): Promise<{ full: Buffer; thumb: Buffer }> {
  // .rotate() applies EXIF orientation; center-cover crop puts the middle of
  // the photo (where we tell users to put their face) inside the circle.
  const square = sharp(input, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize(FULL_SIZE, FULL_SIZE, { fit: 'cover', position: 'centre' });

  const full = await square
    .composite([{ input: circleMask(FULL_SIZE), blend: 'dest-in' }])
    .webp({ quality: 82 })
    .toBuffer();

  const thumb = await sharp(full)
    .resize(THUMB_SIZE, THUMB_SIZE)
    .blur(1)
    .composite([{ input: circleMask(THUMB_SIZE), blend: 'dest-in' }])
    .webp({ quality: 70 })
    .toBuffer();

  return { full, thumb };
}
