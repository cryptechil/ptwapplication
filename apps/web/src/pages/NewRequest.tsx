import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { FormField } from '@ptw/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { FormFieldInput } from '../components/FormFieldInput';

export function NewRequest() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['schema'],
    queryFn: () => api.get<{ version: string; fields: FormField[] }>('/schema'),
  });
  const fields = data?.fields ?? [];
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Pre-fill requester from logged-in user; date is today.
  useEffect(() => {
    if (!user) return;
    setPayload((p) => ({
      requesterName: p.requesterName ?? user.name,
      requesterEmail: p.requesterEmail ?? user.email,
      applicationDate: p.applicationDate ?? new Date().toISOString().slice(0, 16),
      ...p,
    }));
  }, [user]);

  // Mirror workStart/workEnd into the date range confirmation field.
  const workStart = payload.workStart as string | undefined;
  const workEnd = payload.workEnd as string | undefined;
  useEffect(() => {
    if (workStart && workEnd) {
      setPayload((p) => ({
        ...p,
        dateRangeConfirm: { start: workStart.slice(0, 10), end: workEnd.slice(0, 10) },
      }));
    }
  }, [workStart, workEnd]);

  const requireMissing = useMemo(() => {
    return fields
      .filter((f) => f.required)
      .filter((f) => {
        const v = payload[f.id];
        if (v === undefined || v === null) return true;
        if (typeof v === 'string') return v.trim() === '';
        if (Array.isArray(v)) return v.length === 0;
        if (typeof v === 'object' && f.type === 'phone') {
          return !((v as { number?: string }).number);
        }
        if (typeof v === 'object' && f.type === 'date_range') {
          const r = v as { start?: string; end?: string };
          return !r.start || !r.end;
        }
        return false;
      })
      .map((f) => f.id);
  }, [fields, payload]);

  async function saveDraftAndOpen() {
    setSaving(true);
    setErr(null);
    try {
      const { request } = await api.post<{ request: { id: string } }>('/requests', { payload });
      nav(`/requests/${request.id}`);
    } catch (e) {
      setErr('שמירה נכשלה');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>בקשת היתר עבודה חדשה</h2>
      <p style={{ color: 'var(--muted)' }}>
        מלא את השדות. שמור כטיוטה — הגשה לתבל מתבצעת מעמוד פרטי הבקשה.
      </p>
      {fields.map((f) => (
        <FormFieldInput
          key={f.id}
          field={f}
          value={payload[f.id]}
          onChange={(v) => setPayload((p) => ({ ...p, [f.id]: v }))}
        />
      ))}
      {requireMissing.length > 0 && (
        <div className="banner warn">
          חסרים שדות חובה: {requireMissing.length} (אפשר לשמור כטיוטה ולהשלים אחר כך)
        </div>
      )}
      {err && <div className="banner error">{err}</div>}
      <button className="btn" disabled={saving} onClick={saveDraftAndOpen}>
        {saving ? 'שומר…' : 'שמור כטיוטה'}
      </button>
    </div>
  );
}
