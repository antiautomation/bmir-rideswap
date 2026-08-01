/* Picking an image off a device, shared by the profile photo and message
   attachments. Both need the same two things: a size ceiling, and a way to cope
   with the format iPhones actually produce. */

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Matches the server's 413. */
export const TOO_LARGE_MESSAGE = 'That image is over 10 MB — pick a smaller one';
export const HEIC_FAILED_MESSAGE =
  "This browser can't read HEIC photos — export it as JPG or PNG and try again";

/* The server (sharp) reads JPEG/PNG/WebP/GIF/TIFF/AVIF but not HEIC (its
   prebuilt libvips omits libheif). Safari on Apple hardware CAN decode HEIC,
   and Apple devices are where HEICs come from — so convert in the browser:
   decode → canvas (capped at 2048px; the server downscales further anyway) → JPEG. */
export function isHeic(file: File): boolean {
  return /image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export async function heicToJpeg(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!blob) return null;
    return new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Size-checks and HEIC-converts a freshly picked file. Returns the error copy
 *  to show instead of a file when it can't be used. */
export async function prepareImage(file: File): Promise<{ file: File } | { error: string }> {
  if (file.size > MAX_IMAGE_BYTES) return { error: TOO_LARGE_MESSAGE };
  if (!isHeic(file)) return { file };
  const converted = await heicToJpeg(file);
  return converted ? { file: converted } : { error: HEIC_FAILED_MESSAGE };
}

/** Raw bytes as the request body — NOT FormData. Safari corrupts multipart
 *  bodies sent from a service-worker-controlled page (empty or mismatched
 *  boundary at the server), and this app is one. Both image uploads in the app
 *  go through this. */
export async function uploadImageBytes(path: string, file: File): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    credentials: 'same-origin',
  });
}

/** Shared mapping for the upload endpoints' failure codes. */
export function uploadErrorMessage(status: number): string {
  if (status === 400) return "That file doesn't look like an image";
  if (status === 413) return TOO_LARGE_MESSAGE;
  if (status === 429) return 'Too many photos for now — give it a few minutes';
  return 'Upload failed — try again';
}
