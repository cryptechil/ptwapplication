import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

export type Role = 'admin' | 'subcontractor' | 'guest';
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyName?: string | null;
}

interface AuthCtx {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: CurrentUser | null }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { user } = await api.post<{ user: CurrentUser }>('/auth/login', { email, password });
    setUser(user);
  }

  async function logout() {
    await api.post('/auth/logout');
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
