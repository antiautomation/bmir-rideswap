import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const VISITS_KEY = 'ridefinder-visits-v1';
const DISMISSED_KEY = 'ridefinder-install-dismissed-v1';
const SESSION_COUNTED_KEY = 'ridefinder-visit-counted-v1';

function getVisitCount(): number {
  if (!sessionStorage.getItem(SESSION_COUNTED_KEY)) {
    sessionStorage.setItem(SESSION_COUNTED_KEY, '1');
    const current = Number(localStorage.getItem(VISITS_KEY) ?? '0') + 1;
    localStorage.setItem(VISITS_KEY, String(current));
    return current;
  }
  return Number(localStorage.getItem(VISITS_KEY) ?? '0');
}

function isDismissed(): boolean {
  return localStorage.getItem(DISMISSED_KEY) === '1';
}

function dismiss(): void {
  localStorage.setItem(DISMISSED_KEY, '1');
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return standalone === false && /iphone|ipad/i.test(ua);
}

export default function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosVariant, setIosVariant] = useState(false);

  useEffect(() => {
    const visits = getVisitCount();
    const eligible = visits >= 2 && !isDismissed();

    if (isIosSafari()) {
      setIosVariant(true);
      setVisible(eligible);
      return;
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
      if (eligible) setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    dismiss();
    setVisible(false);
  };

  const handleInstall = () => {
    if (!deferredEvent) return;
    void deferredEvent.prompt().then(() => {
      setVisible(false);
      setDeferredEvent(null);
    });
  };

  return (
    <div className="install-prompt" role="region" aria-label="Install app">
      {iosVariant ? (
        <>
          <span>Add RideFinder to your Home Screen: tap Share ↑ then &lsquo;Add to Home Screen&rsquo;</span>
          <button type="button" className="install-prompt-dismiss" onClick={handleDismiss} aria-label="Dismiss">
            ✕
          </button>
        </>
      ) : (
        <>
          <span>Install RideFinder — works offline on playa</span>
          <button type="button" className="install-prompt-install" onClick={handleInstall}>
            Install
          </button>
          <button type="button" className="install-prompt-dismiss" onClick={handleDismiss} aria-label="Dismiss">
            ✕
          </button>
        </>
      )}
    </div>
  );
}
