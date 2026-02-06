'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'What is a cryptocurrency exchange?',
    answer:
      'A cryptocurrency exchange is a digital marketplace where users can buy, sell, and trade cryptocurrencies. It acts as an intermediary between buyers and sellers, facilitating secure transactions.',
  },
  {
    question: 'What products does the platform offer?',
    answer:
      'We offer spot trading, perpetual contracts, options trading, staking services, and various DeFi products. Our platform provides comprehensive tools for both beginners and advanced traders.',
  },
  {
    question: 'How to trade cryptocurrencies on the platform',
    answer:
      'Simply create an account, complete verification, deposit funds, and start trading. Navigate to the Markets section, select your desired cryptocurrency, and place your order.',
  },
  {
    question: 'Is the platform a secure cryptocurrency exchange?',
    answer:
      'Yes, we employ industry-leading security measures including cold storage, two-factor authentication, encryption, and regular security audits to protect your assets.',
  },
  {
    question: 'How to store forgotten login password?',
    answer:
      'Click on "Forgot Password" on the login page, enter your registered email, and follow the instructions sent to your inbox to reset your password securely.',
  },
  {
    question: 'Why do you need Identify Authentication?',
    answer:
      'Identity authentication is required to comply with regulatory requirements, prevent fraud, and ensure the security of your account and funds.',
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-16 bg-white">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-gray-900 mb-12 text-center">
          Frequently Asked Questions
        </h2>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <span className="font-medium text-gray-900 text-left">{faq.question}</span>
                <ChevronDown
                  className={`text-gray-500 transition-transform ${
                    openIndex === index ? 'transform rotate-180' : ''
                  }`}
                  size={20}
                />
              </button>

              {openIndex === index && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
