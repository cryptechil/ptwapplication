async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> ?? {}) };
  if (init.body !== undefined && init.body !== null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {}
    const err = new Error(`HTTP ${res.status}`) as Error & { status: number; body: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body: unknown) =>
    request<T>(p, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
};
