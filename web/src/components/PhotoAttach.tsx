import { useRef, useState } from 'react';
import { prepareImage, uploadErrorMessage, uploadImageBytes } from '../lib/image';

export interface AttachedPhoto {
  photoId: string;
  width: number;
  height: number;
  /** Local object URL, so the composer previews the file the user picked rather
   *  than round-tripping the processed copy back down. Revoked on clear. */
  previewUrl: string;
}

interface PhotoAttachProps {
  photo: AttachedPhoto | null;
  onChange: (photo: AttachedPhoto | null) => void;
  /** Sending is blocked while this is true; the parent disables its submit. */
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
}

/** Camera + file pickers for a message attachment.
 *
 *  Two inputs rather than one: `accept="image/*"` alone only makes the mobile OS
 *  *offer* "Take Photo" inside its sheet, while `capture="environment"` opens the
 *  camera directly. Desktop browsers ignore `capture` and fall back to a file
 *  picker, so the pair degrades cleanly.
 *
 *  The upload happens here, at pick time, not at send time. The offline outbox
 *  that carries messages is JSON in localStorage and cannot hold bytes, so the
 *  photo goes up first and the queued message references it by id — which is
 *  also why attaching needs a connection even though sending text does not. */
export default function PhotoAttach({
  photo,
  onChange,
  onUploadingChange,
  disabled = false,
}: PhotoAttachProps) {
  const importRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setBusy(value: boolean): void {
    setUploading(value);
    onUploadingChange?.(value);
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const picked = e.target.files?.[0];
    // Cleared immediately so picking the same file twice still fires `change`.
    e.target.value = '';
    if (!picked) return;

    setError(null);
    const prepared = await prepareImage(picked);
    if ('error' in prepared) {
      setError(prepared.error);
      return;
    }

    setBusy(true);
    try {
      const res = await uploadImageBytes('/api/messages/photo', prepared.file);
      if (!res.ok) {
        setError(uploadErrorMessage(res.status));
        return;
      }
      const data = (await res.json()) as { photoId: string; width: number; height: number };
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      onChange({ ...data, previewUrl: URL.createObjectURL(prepared.file) });
    } catch {
      setError('Upload failed — check your connection and try again');
    } finally {
      setBusy(false);
    }
  }

  function handleClear(): void {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    onChange(null);
    setError(null);
  }

  return (
    <div className="photo-attach">
      <input
        ref={importRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        onChange={(e) => void handlePick(e)}
        aria-label="Choose a photo"
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={(e) => void handlePick(e)}
        aria-label="Take a photo"
      />

      {photo ? (
        <div className="photo-attach-preview">
          <img src={photo.previewUrl} alt="" />
          <button type="button" className="icon-btn" aria-label="Remove photo" onClick={handleClear}>
            ✕
          </button>
        </div>
      ) : (
        <div className="photo-attach-actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={disabled || uploading}
            onClick={() => cameraRef.current?.click()}
          >
            📷 Photo
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={disabled || uploading}
            onClick={() => importRef.current?.click()}
          >
            📎 Attach
          </button>
          {uploading && <span className="field-hint">Uploading…</span>}
          {disabled && !uploading && <span className="field-hint">Photos need a connection</span>}
        </div>
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
