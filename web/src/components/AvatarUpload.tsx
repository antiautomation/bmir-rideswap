import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Avatar from './Avatar';
import { ApiError } from '../api/client';
import type { Me } from '../api/types';

const MAX_BYTES = 10 * 1024 * 1024;

/* The server (sharp) reads JPEG/PNG/WebP/GIF/TIFF/AVIF but not HEIC (its
   prebuilt libvips omits libheif). Safari on Apple hardware CAN decode HEIC,
   and Apple devices are where HEICs come from — so convert in the browser:
   decode → canvas (capped at 2048px; the server only needs 512) → JPEG. */
function isHeic(file: File): boolean {
  return /image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

async function heicToJpeg(file: File): Promise<File | null> {
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

interface AvatarUploadProps {
  me: Me | null;
}

async function invalidateAvatarQueries(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['me'] }),
    queryClient.invalidateQueries({ queryKey: ['listings'] }),
    queryClient.invalidateQueries({ queryKey: ['my-listings'] }),
  ]);
}

export default function AvatarUpload({ me }: AvatarUploadProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  function handleChoose(): void {
    fileInputRef.current?.click();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    let file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploaded(false);

    if (file.size > MAX_BYTES) {
      setError('That image is over 10 MB — pick a smaller one');
      return;
    }

    if (isHeic(file)) {
      const converted = await heicToJpeg(file);
      if (!converted) {
        setError("This browser can't read HEIC photos — export it as JPG or PNG and try again");
        return;
      }
      file = converted;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
  }

  function handleCancel(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    setError(null);
  }

  async function handleUpload(): Promise<void> {
    if (!pendingFile) return;
    setUploading(true);
    setError(null);
    try {
      /* Raw bytes, not FormData: Safari corrupts multipart bodies sent from
         service-worker-controlled pages (empty/mismatched boundary at the server). */
      const res = await fetch('/api/me/avatar', {
        method: 'POST',
        body: pendingFile,
        headers: { 'Content-Type': pendingFile.type || 'application/octet-stream' },
        credentials: 'same-origin',
      });
      if (!res.ok) {
        if (res.status === 400) {
          setError("That file doesn't look like an image");
        } else if (res.status === 413) {
          setError('That image is over 10 MB — pick a smaller one');
        } else {
          setError('Upload failed — try again');
        }
        return;
      }
      setPendingFile(null);
      setUploaded(true);
      // Drop the local blob preview so the uploaded-state branch (with the
      // tap-to-preview lightbox) renders instead of the stale pre-upload image.
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      await invalidateAvatarQueries(queryClient);
    } catch {
      setError('Upload failed — try again');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(): Promise<void> {
    if (!window.confirm('Remove your profile photo?')) return;
    setRemoving(true);
    try {
      await fetch('/api/me/avatar', { method: 'DELETE', credentials: 'same-origin' });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPendingFile(null);
      setUploaded(false);
      await invalidateAvatarQueries(queryClient);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        /* best-effort; nothing else to do here */
      }
    } finally {
      setRemoving(false);
    }
  }

  const hasPhoto = Boolean(me?.avatarVersion) || uploaded;

  return (
    <div className="avatar-upload">
      <p className="field-hint">
        Optional. Others see a small blurred thumbnail next to your listings; your full photo is
        revealed to someone only after you message them.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        onChange={(e) => void handleFileSelect(e)}
        aria-label="Choose a profile photo"
      />

      {pendingFile && previewUrl ? (
        <div className="avatar-upload-preview-row">
          <img className="avatar-preview" src={previewUrl} alt="Preview" />
          <p className="field-hint">
            📸 Center your face — we crop to a circle from the middle of the photo. This preview
            shows roughly how it will look.
          </p>
          {error && <p className="form-note form-note--error">{error}</p>}
          <div className="avatar-upload-actions">
            <button type="button" className="btn" onClick={() => void handleUpload()} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload photo'}
            </button>
            <button type="button" className="btn-ghost" onClick={handleCancel} disabled={uploading}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {previewUrl ? (
            <img className="avatar-preview" src={previewUrl} alt="Your profile photo" />
          ) : hasPhoto ? (
            <div className="avatar-upload-current">
              <Avatar
                thumbSrc={`/api/me/avatar-thumb?v=${me?.avatarVersion ?? 'new'}`}
                fullSrc={`/api/me/avatar-full?v=${me?.avatarVersion ?? 'new'}`}
                name="Your"
                size={48}
                lightboxNote="This full-size view is what someone sees once you've messaged them. Everyone else only ever sees the small blurred thumbnail."
              />
              <p className="field-hint">Photo uploaded ✓ — tap the thumbnail to preview what a match sees.</p>
            </div>
          ) : null}

          {error && <p className="form-note form-note--error">{error}</p>}

          <div className="avatar-upload-actions">
            <button type="button" className="btn-secondary" onClick={handleChoose} disabled={!me}>
              Choose photo
            </button>
            {hasPhoto && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => void handleRemove()}
                disabled={removing}
              >
                {removing ? 'Removing…' : 'Remove photo'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
