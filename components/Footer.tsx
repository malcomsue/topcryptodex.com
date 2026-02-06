'use client';

import { useState } from 'react';
import AuthModal from './AuthModal';
import { useAuth } from '../contexts/AuthContext';

const footerLinks = {
  About: ['Company Introduction', 'Careers', 'Blog', 'News'],
  Products: ['Spot Trading', 'Margin Trading', 'Futures', 'Staking'],
  Assets: ['Leaderboard', 'Spot Assets', 'Margin Assets', 'Futures Assets'],
  Service: ['Buy Crypto', 'Markets', 'Trading Fee', 'Affiliate Program', 'Referral Program', 'API'],
};

export default function Footer() {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <>
      <footer className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Ready to start your crypto journey?</h2>
            {!user && (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-8 py-3 bg-white text-blue-600 rounded-full hover:bg-gray-100 transition font-medium"
              >
                Register
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
            <div>
              <h3 className="text-2xl font-bold mb-6">TOPCRYPTODEX</h3>
              <p className="text-blue-100 text-sm">
                Your trusted platform for cryptocurrency trading and investment.
              </p>
            </div>

            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h4 className="font-bold mb-4">{category}</h4>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-blue-100 hover:text-white transition text-sm"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-blue-400/30 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-blue-100 text-sm">
                © 2024 TOPCRYPTODEX. All rights reserved.
              </p>
              <div className="flex space-x-6 text-sm text-blue-100">
                <a href="#" className="hover:text-white transition">
                  Privacy Policy
                </a>
                <a href="#" className="hover:text-white transition">
                  Terms of Service
                </a>
                <a href="#" className="hover:text-white transition">
                  Cookie Policy
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {showAuthModal && (
        <AuthModal
          mode="signup"
          onClose={() => setShowAuthModal(false)}
          onSwitchMode={() => {}}
        />
      )}
    </>
  );
}
