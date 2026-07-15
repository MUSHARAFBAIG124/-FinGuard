import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isEmailVerified: boolean;
}

interface AuthState {
  user: PublicUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('fg_access_token');
      const savedUser = localStorage.getItem('fg_user');
      const tokenLooksLikeJwt = savedToken?.split('.').length === 3;

      if (savedToken?.startsWith('demo_token_') || (savedToken && !tokenLooksLikeJwt)) {
        localStorage.removeItem('fg_access_token');
        localStorage.removeItem('fg_user');
      } else if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch {
      // corrupted storage — start clean
      localStorage.removeItem('fg_access_token');
      localStorage.removeItem('fg_user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res: any = await apiClient.post('/auth/login', { email, password });
    const { user: u, tokens } = res?.data ?? res;
    const accessToken: string | undefined = tokens?.accessToken;

    if (!u || !accessToken || accessToken.split('.').length !== 3) {
      localStorage.removeItem('fg_access_token');
      localStorage.removeItem('fg_user');
      setToken(null);
      setUser(null);
      throw new Error('Authentication response did not include a valid backend JWT');
    }

    localStorage.setItem('fg_access_token', accessToken);
    localStorage.setItem('fg_user', JSON.stringify(u));
    setToken(accessToken);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout', {});
    } finally {
      localStorage.removeItem('fg_access_token');
      localStorage.removeItem('fg_user');
      setToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
