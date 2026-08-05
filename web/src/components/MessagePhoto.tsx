import { useEffect, useRef, useState } from 'react';
import { useConnectivity } from '../offline/connectivity';

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
 *  Offline is a first-class state here, not an error path: the PWA's whole job on
 *  playa is re-reading conversations, and both photo routes are CacheFirst in the
 *  service worker — whatever rendered (thumb) or was opened (full size) while
 *  online serves from cache with no signal. What was never fetched can't be
 *  conjured, so a failed thumb collapses into a labelled placeholder instead of a
 *  broken-image glyph, and it retries by itself when connectivity returns.
 *
 *  The aspect-ratio box is load-bearing, not cosmetic: the thread scrolls itself to
 *  the bottom whenever the message count changes, and an image that resolves after
 *  that scroll would shove the conversation out from under the reader. */
export default function MessagePhoto({ messageId, width, height }: MessagePhotoProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LightboxState>('loading');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  // Bumping this remounts the <img>, which is the only reliable way to make it
  // re-attempt a src that already failed once.
  const [thumbAttempt, setThumbAttempt] = useState(0);
  const { status: connectivity } = useConnectivity();

  // Retry only on the offline→online TRANSITION. Retrying whenever
  // "online && failed" would loop forever on a thumb that fails while online —
  // each retry fails, re-arms the condition, and hammers the endpoint.
  const prevConnectivity = useRef(connectivity);
  useEffect(() => {
    const was = prevConnectivity.current;
    prevConnectivity.current = connectivity;
    if (was === 'offline' && connectivity === 'online' && thumbFailed) {
      setThumbFailed(false);
      setThumbAttempt((n) => n + 1);
    }
  }, [connectivity, thumbFailed]);

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

  const box = width && height ? { aspectRatio: `${width} / ${height}` } : undefined;

  if (thumbFailed) {
    return (
      <div className="message-photo message-photo--missing" style={box}>
        <span aria-hidden="true">📷</span>
        <span className="message-photo-missing-note">
          {connectivity === 'offline'
            ? 'Photo not saved for offline — it loads next time you have signal'
            : 'Photo failed to load'}
        </span>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="message-photo" style={box} aria-label="View photo" onClick={() => setOpen(true)}>
        <img
          key={thumbAttempt}
          src={`/api/messages/${messageId}/photo-thumb`}
          alt=""
          loading="lazy"
          onError={() => setThumbFailed(true)}
        />
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
            {state === 'error' && (
              <p className="avatar-lightbox-status">
                {connectivity === 'offline'
                  ? 'You’re offline — full size is only saved for photos you’ve opened before.'
                  : 'Couldn’t load photo.'}
              </p>
            )}
            {state === 'ready' && objectUrl && (
              <img className="avatar-lightbox-img" src={objectUrl} alt="" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
