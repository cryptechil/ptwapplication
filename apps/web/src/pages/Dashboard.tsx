import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

interface ListItem {
  id: string;
  internalNumber: number;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  tevelApprovalNumber: string | null;
  tevelApprovalTitle: string | null;
  tevelApprovalLink: string | null;
  failureReason: string | null;
  createdBy: { id: string; name: string; companyName: string | null };
}

export function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['requests'],
    queryFn: () => api.get<{ items: ListItem[] }>('/requests'),
    refetchInterval: 5000,
  });

  if (isLoading) return <div>טוען…</div>;
  const items = data?.items ?? [];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{user?.role === 'admin' ? 'כל הבקשות' : 'הבקשות שלי'}</h2>
        {user?.role !== 'guest' && (
          <Link className="btn" to="/requests/new">+ בקשה חדשה</Link>
        )}
      </div>
      {items.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>אין בקשות עדיין.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>סטטוס</th>
              <th>מספר אישור תבל</th>
              {user?.role === 'admin' && <th>קבלן</th>}
              <th>נוצרה</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>#{r.internalNumber}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>
                  {r.tevelApprovalNumber ? (
                    r.tevelApprovalLink ? (
                      <a href={r.tevelApprovalLink} target="_blank" rel="noreferrer">
                        {r.tevelApprovalNumber}
                      </a>
                    ) : (
                      <span>{r.tevelApprovalNumber}</span>
                    )
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>—</span>
                  )}
                  {r.tevelApprovalTitle && (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>{r.tevelApprovalTitle}</div>
                  )}
                </td>
                {user?.role === 'admin' && (
                  <td>{r.createdBy.companyName ?? r.createdBy.name}</td>
                )}
                <td>{new Date(r.createdAt).toLocaleString('he-IL')}</td>
                <td><Link to={`/requests/${r.id}`}>פתח</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    draft: 'טיוטה',
    queued: 'בתור',
    submitting: 'נשלח כעת',
    awaiting_captcha: 'ממתין לפתרון CAPTCHA',
    submitted: 'הוגש',
    approved: 'אושר',
    failed: 'נכשל',
    schema_mismatch: 'שינוי בטופס תבל',
  };
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>;
}
