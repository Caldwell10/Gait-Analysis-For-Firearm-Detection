'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, UserData, ApiError } from './api';

interface SessionContextType {
  user: UserData | null;
  loading: boolean;
  error: string | null;
  refreshSession: () => Promise<void>;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = async () => {
    try {
      setLoading(true);
      setError(null);
      const userData = await api.me();
      setUser(userData);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // User not authenticated
        setUser(null);
      } else {
        setError(err instanceof Error ? err.message : 'Session error');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearSession = () => {
    setUser(null);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    refreshSession();
  }, []);

  return (
    <SessionContext.Provider
      value={{
        user,
        loading,
        error,
        refreshSession,
        clearSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}