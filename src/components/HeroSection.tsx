'use client';

import { useState } from 'react';
import AuthModal from './AuthModal';
import { useAuth } from '../contexts/AuthContext';

const floatingIcons = [
  {
    symbol: 'BTC',
    logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=026',
    color: 'bg-orange-500',
    position: 'top-20 left-[10%]',
    delay: '0s',
  },
  {
    symbol: 'ETH',
    logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=026',
    color: 'bg-blue-500',
    position: 'top-40 right-[15%]',
    delay: '1s',
  },
  {
    symbol: 'BNB',
    logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png?v=026',
    color: 'bg-green-500',
    position: 'top-60 left-[20%]',
    delay: '2s',
  },
  {
    symbol: 'XRP',
    logo: 'https://cryptologos.cc/logos/xrp-xrp-logo.png?v=026',
    color: 'bg-cyan-500',
    position: 'top-32 right-[25%]',
    delay: '0.5s',
  },
  {
    symbol: 'USDT',
    logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png?v=026',
    color: 'bg-yellow-500',
    position: 'top-[70%] left-[15%]',
    delay: '1.5s',
  },
  {
    symbol: 'SOL',
    logo: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=026',
    color: 'bg-purple-500',
    position: 'top-[65%] right-[20%]',
    delay: '2.5s',
  },
  {
    symbol: 'ADA',
    logo: 'https://cryptologos.cc/logos/cardano-ada-logo.png?v=026',
    color: 'bg-pink-500',
    position: 'top-[45%] left-[8%]',
    delay: '3s',
  },
  {
    symbol: 'DOGE',
    logo: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png?v=026',
    color: 'bg-red-500',
    position: 'top-[55%] right-[10%]',
    delay: '0.8s',
  },
];

export default function HeroSection() {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <>
      <section className="relative min-h-[600px] overflow-hidden bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 pt-24 pb-16">
        {floatingIcons.map(({ symbol, logo, color, position, delay }, index) => (
          <div
            key={index}
            className={`absolute ${position} animate-float`}
            style={{
              animationDelay: delay,
              animationDuration: '6s',
            }}
          >
            <div className={`${color} p-4 rounded-full shadow-lg opacity-80`}>
              <div className="relative h-8 w-8">
                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                  {symbol}
                </span>
                <img
                  src={logo}
                  alt={`${symbol} logo`}
                  className="absolute inset-0 h-full w-full object-contain"
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="relative w-full px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Unlock the World of
            <span className="block bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Digital Currencies
            </span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 w-full">
            Start trading cryptocurrencies with confidence. Join millions of users worldwide.
          </p>

          {!user && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-8 py-4 bg-blue-600 text-white rounded-full font-medium text-lg hover:bg-blue-700 hover:shadow-xl transition transform hover:scale-105"
            >
              Register Now
            </button>
          )}
        </div>
      </section>

      {showAuthModal && (
        <AuthModal
          mode="signup"
          onClose={() => setShowAuthModal(false)}
          onSwitchMode={() => {}}
        />
      )}

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(10deg);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
