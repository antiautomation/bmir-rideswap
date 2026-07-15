import { Outlet } from 'react-router-dom';

import Header from './components/Header';
import TabBar from './components/TabBar';
import RecoveryCodeNotice from './components/RecoveryCodeNotice';
import ToastHost from './components/Toast';

export default function App() {
  return (
    <>
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
      <TabBar />
      <RecoveryCodeNotice />
      <ToastHost />
    </>
  );
}
