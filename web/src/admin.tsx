import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from './api';

const KEY = 'pharm02.adminToken';

interface AdminCtx {
  token: string | null;
  setToken: (t: string | null) => void;
  /** Drops the session when the server says it expired. */
  handleError: (err: unknown) => void;
}

const Ctx = createContext<AdminCtx | null>(null);

function readToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(readToken);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    try {
      if (t) sessionStorage.setItem(KEY, t);
      else sessionStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.code === 'unauthorized') setToken(null);
    },
    [setToken],
  );

  const value = useMemo(() => ({ token, setToken, handleError }), [token, setToken, handleError]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdmin outside AdminProvider');
  return v;
}
