'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchMe, logout, type AuthUser } from '@utils/auth';

interface AuthContextType {
  /** `undefined` while `/auth/me` is loading, `null` when signed out. */
  user: AuthUser | null | undefined;
  signOut: () => Promise<void>;
  /** Re-reads `/auth/me`, e.g. after equipping, so the header's frame follows the loadout. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    fetchMe(controller.signal)
      .then(setUser)
      .catch((error) => {
        if (controller.signal.aborted) return;
        // API down or unexpected status: render the anonymous UI rather than a stuck loading state.
        // No redirect: a blip on /auth/me must not throw the reader off the page they are on.
        console.error(error);
        setUser(null);
      });
    return () => controller.abort();
  }, []);

  // `redirect()` only works during render; in a handler it throws. The refresh drops
  // session-dependent server UI (editor tools, drafts) from the router cache.
  const signOut = async () => {
    await logout();
    setUser(null);
    router.replace("/");
    router.refresh();
  };

  const refresh = () => fetchMe().then(setUser).catch(console.error);

  return (
    <AuthContext.Provider value={{ user, signOut, refresh }}>
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
