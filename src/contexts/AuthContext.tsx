'use client';

import { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { usePrivy, type User as PrivyUser } from '@privy-io/react-auth';
import { usePathname, useRouter } from 'next/navigation';

interface AuthContextType {
  user: PrivyUser | null;
  session: null;
  loading: boolean;
  signUp: (email?: string, password?: string) => Promise<{ error: any }>;
  signIn: (email?: string, password?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authenticated || !user) return;
    const email =
      (user as any)?.email?.address ??
      (user as any)?.email ??
      null;
    const phone =
      (user as any)?.phone?.number ??
      (user as any)?.phone ??
      null;
    const fullName =
      (user as any)?.name ??
      (user as any)?.display_name ??
      null;

    void fetch('/api/profile/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: (user as any).id,
        email,
        phone,
        full_name: fullName,
      }),
    });
  }, [authenticated, user]);

  useEffect(() => {
    if (!authenticated || !user) return;
    if (!pathname) return;
    if (pathname.startsWith('/profile/complete') || pathname.startsWith('/admin')) return;

    let cancelled = false;
    const checkProfile = async () => {
      try {
        const res = await fetch(
          `/api/profile/status?user_id=${encodeURIComponent(String((user as any).id ?? ''))}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.complete === false) {
          router.replace('/profile/complete');
        }
      } catch (error) {
        console.error('Failed to check profile status', error);
      }
    };

    void checkProfile();
    return () => {
      cancelled = true;
    };
  }, [authenticated, pathname, router, user]);

  const value = useMemo<AuthContextType>(() => {
    const loading = !ready;

    const signIn = async () => {
      try {
        await login();
        return { error: null };
      } catch (error) {
        return { error };
      }
    };

    // Privy handles registration in the same flow as login.
    const signUp = signIn;

    const signOut = async () => {
      try {
        await logout();
      } catch (error) {
        console.error('Error during logout', error);
      }
    };

    return {
      user: authenticated ? user ?? null : null,
      session: null,
      loading,
      signIn,
      signUp,
      signOut,
    };
  }, [ready, authenticated, user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
