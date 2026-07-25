import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

import Header from './components/Header';
import TabBar from './components/TabBar';
import Footer from './components/Footer';
import RecoveryCodeNotice from './components/RecoveryCodeNotice';
import ToastHost from './components/Toast';
import StatusBar from './components/StatusBar';
import InstallPrompt from './components/InstallPrompt';
import BannedScreen from './components/BannedScreen';

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
      <div className="app-top">
        <StatusBar />
        <Header />
      </div>
      <main className="app-main">
        <Outlet />
        <Footer />
      </main>
      <InstallPrompt />
      <TabBar />
      <RecoveryCodeNotice />
      <ToastHost />
    </>
  );
}
