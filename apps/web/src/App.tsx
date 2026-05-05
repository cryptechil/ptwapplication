import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { NewRequest } from './pages/NewRequest';
import { RequestDetail } from './pages/RequestDetail';
import { AdminUsers } from './pages/AdminUsers';
import { GuestView } from './pages/GuestView';

export function App() {
  const { user, loading } = useAuth();
  const loc = useLocation();

  // Public guest share route — no auth required.
  if (loc.pathname.startsWith('/share/')) {
    return (
      <Routes>
        <Route path="/share/:token" element={<GuestView />} />
      </Routes>
    );
  }

  if (loading) return <div style={{ padding: 32 }}>טוען…</div>;
  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/requests/new" element={<NewRequest />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
        {user.role === 'admin' && <Route path="/admin/users" element={<AdminUsers />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
