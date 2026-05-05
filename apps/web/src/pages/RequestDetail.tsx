import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormField } from '@ptw/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { FormFieldInput } from '../components/FormFieldInput';
import { StatusBadge } from './Dashboard';

interface DetailResponse {
  request: {
    id: string;
    internalNumber: number;
    status: string;
    payload: Record<string, unknown>;
    submittedAt: string | null;
    approvedAt: string | null;
    tevelApprovalNumber: string | null;
    tevelApprovalTitle: string | null;
    tevelApprovalLink: string | null;
    failureReason: string | null;
    attachments: Array<{ id: string; filename: string; size: number }>;
    createdBy: { id: string; name: string; email: string; companyName: string | null };
  };
}

const EDITABLE_STATUSES = new Set(['draft', 'failed', 'schema_mismatch']);

function formatApiError(err: unknown): string {
  if (!err) return '';
  const e = err as { status?: number; body?: { error?: string; details?: { fieldErrors?: Record<string, string[]> } } };
  if (!e.body) return e.status ? `שגיאת שרת ${e.status}` : 'שגיאת שרת';
  const code = e.body.error;
  const fieldErrors = e.body.details?.fieldErrors ?? {};
  const fields = Object.entries(fieldErrors)
    .map(([k, v]) => `${k}: ${v.join(', ')}`)
    .join(' · ');
  if (code === 'payload_invalid') {
    return `הבקשה לא עברה אימות. ${fields ? 'שדות בעייתיים: ' + fields : ''}`;
  }
  if (code === 'schema_mismatch') {
    return 'מבנה טופס תבל השתנה. מנהל המערכת חייב לבדוק לפני הגשה.';
  }
  if (code === 'not_submittable') {
    return 'הבקשה לא במצב שניתן להגיש (כבר הוגשה / בעיבוד).';
  }
  if (code === 'forbidden') return 'אין הרשאה לפעולה זו.';
  return `${code ?? 'שגיאה'} ${fields}`.trim();
}

export function RequestDetail() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['request', id],
    queryFn: () => api.get<DetailResponse>(`/requests/${id}`),
    refetchInterval: (q) => {
      const s = q.state.data?.request.status;
      return s && ['queued', 'submitting', 'awaiting_captcha'].includes(s) ? 3000 : false;
    },
  });
  const { data: schemaData } = useQuery({
    queryKey: ['schema'],
    queryFn: () => api.get<{ fields: FormField[] }>('/schema'),
  });
  const fields = schemaData?.fields ?? [];

  const [payload, setPayload] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (data?.request.payload) setPayload(data.request.payload);
  }, [data?.request.id]);

  const r = data?.request;
  const editable = !!r && EDITABLE_STATUSES.has(r.status);

  const save = useMutation({
    mutationFn: () => api.patch(`/requests/${id}`, { payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['request', id] }),
  });

  const submit = useMutation({
    mutationFn: () => api.post(`/requests/${id}/submit`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['request', id] }),
  });

  const createShare = useMutation({
    mutationFn: () => api.post<{ share: { token: string } }>(`/requests/${id}/shares`),
    onSuccess: ({ share }) => {
      const url = `${window.location.origin}/share/${share.token}`;
      navigator.clipboard.writeText(url).catch(() => {});
      alert(`לינק שיתוף הועתק:\n${url}`);
    },
  });

  if (!r) return <div>טוען…</div>;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>בקשה #{r.internalNumber}</h2>
        <StatusBadge status={r.status} />
      </div>

      <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        {r.createdBy.companyName ?? r.createdBy.name} · {r.createdBy.email}
      </div>

      {r.tevelApprovalNumber && (
        <div className="banner info">
          <strong>אישור תבל:</strong>{' '}
          {r.tevelApprovalLink ? (
            <a href={r.tevelApprovalLink} target="_blank" rel="noreferrer">{r.tevelApprovalNumber}</a>
          ) : r.tevelApprovalNumber}
          {r.tevelApprovalTitle && <span> · {r.tevelApprovalTitle}</span>}
        </div>
      )}
      {r.status === 'awaiting_captcha' && (
        <div className="banner warn">
          הבקשה מולאה אוטומטית בטופס תבל. נדרש כעת לפתור את ה-CAPTCHA וללחוץ "שלח" ידנית בחלון הדפדפן של ה-worker.
        </div>
      )}
      {r.failureReason && (
        <div className="banner error">
          סיבת כישלון: {r.failureReason}
        </div>
      )}
      {(submit.error || save.error) && (
        <div className="banner error">
          {formatApiError(submit.error || save.error)}
        </div>
      )}

      {fields.map((f) => (
        <FormFieldInput
          key={f.id}
          field={f}
          value={payload[f.id]}
          onChange={(v) => editable && setPayload((p) => ({ ...p, [f.id]: v }))}
        />
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {editable && (
          <button className="btn secondary" onClick={() => save.mutate()} disabled={save.isPending}>
            שמור שינויים
          </button>
        )}
        {editable && (
          <button
            className="btn"
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
          >
            הגש לתבל
          </button>
        )}
        {user?.role !== 'guest' && (
          <button className="btn secondary" onClick={() => createShare.mutate()}>
            צור לינק שיתוף לאורח
          </button>
        )}
      </div>
    </div>
  );
}
