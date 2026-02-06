'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const { user, signUp, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoStartedRef = useRef(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    setError('');
    const { error } = await signUp();
    if (error) setError(error.message ?? 'Unable to authenticate');
    else router.push('/');
    setLoading(false);
  };

  useEffect(() => {
    const shouldAutoStart = searchParams?.get('auto') === '1';
    if (!shouldAutoStart) return;
    if (user) return;
    if (authLoading || loading) return;
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void handleAuth();
  }, [searchParams, user, authLoading, loading]);

  return (
    <div className="min-h-screen bg-white">
      <div className="grid grid-cols-1 md:grid-cols-2 min-h-screen">
        <div className="relative hidden md:block">
          <img
            src="/login_page.png"
            alt="Trading welcome"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative h-full flex items-center px-12">
            <p className="text-white text-3xl font-semibold leading-tight">
              Welcome to
              <br />
              Start a new trading journey
            </p>
          </div>
        </div>

        <div className="relative flex flex-col bg-white p-6 sm:p-10">
          <div className="md:hidden relative overflow-hidden rounded-2xl mb-8">
            <img
              src="/login_page.png"
              alt="Trading welcome"
              className="w-full h-48 object-cover"
            />
            <div className="absolute inset-0 bg-black/60" />
            <div className="absolute inset-0 flex items-center px-6">
              <p className="text-white text-2xl font-semibold leading-snug">
                Welcome to
                <br />
                Start a new trading journey
              </p>
            </div>
          </div>

          <div className="w-full flex-1 space-y-6">
            <div>
              <h1 className="text-4xl font-semibold text-gray-900 mb-2">Register</h1>
              <p className="text-sm text-gray-600">
                Create your account with Privy using email/phone or connect a wallet. No passwords needed.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleAuth}
              disabled={loading || authLoading}
              className="w-full py-3 bg-black text-white rounded-full font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || authLoading ? 'Processing...' : 'Create account with Privy'}
            </button>

            <div className="text-center text-sm text-gray-700">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold hover:text-gray-900">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
