import { useEffect, useState } from 'react';

type ToastListener = (text: string) => void;
const listeners = new Set<ToastListener>();

/** Module-level: call from anywhere to show a transient toast. */
export function showToast(text: string): void {
  for (const fn of listeners) fn(text);
}

/** Mount once near the app root. Renders the most recent toast, if any. */
export default function ToastHost() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const listener: ToastListener = (t) => setText(t);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => setText(null), 3000);
    return () => clearTimeout(timer);
  }, [text]);

  if (!text) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      {text}
    </div>
  );
}
