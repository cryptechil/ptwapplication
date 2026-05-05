import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Role } from '../auth';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyName: string | null;
  active: boolean;
  createdAt: string;
}

export function AdminUsers() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ users: UserRow[] }>('/users'),
  });
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'subcontractor' as Role,
    companyName: '',
  });

  const create = useMutation({
    mutationFn: () => api.post('/users', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setForm({ email: '', password: '', name: '', role: 'subcontractor', companyName: '' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: (u: UserRow) => api.patch(`/users/${u.id}`, { active: !u.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>הוספת משתמש</h2>
        <div className="field-row">
          <div className="field">
            <label className="label">דוא"ל</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">שם</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label className="label">סיסמה ראשונית</label>
            <input className="input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">תפקיד</label>
            <select
              className="select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              <option value="subcontractor">קבלן משנה</option>
              <option value="admin">מנהל</option>
              <option value="guest">אורח</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label className="label">חברה (אופציונלי)</label>
          <input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        </div>
        <button className="btn" onClick={() => create.mutate()} disabled={create.isPending}>
          הוסף משתמש
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>משתמשים</h2>
        <table>
          <thead>
            <tr>
              <th>שם</th>
              <th>דוא"ל</th>
              <th>תפקיד</th>
              <th>חברה</th>
              <th>פעיל</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.companyName ?? '—'}</td>
                <td>{u.active ? 'כן' : 'לא'}</td>
                <td>
                  <button className="btn secondary" onClick={() => toggleActive.mutate(u)}>
                    {u.active ? 'השבת' : 'הפעל'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
