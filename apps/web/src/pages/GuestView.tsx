import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { StatusBadge } from './Dashboard';

interface SharePayload {
  request: {
    id: string;
    internalNumber: number;
    status: string;
    createdAt: string;
    submittedAt: string | null;
    approvedAt: string | null;
    tevelApprovalNumber: string | null;
    tevelApprovalTitle: string | null;
    tevelApprovalLink: string | null;
    payload: Record<string, unknown>;
    createdBy: { name: string; companyName: string | null };
  };
}

export function GuestView() {
  const { token = '' } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['share', token],
    queryFn: () => api.get<SharePayload>(`/shares/${token}`),
    retry: false,
  });

  if (isLoading) return <div style={{ padding: 32 }}>טוען…</div>;
  if (error || !data) {
    return (
      <main style={{ maxWidth: 600, margin: '60px auto' }}>
        <div className="card">
          <h2>הקישור לא תקף או פג תוקף</h2>
        </div>
      </main>
    );
  }
  const r = data.request;

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>בקשה #{r.internalNumber}</h2>
          <StatusBadge status={r.status} />
        </div>
        <div style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>
          תצוגת אורח — לקריאה בלבד · {r.createdBy.companyName ?? r.createdBy.name}
        </div>

        {r.tevelApprovalNumber && (
          <div className="banner info" style={{ marginTop: 16 }}>
            <strong>אישור תבל:</strong>{' '}
            {r.tevelApprovalLink ? (
              <a href={r.tevelApprovalLink} target="_blank" rel="noreferrer">
                {r.tevelApprovalNumber}
              </a>
            ) : (
              r.tevelApprovalNumber
            )}
            {r.tevelApprovalTitle && <span> · {r.tevelApprovalTitle}</span>}
          </div>
        )}

        <h3>פרטי הבקשה</h3>
        <pre style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, overflow: 'auto', direction: 'ltr' }}>
{JSON.stringify(r.payload, null, 2)}
        </pre>
      </div>
    </main>
  );
}
