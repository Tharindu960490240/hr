import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post, getToken, setToken, setUnauthorizedHandler } from '../lib/api';

const AuthContext = createContext(null);
const RANK = { 'Super Admin': 4, Admin: 3, Manager: 2, Employee: 1 };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) { setReady(true); return; }
    get('/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true));
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const r = await post('/auth/login', { email, password });
    setToken(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const refresh = useCallback(() => get('/auth/me').then(setUser), []);
  const can = useCallback((role) => (RANK[user?.role] || 0) >= RANK[role], [user]);

  const value = useMemo(() => ({ user, ready, login, logout, refresh, can }), [user, ready, login, logout, refresh, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
