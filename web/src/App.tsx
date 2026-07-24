import { Outlet } from 'react-router-dom';

import Header from './components/Header';
import TabBar from './components/TabBar';
import Footer from './components/Footer';
import RecoveryCodeNotice from './components/RecoveryCodeNotice';
import ToastHost from './components/Toast';
import StatusBar from './components/StatusBar';
import InstallPrompt from './components/InstallPrompt';

export default function App() {
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
