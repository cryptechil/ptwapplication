import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tevelFormSchema, type FormField } from '@ptw/shared';
import { api } from '../api';

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
    failureReason?: string | null;
    payload: Record<string, unknown>;
    createdBy: { name: string; companyName: string | null };
  };
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'טיוטה',
  queued: 'בתור להגשה',
  submitting: 'בהגשה',
  awaiting_captcha: 'ממתין לאימות',
  submitted: 'הוגשה',
  approved: 'אושרה',
  failed: 'נכשלה',
  schema_mismatch: 'שינוי בטופס תבל',
};

export function GuestView() {
  const { token = '' } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['share', token],
    queryFn: () => api.get<SharePayload>(`/shares/${token}`),
    retry: false,
  });

  if (isLoading) {
    return <div style={{ padding: 32 }}>טוען…</div>;
  }
  if (error || !data) {
    return (
      <main style={{ maxWidth: 600, margin: '60px auto', padding: 16 }}>
        <div className="card">
          <h2>הקישור לא תקף או פג תוקף</h2>
        </div>
      </main>
    );
  }

  const r = data.request;

  return (
    <main style={{ maxWidth: 880, margin: '32px auto', padding: '0 16px' }}>
      <div className="card ribbon-wrap" style={{ marginBottom: 16 }}>
        <div className={`ribbon ribbon-${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</div>

        <h1 style={{ margin: 0, fontSize: 24 }}>בקשת היתר עבודה #{r.internalNumber}</h1>
        <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
          {r.createdBy.companyName ?? r.createdBy.name} · נוצרה {fmtDate(r.createdAt)}
        </div>

        {r.tevelApprovalNumber && (
          <div className="banner info" style={{ marginTop: 16, marginBottom: 0 }}>
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
        {r.failureReason && (
          <div className="banner error" style={{ marginTop: 16, marginBottom: 0 }}>
            <strong>סיבת כישלון:</strong> {r.failureReason}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>שלבים</h2>
        <Timeline r={r} />
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>פרטי הבקשה</h2>
        <FieldList payload={r.payload} />
      </div>

      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 16 }}>
        תצוגת אורח · קריאה בלבד
      </div>
    </main>
  );
}

interface Step {
  label: string;
  state: 'done' | 'current' | 'pending' | 'failed';
  meta?: string;
}

function Timeline({ r }: { r: SharePayload['request'] }) {
  const steps: Step[] = [
    {
      label: 'הבקשה נוצרה',
      state: 'done',
      meta: fmtDate(r.createdAt),
    },
    stepFor('הוגשה לתבל', r.submittedAt, r.status, ['queued', 'submitting', 'awaiting_captcha'], 'failed'),
    stepFor('אישור תבל התקבל', r.approvedAt, r.status, [], 'failed', r.tevelApprovalNumber),
  ];

  return (
    <ul className="timeline">
      {steps.map((s, i) => (
        <li
          key={i}
          className={s.state === 'done' ? 'done' : s.state === 'current' ? 'current' : s.state === 'failed' ? 'failed' : ''}
        >
          <div className="timeline-title">{s.label}</div>
          {s.meta && <div className="timeline-meta">{s.meta}</div>}
        </li>
      ))}
    </ul>
  );
}

function stepFor(
  label: string,
  doneAt: string | null,
  status: string,
  inProgressStatuses: string[],
  failOnStatus: string,
  detail?: string | null,
): Step {
  if (doneAt) {
    return { label, state: 'done', meta: detail ? `${detail} · ${fmtDate(doneAt)}` : fmtDate(doneAt) };
  }
  if (status === failOnStatus) return { label, state: 'failed', meta: '—' };
  if (inProgressStatuses.includes(status)) {
    return {
      label,
      state: 'current',
      meta:
        status === 'awaiting_captcha'
          ? 'ממתין לפתרון אימות אבטחה'
          : status === 'submitting'
            ? 'נשלח כעת'
            : 'בתור',
    };
  }
  return { label, state: 'pending' };
}

function FieldList({ payload }: { payload: Record<string, unknown> }) {
  const visible = tevelFormSchema.filter((f) => {
    const v = payload[f.id];
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  });

  if (visible.length === 0) return <p style={{ color: 'var(--muted)' }}>אין פרטים זמינים.</p>;

  return (
    <dl className="kv-list">
      {visible.map((f) => (
        <RowFor key={f.id} field={f} value={payload[f.id]} />
      ))}
    </dl>
  );
}

function RowFor({ field, value }: { field: FormField; value: unknown }) {
  return (
    <>
      <dt>{field.labelHe}</dt>
      <dd>{formatValue(field, value)}</dd>
    </>
  );
}

function formatValue(f: FormField, v: unknown): string {
  switch (f.type) {
    case 'datetime':
      return fmtDate(String(v));
    case 'date_range': {
      const r = v as { start: string; end: string };
      return `${fmtDateOnly(r.start)} ← ${fmtDateOnly(r.end)}`;
    }
    case 'radio_yes_no':
      return v === 'yes' ? 'כן' : 'לא';
    case 'multi_select':
    case 'checkbox_group':
      return (Array.isArray(v) ? (v as string[]) : []).join(', ');
    case 'phone': {
      const p = v as { countryCode?: string; number?: string };
      return `${p.countryCode ?? ''} ${p.number ?? ''}`.trim();
    }
    case 'file': {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      return arr.length === 0 ? '—' : `${arr.length} קבצים`;
    }
    default:
      return String(v ?? '');
  }
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDateOnly(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
