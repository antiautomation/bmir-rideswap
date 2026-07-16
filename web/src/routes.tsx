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
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
