import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="app-header">
        <div className="brand">PTW · בקשות היתר עבודה</div>
        <nav>
          <Link to="/">בקשות שלי</Link>
          {user?.role !== 'guest' && <Link to="/requests/new">בקשה חדשה</Link>}
          {user?.role === 'admin' && <Link to="/admin/users">משתמשים</Link>}
          <span style={{ color: 'var(--muted)' }}>
            {user?.name} ({roleLabel(user!.role)})
          </span>
          <button className="btn secondary" onClick={() => logout()}>יציאה</button>
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}

function roleLabel(r: string) {
  return r === 'admin' ? 'מנהל' : r === 'subcontractor' ? 'קבלן משנה' : 'אורח';
}
