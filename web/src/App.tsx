import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import Header from './components/Header';
import TabBar from './components/TabBar';
import Footer from './components/Footer';
import RecoveryCodeNotice from './components/RecoveryCodeNotice';
import ToastHost from './components/Toast';
import StatusBar from './components/StatusBar';
import InstallPrompt from './components/InstallPrompt';
import BannedScreen from './components/BannedScreen';
import RadioPlayer from './components/RadioPlayer';
import { TerminalBanner } from './components/TerminalChrome';
import { isTerminal } from './lib/terminal';

/** SPA navigation keeps the old scroll position — jump to the top on every
 *  route change. The board ('/') is exempt so returning to it (e.g. back from
 *  a listing you scrolled to) doesn't lose your place. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname === '/') return;
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const [banned, setBanned] = useState(false);

  useEffect(() => {
    function onBanned(): void {
      setBanned(true);
    }
    window.addEventListener('rs:banned', onBanned);
    return () => window.removeEventListener('rs:banned', onBanned);
  }, []);

  if (banned) return <BannedScreen />;

  return (
    <>
      <ScrollToTop />
      <div className={isTerminal() ? 'app-top app-top--terminal' : 'app-top'}>
        <StatusBar />
        {isTerminal() && <TerminalBanner />}
        <Header />
      </div>
      <main className="app-main">
        <Outlet />
        <Footer />
      </main>
      <RadioPlayer />
      {/* The station is a shared machine: never invite installing the PWA on
          it, and the terminal's own code displays replace the recovery modal. */}
      {!isTerminal() && <InstallPrompt />}
      <TabBar />
      {!isTerminal() && <RecoveryCodeNotice />}
      <ToastHost />
    </>
  );
}
