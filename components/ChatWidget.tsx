'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

type ChatMessage = {
  id: string;
  role: 'bot' | 'user';
  text: string;
};

export default function ChatWidget() {
  const { user, signIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!user) {
      if (messages.length === 0) {
        setMessages([{ id: 'welcome', role: 'bot', text: 'Hi, how can i help you' }]);
      }
      return;
    }

    let cancelled = false;
    const loadMessages = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/chat/messages?user_id=${encodeURIComponent(String((user as any).id ?? ''))}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const normalized = (data?.messages ?? []).map((msg: any) => ({
          id: msg.id,
          role: msg.sender === 'user' ? 'user' : 'bot',
          text: msg.body,
        }));
        setMessages(normalized);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!user) {
      void signIn();
      return;
    }
    const userId = String((user as any).id ?? '');
    if (!userId) return;

    const optimisticId = `${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, role: 'user', text: trimmed }]);
    setInput('');

    void fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, message: trimmed }),
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div className="w-[320px] max-w-[90vw] rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-900">Support</p>
              <p className="text-xs text-gray-500">We reply as soon as possible</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 w-8 rounded-full border border-gray-200 text-gray-500 hover:text-gray-900"
              aria-label="Close chat"
            >
              ×
            </button>
          </div>
          <div ref={scrollRef} className="max-h-[320px] overflow-y-auto px-4 py-3 space-y-3">
            {loading ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`rounded-2xl px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSend} className="border-t border-gray-100 px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={user ? 'Type your message...' : 'Login to chat'}
                className="flex-1 rounded-full border border-gray-200 px-3 py-2 text-sm focus:outline-none"
                disabled={!user}
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold"
              >
                Send
              </button>
            </div>
            {!user ? (
              <button
                type="button"
                onClick={() => signIn()}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                Continue with login
              </button>
            ) : null}
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="h-14 w-14 rounded-full bg-gray-900 text-white shadow-lg flex items-center justify-center text-2xl"
        aria-label="Open chat"
      >
        💬
      </button>
    </div>
  );
}
