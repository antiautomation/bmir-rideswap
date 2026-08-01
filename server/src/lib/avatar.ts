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

const PHOTO_SIZE = 1280;
const PHOTO_THUMB_SIZE = 320;

/** Message attachments. Shares processAvatar's decompression-bomb guard and its
 *  .rotate() call — which both bakes in EXIF orientation and, since sharp drops
 *  metadata unless asked to keep it, strips the GPS tags off a phone photo
 *  before it reaches anyone. The framing is the opposite of an avatar's, though:
 *  fit 'inside' and no mask, because a photo of a trailer full of gear must not
 *  be cropped to a circle. */
export async function processMessagePhoto(
  input: Buffer,
): Promise<{ full: Buffer; thumb: Buffer; width: number; height: number }> {
  const full = await sharp(input, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // Read the dimensions back off the output rather than the input: rotation may
  // have swapped them, and the client sizes its placeholder from these.
  const meta = await sharp(full).metadata();

  const thumb = await sharp(full)
    .resize(PHOTO_THUMB_SIZE, PHOTO_THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 65 })
    .toBuffer();

  return { full, thumb, width: meta.width ?? 0, height: meta.height ?? 0 };
}
