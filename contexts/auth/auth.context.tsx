'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { fetchMe, logout, type AuthUser } from '@utils/auth';
import { useRouter } from 'next/router';
import { redirect } from 'next/navigation';

interface AuthContextType {
  /** `undefined` while `/auth/me` is loading, `null` when signed out. */
  user: AuthUser | null | undefined;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    fetchMe(controller.signal)
      .then(setUser)
      .catch((error) => {
        if (controller.signal.aborted) return;
        // API down or unexpected status: render the anonymous UI rather than a stuck loading state.
        console.error(error);
        setUser(null);
        redirect("/");
      });
    return () => controller.abort();
  }, []);

  const signOut = async () => {
    await logout();
    setUser(null);
    redirect("/");
  };

  return (
    <AuthContext.Provider value={{ user, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
