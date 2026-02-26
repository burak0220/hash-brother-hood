'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import { rentalsAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { statusBadgeColor, timeAgo } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { RentalConversation, RentalMessage } from '@/types';

function ChatPanel({ conv, userId }: { conv: RentalConversation; userId: number }) {
  const [messages, setMessages] = useState<RentalMessage[]>([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await rentalsAPI.getMessages(conv.rental_id);
      setMessages(data);
    } catch {}
    setLoading(false);
  }, [conv.rental_id]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await rentalsAPI.sendMessage(conv.rental_id, content.trim());
      setMessages(prev => [...prev, data]);
      setContent('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send message.');
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canSend = conv.status === 'active';

  return (
    <div className="flex flex-col h-full">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-dark-500 text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === userId;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  {!isMine && (
                    <span className="text-[10px] text-dark-500 px-1">{msg.sender_username}</span>
                  )}
                  <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                    isMine
                      ? 'bg-primary-500/20 border border-primary-500/30 text-white rounded-br-sm'
                      : 'bg-dark-800 text-dark-200 rounded-bl-sm'
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-dark-600 px-1">{timeAgo(msg.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {canSend ? (
        <form onSubmit={send} className="border-t border-dark-700 p-3 flex gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type a message..."
            maxLength={2000}
            className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/40"
          />
          <button
            type="submit"
            disabled={sending || !content.trim()}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-400 text-dark-950 font-bold text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            Send
          </button>
        </form>
      ) : (
        <div className="border-t border-dark-700 p-3">
          <p className="text-xs text-dark-500 text-center">
            Messaging is only available while the rental is active.
          </p>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<RentalConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RentalConversation | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await rentalsAPI.conversations();
      setConversations(data);
      // Auto-select first if nothing selected
      if (data.length > 0 && !selected) {
        setSelected(data[0]);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 80px)' }}>
      <div className="flex h-full gap-0 border border-dark-700 rounded-xl overflow-hidden">

        {/* ── Sidebar: conversation list ── */}
        <div className="w-72 shrink-0 border-r border-dark-700 flex flex-col bg-dark-900/50">
          <div className="p-4 border-b border-dark-700">
            <h1 className="text-lg font-bold text-white">Messages</h1>
            {totalUnread > 0 && (
              <p className="text-xs text-primary-400 mt-0.5">{totalUnread} unread</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-dark-500 text-sm mb-1">No conversations yet</p>
                <p className="text-dark-600 text-xs">Messages appear when you rent or have an active rig</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.rental_id}
                  onClick={() => setSelected(conv)}
                  className={`w-full text-left p-4 border-b border-dark-800/50 hover:bg-dark-800/50 transition-colors ${
                    selected?.rental_id === conv.rental_id ? 'bg-primary-500/10 border-l-2 border-l-primary-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{conv.rig_name}</p>
                      <p className="text-xs text-dark-500 truncate">
                        {conv.role === 'renter' ? 'Owner: ' : 'Renter: '}
                        <span className="text-primary-400">{conv.other_username}</span>
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {conv.unread_count > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-primary-500 text-dark-950 text-[10px] font-black rounded-full">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${statusBadgeColor(conv.status)}`}>
                        {conv.status}
                      </span>
                    </div>
                  </div>
                  {conv.last_message && (
                    <p className="text-xs text-dark-500 truncate">{conv.last_message}</p>
                  )}
                  {conv.last_message_at && (
                    <p className="text-[10px] text-dark-600 mt-0.5">{timeAgo(conv.last_message_at)}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Main: chat panel ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-dark-950">
          {selected ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-dark-700">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{selected.rig_name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadgeColor(selected.status)}`}>
                      {selected.status}
                    </span>
                  </div>
                  <p className="text-xs text-dark-500">
                    {selected.role === 'renter' ? 'Rig owner: ' : 'Renter: '}
                    <span className="text-primary-400">{selected.other_username}</span>
                    {' · '}Rental #{selected.rental_id}
                  </p>
                </div>
                <Link href={`/rentals/${selected.rental_id}`}>
                  <button className="text-xs text-primary-400 hover:text-primary-300 border border-primary-500/20 px-3 py-1.5 rounded-lg hover:border-primary-500/40 transition-colors">
                    View Rental →
                  </button>
                </Link>
              </div>

              {/* Chat */}
              <div className="flex-1 min-h-0">
                <ChatPanel conv={selected} userId={user?.id || 0} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-dark-800/60 flex items-center justify-center">
                <svg className="w-8 h-8 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              {conversations.length > 0 ? (
                <p className="text-dark-400">Select a conversation to start messaging</p>
              ) : (
                <>
                  <p className="text-dark-400 font-medium">No conversations yet</p>
                  <p className="text-dark-500 text-sm">Messages between renters and rig owners appear here during active rentals</p>
                  <div className="flex gap-3">
                    <Link href="/rentals"><Button variant="secondary" size="sm">View Rentals</Button></Link>
                    <Link href="/marketplace"><Button size="sm">Browse Marketplace</Button></Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
