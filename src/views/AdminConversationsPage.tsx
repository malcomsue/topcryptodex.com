'use client';

import { useEffect, useMemo, useState } from 'react';

type ConversationRow = {
  id: string;
  user_id: string;
  status: string;
  last_message_at: string;
  created_at: string;
  profile?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

type MessageRow = {
  id: string;
  sender: string;
  body: string;
  created_at: string;
};

export default function AdminConversationsPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [reply, setReply] = useState('');
  const [message, setMessage] = useState('');

  const selected = useMemo(
    () => conversations.find((row) => row.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const loadConversations = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/conversations?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load conversations');
      }
      const data = await res.json();
      setConversations(data.conversations ?? []);
      if (!selectedId && (data.conversations ?? []).length) {
        setSelectedId(data.conversations[0].id);
      }
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    if (!conversationId) return;
    try {
      const res = await fetch(
        `/api/admin/conversations/messages?conversation_id=${encodeURIComponent(conversationId)}`,
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load messages');
      }
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to load messages');
    }
  };

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void loadMessages(selectedId);
  }, [selectedId]);

  const sendReply = async () => {
    const trimmed = reply.trim();
    if (!trimmed || !selectedId) return;
    setMessage('');
    try {
      const res = await fetch('/api/admin/conversations/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: selectedId, message: trimmed }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to send reply');
      }
      setReply('');
      await loadMessages(selectedId);
      await loadConversations();
    } catch (error: any) {
      setMessage(error?.message ?? 'Failed to send reply');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Admin — Conversations</h1>
            <div className="flex items-center gap-4 text-sm">
              <a href="/admin" className="text-blue-600 hover:underline">
                Users
              </a>
              <a href="/admin/kyc" className="text-blue-600 hover:underline">
                KYC
              </a>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, phone"
              className="px-4 py-3 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={loadConversations}
              className="px-4 py-3 rounded-lg bg-black text-white text-sm font-semibold"
            >
              {loading ? 'Loading…' : 'Search'}
            </button>
          </div>
          {message && <p className="text-sm text-rose-600">{message}</p>}
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
            {conversations.length ? (
              conversations.map((row) => {
                const profile = row.profile ?? {};
                const label =
                  profile.full_name ||
                  profile.email ||
                  profile.phone ||
                  row.user_id;
                return (
                  <button
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border ${
                      row.id === selectedId
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-semibold">{label}</div>
                    <div className={`text-xs ${row.id === selectedId ? 'text-gray-200' : 'text-gray-500'}`}>
                      {new Date(row.last_message_at).toLocaleString()}
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">No conversations yet.</p>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col min-h-[520px]">
            {selected ? (
              <>
                <div className="border-b border-gray-100 pb-4 mb-4">
                  <p className="text-sm text-gray-500">Conversation with</p>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selected.profile?.full_name ||
                      selected.profile?.email ||
                      selected.profile?.phone ||
                      selected.user_id}
                  </h2>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm ${
                          msg.sender === 'admin'
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {msg.body}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-gray-100 flex gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply to user..."
                    className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={sendReply}
                    className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold"
                  >
                    Send
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Select a conversation to view messages.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
