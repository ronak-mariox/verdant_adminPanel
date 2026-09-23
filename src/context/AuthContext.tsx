import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearTokens, getAccessToken, getRefreshToken, setSessionExpiredHandler, setTokens } from '@/lib/api';

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  admin: Admin;
}

interface AuthContextValue {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    clearTokens();
    setAdmin(null);
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken });
      } catch {
        // best-effort — local state is already cleared
      }
    }
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setAdmin(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  useEffect(() => {
    async function restoreSession() {
      if (!getAccessToken()) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await api.get<Admin>('/admin/me');
        setAdmin(me);
      } catch {
        clearTokens();
        setAdmin(null);
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<LoginResponse>('/admin/auth/login', { email, password });
    setTokens(data.accessToken, data.refreshToken);
    setAdmin(data.admin);
  }, []);

  const value: AuthContextValue = {
    admin,
    isAuthenticated: admin !== null,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
