import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiUrl } from '../apiUrl.js';
import { friendlyApiError, readApiResponse } from '../utils/http.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' });
      const parsed = await readApiResponse(res);
      if (parsed.ok && parsed.data) {
        const data = parsed.data;
        setUser(data);
        return data;
      }
    } catch (_) {}
    setUser(null);
    return null;
  };

  useEffect(() => {
    fetchMe().finally(() => setLoading(false));
  }, []);

  const login = async (identificador, password) => {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ identificador, password }),
    });
    const parsed = await readApiResponse(res);
    if (!parsed.ok || !parsed.data) {
      throw new Error(friendlyApiError(parsed, 'No pudimos iniciar sesión. Verifica tus datos e intenta otra vez.'));
    }
    const data = parsed.data;
    setUser({
      id: data.rol === 'usuario' ? data.usuario?.id : data.rol === 'asesora' ? data.asesora?.id : null,
      email: identificador,
      rol: data.rol,
      mustChangePassword: data.mustChangePassword === true,
      usuario: data.usuario,
      asesora: data.asesora,
    });
    return data;
  };

  const logout = async () => {
    await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
