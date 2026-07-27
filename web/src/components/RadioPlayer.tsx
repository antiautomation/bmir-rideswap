import { useEffect, useRef, useState } from 'react';

import '../styles/radio.css';

/** BMIR 94.5 FM source stream (same URL bmir.org's own player uses). Serves
 *  audio only while the station is on air; returns 503 otherwise. */
const STREAM_URL = 'https://stream.revma.ihrhls.com/zc8378';

/** How often to re-check whether the station is on air. */
const PROBE_INTERVAL_OFFAIR_MS = 60_000;
const PROBE_INTERVAL_ONAIR_MS = 5 * 60_000;
/** Give a live-but-slow stream this long to produce playable audio. */
const PROBE_TIMEOUT_MS = 15_000;

/** Resolves true when the stream is currently serving playable audio.
 *  Uses an Audio element rather than fetch() so the check is not subject to
 *  the stream host's CORS policy. The element is discarded either way. */
function probeStream(): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = new Audio();
    let timer = 0;
    const done = (live: boolean) => {
      window.clearTimeout(timer);
      probe.removeAttribute('src');
      probe.load(); // abort any in-flight buffering
      resolve(live);
    };
    probe.addEventListener('canplay', () => done(true), { once: true });
    probe.addEventListener('error', () => done(false), { once: true });
    timer = window.setTimeout(() => done(false), PROBE_TIMEOUT_MS);
    probe.preload = 'auto';
    probe.src = STREAM_URL;
    probe.load();
  });
}

/** Floating BMIR bubble. Hidden unless the station is live; tap to stream. */
export default function RadioPlayer() {
  const [live, setLive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute('src');
      a.load();
      audioRef.current = null;
    }
    setPlaying(false);
  };

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function check() {
      // While audio is playing, its own error handler governs visibility —
      // don't open a second connection to the stream.
      if (!audioRef.current) {
        const ok = await probeStream();
        if (cancelled) return;
        setLive(ok);
        if (!ok) stop();
      }
      timer = window.setTimeout(
        check,
        audioRef.current ? PROBE_INTERVAL_ONAIR_MS : PROBE_INTERVAL_OFFAIR_MS,
      );
    }
    check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stop();
    };
  }, []);

  if (!live) return null;

  const toggle = () => {
    if (audioRef.current) {
      stop();
      return;
    }
    const a = new Audio(STREAM_URL);
    audioRef.current = a;
    const drop = () => {
      // Stream died mid-listen: stop and hide until the next probe succeeds.
      stop();
      setLive(false);
    };
    a.addEventListener('error', drop);
    a.addEventListener('stalled', drop);
    a.play().then(
      () => setPlaying(true),
      () => drop(),
    );
  };

  return (
    <button
      type="button"
      className={`radio-bubble${playing ? ' radio-bubble--playing' : ''}`}
      onClick={toggle}
      aria-label={playing ? 'Stop BMIR 94.5 FM stream' : 'Play BMIR 94.5 FM live stream'}
      title={playing ? 'BMIR 94.5 FM — tap to stop' : 'BMIR 94.5 FM is live — tap to listen'}
    >
      <img src="/bmir-logo.png" alt="" draggable={false} />
    </button>
  );
}
