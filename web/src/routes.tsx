import { createBrowserRouter, Navigate } from 'react-router-dom';

import App from './App';
import BoardPage from './pages/BoardPage';
import ListingDetailPage from './pages/ListingDetailPage';
import PostPage from './pages/PostPage';
import EditPage from './pages/EditPage';
import MatchesPage from './pages/MatchesPage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';

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
      { path: 'me', element: <ProfilePage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
