import { Outlet } from 'react-router-dom';

import Header from './components/Header';
import TabBar from './components/TabBar';

export default function App() {
  return (
    <>
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
      <TabBar />
    </>
  );
}
