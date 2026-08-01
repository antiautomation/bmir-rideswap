import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Avatar from './Avatar';
import { ApiError } from '../api/client';
import { prepareImage, uploadErrorMessage, uploadImageBytes } from '../lib/image';
import type { Me } from '../api/types';

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

    const prepared = await prepareImage(file);
    if ('error' in prepared) {
      setError(prepared.error);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(prepared.file));
    setPendingFile(prepared.file);
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
      const res = await uploadImageBytes('/api/me/avatar', pendingFile);
      if (!res.ok) {
        setError(uploadErrorMessage(res.status));
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
