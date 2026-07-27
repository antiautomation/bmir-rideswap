import { useEffect, useState } from 'react';

interface AvatarProps {
  thumbSrc: string;
  fullSrc?: string;
  name: string;
  size?: number;
  /** Shown under the full-size image in the lightbox. */
  lightboxNote?: string;
}

type LightboxState = 'loading' | 'locked' | 'error' | 'ready';

export default function Avatar({ thumbSrc, fullSrc, name, size = 40, lightboxNote }: AvatarProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LightboxState>('loading');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !fullSrc) return;

    let cancelled = false;
    let createdUrl: string | null = null;
    setState('loading');

    void (async () => {
      try {
        const res = await fetch(fullSrc, { credentials: 'same-origin' });
        if (cancelled) return;
        if (res.status === 403) {
          setState('locked');
          return;
        }
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
  }, [open, fullSrc]);

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

  const img = (
    <img
      className="avatar"
      src={thumbSrc}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size }}
    />
  );

  return (
    <>
      {fullSrc ? (
        <button
          type="button"
          className="avatar-btn"
          style={{ width: size, height: size }}
          aria-label={`View ${name}'s photo`}
          onClick={() => setOpen(true)}
        >
          {img}
        </button>
      ) : (
        img
      )}

      {open && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${name}'s photo`}
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

            {state === 'locked' && (
              <div className="avatar-lock">
                <span aria-hidden="true">🔒</span>
                <p>{name}&rsquo;s full photo unlocks once they message you.</p>
                <p className="field-hint">
                  Full-size photos are only visible after a real exchange — that&rsquo;s on
                  purpose.
                </p>
              </div>
            )}

            {state === 'error' && <p className="avatar-lightbox-status">Couldn&rsquo;t load photo.</p>}

            {state === 'ready' && objectUrl && (
              <>
                <img className="avatar-lightbox-img" src={objectUrl} alt="" />
                {lightboxNote && <p className="field-hint">{lightboxNote}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
