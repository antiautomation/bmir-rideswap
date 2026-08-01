import { useEffect, useState } from 'react';

interface MessagePhotoProps {
  messageId: string;
  /** Stored at upload time so the box can be reserved before the bytes land. */
  width: number | null;
  height: number | null;
}

type LightboxState = 'loading' | 'error' | 'ready';

/** A photo inside a message bubble, tap to enlarge.
 *
 *  The thumb is a plain <img> — it's cookie-authenticated and cacheable, so the
 *  browser and service worker handle it. The full size goes through a credentialed
 *  fetch into an object URL, the same shape as the avatar lightbox, because it can
 *  legitimately 403 and a bare <img> would just show a broken icon.
 *
 *  The aspect-ratio box is load-bearing, not cosmetic: the thread scrolls itself to
 *  the bottom whenever the message count changes, and an image that resolves after
 *  that scroll would shove the conversation out from under the reader. */
export default function MessagePhoto({ messageId, width, height }: MessagePhotoProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LightboxState>('loading');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let createdUrl: string | null = null;
    setState('loading');

    void (async () => {
      try {
        const res = await fetch(`/api/messages/${messageId}/photo`, { credentials: 'same-origin' });
        if (cancelled) return;
        if (!res.ok) {
          setState('error');
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, messageId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function handleClose(): void {
    setOpen(false);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
  }

  return (
    <>
      <button
        type="button"
        className="message-photo"
        style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
        aria-label="View photo"
        onClick={() => setOpen(true)}
      >
        <img src={`/api/messages/${messageId}/photo-thumb`} alt="" loading="lazy" />
      </button>

      {open && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          onClick={handleClose}
        >
          <div className="avatar-lightbox" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="icon-btn avatar-lightbox-close"
              aria-label="Close"
              onClick={handleClose}
            >
              ✕
            </button>

            {state === 'loading' && <p className="avatar-lightbox-status">Loading…</p>}
            {state === 'error' && <p className="avatar-lightbox-status">Couldn&rsquo;t load photo.</p>}
            {state === 'ready' && objectUrl && (
              <img className="avatar-lightbox-img" src={objectUrl} alt="" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
