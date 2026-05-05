import { useState } from 'react';
import { useAuth } from '../auth';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setErr('כניסה נכשלה. בדוק את הפרטים.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 380, marginInline: 'auto', marginTop: 80 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>כניסה למערכת PTW</h1>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label className="label">דוא"ל</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">סיסמה</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {err && <div className="banner error">{err}</div>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'מתחבר…' : 'כניסה'}
          </button>
        </form>
      </div>
    </main>
  );
}
