import { createBrowserRouter, Navigate } from 'react-router-dom';

import App from './App';
import BoardPage from './pages/BoardPage';
import ListingDetailPage from './pages/ListingDetailPage';
import PostPage from './pages/PostPage';
import EditPage from './pages/EditPage';
import MatchesPage from './pages/MatchesPage';
import MessagesPage from './pages/MessagesPage';
import ThreadPage from './pages/ThreadPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import PrivacyPage from './pages/PrivacyPage';
import TerminalPage from './pages/TerminalPage';
import AboutPage from './pages/AboutPage';
import HelpPage from './pages/HelpPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <BoardPage /> },
      { path: 'listing/:id', element: <ListingDetailPage /> },
      { path: 'listing/:id/edit', element: <EditPage /> },
      { path: 'post', element: <PostPage /> },
      { path: 'matches', element: <MatchesPage /> },
      { path: 'messages', element: <MessagesPage /> },
      { path: 'messages/:convId', element: <ThreadPage /> },
      { path: 'me', element: <ProfilePage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terminal', element: <TerminalPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'help', element: <HelpPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
