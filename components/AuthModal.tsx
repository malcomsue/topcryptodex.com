'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  mode: 'signin' | 'signup';
  onClose: () => void;
  onSwitchMode: () => void;
}

export default function AuthModal({ mode, onClose, onSwitchMode }: AuthModalProps) {
  const { signIn, signUp, loading: authLoading } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    setError('');
    const { error } = mode === 'signin' ? await signIn() : await signUp();
    if (error) setError(error.message ?? 'Unable to authenticate');
    else onClose();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 rounded-full p-2 bg-white/80 text-gray-500 hover:text-gray-700 shadow"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative hidden md:flex bg-black text-white min-h-[420px]">
            <img
              src="/login_page.png"
              alt="Trading welcome"
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/60" />
            <div className="relative z-10 flex flex-col justify-between p-10">
              <div className="space-y-3">
                <p className="text-2xl font-medium leading-tight">
                  Welcome to
                  <br />
                  Start a new trading journey
                </p>
              </div>
            </div>
          </div>

          <div className="relative flex flex-col bg-white p-6 sm:p-10">
            <div className="md:hidden relative overflow-hidden rounded-2xl mb-6">
              <img
                src="/login_page.png"
                alt="Trading welcome"
                className="w-full h-44 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-black/70 to-black/40" />
              <div className="absolute inset-0 flex items-center px-6">
                <p className="text-white text-xl font-semibold leading-snug">
                  Welcome to
                  <br />
                  Start a new trading journey
                </p>
              </div>
            </div>

            <div className="w-full flex-1 space-y-6">
              <div>
                <h2 className="text-4xl font-semibold text-gray-900 mb-2">
                  {mode === 'signin' ? 'Login' : 'Register'}
                </h2>
                <p className="text-sm text-gray-600">
                  Sign in with Privy using email/phone or your wallet. No passwords required.
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
                {loading || authLoading
                  ? 'Processing...'
                  : mode === 'signin'
                    ? 'Continue with Privy'
                    : 'Create account with Privy'}
              </button>

              <div className="text-center text-sm text-gray-700">
                {mode === 'signin' ? (
                  <>
                    No account?{' '}
                    <button
                      type="button"
                      onClick={onSwitchMode}
                      className="font-semibold hover:text-gray-900"
                    >
                      Register
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={onSwitchMode}
                      className="font-semibold hover:text-gray-900"
                    >
                      Login
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
