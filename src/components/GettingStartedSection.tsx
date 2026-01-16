'use client';

import { UserPlus, Wallet, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const steps = [
  {
    number: '01',
    title: 'Create an account',
    description: 'Sign up with your email and verify your identity to get started.',
    Icon: UserPlus,
    buttonText: 'Get Started',
  },
  {
    number: '02',
    title: 'Deposit Funds',
    description: 'Add funds to your wallet using multiple payment methods.',
    Icon: Wallet,
    buttonText: 'Deposit Funds',
  },
  {
    number: '03',
    title: 'Start trading',
    description: 'Buy, sell, and trade cryptocurrencies with ease and confidence.',
    Icon: TrendingUp,
    buttonText: 'Start Trading',
  },
];

export default function GettingStartedSection() {
  const { user, signUp, loading: authLoading } = useAuth();
  const isAuthenticated = Boolean(user);
  const [ctaLoading, setCtaLoading] = useState(false);
  const [ctaError, setCtaError] = useState('');

  const handleCreateAccount = async () => {
    setCtaLoading(true);
    setCtaError('');
    const { error } = await signUp();
    if (error) setCtaError(error.message ?? 'Unable to open signup');
    setCtaLoading(false);
  };

  return (
    <section className="py-16 bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-gray-900 mb-12 text-center">Getting Started</h2>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition"
            >
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <step.Icon className="text-blue-600" size={32} />
                </div>
                <div className="text-sm text-gray-500 font-medium mb-2">{step.number}</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>

              {step.number === '01' ? (
                isAuthenticated ? (
                  <button
                    disabled
                    className="w-full py-3 bg-gray-200 text-gray-500 rounded-full font-medium cursor-not-allowed"
                  >
                    Account created
                  </button>
                ) : (
                  <button
                    onClick={handleCreateAccount}
                    disabled={ctaLoading || authLoading}
                    className="w-full py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {ctaLoading || authLoading ? 'Opening...' : step.buttonText}
                  </button>
                )
              ) : step.number === '02' ? (
                <a
                  href="/deposit"
                  className="block w-full text-center py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition font-medium"
                >
                  {step.buttonText}
                </a>
              ) : (
                <button className="w-full py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition font-medium">
                  {step.buttonText}
                </button>
              )}

              {step.number === '01' && ctaError && (
                <p className="mt-3 text-sm text-red-600">{ctaError}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
