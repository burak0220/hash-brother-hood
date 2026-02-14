'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth';
import { messagesAPI } from '@/lib/api';
import type { Conversation, MessageItem } from '@/types';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await messagesAPI.conversations();
      setConversations(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (otherUserId: number) => {
    try {
      const { data } = await messagesAPI.messages(otherUserId);
      setMessages(data.reverse());
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedUserId) {
      loadMessages(selectedUserId);
      // Poll for new messages every 5 seconds
      pollRef.current = setInterval(() => {
        loadMessages(selectedUserId);
        loadConversations();
      }, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedUserId, loadMessages, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !selectedUserId || sending) return;
    setSending(true);
    try {
      const { data } = await messagesAPI.send({ receiver_id: selectedUserId, content: message.trim() });
      setMessages((prev) => [...prev, data]);
      setMessage('');
      loadConversations();
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedConvo = conversations.find((c) => c.user_id === selectedUserId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-xs text-primary-400 font-medium uppercase tracking-[0.3em] mb-1">Communication</p>
        <h1 className="text-2xl font-black text-white">Messages</h1>
        <p className="text-dark-400 text-sm mt-1">Chat with rig owners, renters and support</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6" style={{ minHeight: '70vh' }}>
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Conversations</CardTitle>
              <span className="text-xs text-dark-500">{conversations.length} chats</span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-dark-500 text-sm text-center py-8">Loading...</p>
            ) : conversations.length === 0 ? (
              <p className="text-dark-500 text-sm text-center py-8">No conversations yet</p>
            ) : (
              <div className="space-y-1">
                {conversations.map((convo) => (
                  <button
                    key={convo.user_id}
                    onClick={() => setSelectedUserId(convo.user_id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
                      selectedUserId === convo.user_id
                        ? 'bg-primary-400/10 border border-primary-400/20'
                        : 'hover:bg-dark-800/60 border border-transparent'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400/30 to-accent-400/30 flex items-center justify-center">
                        <span className="text-sm font-bold text-white">{convo.username.charAt(0).toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white truncate">{convo.username}</p>
                        <span className="text-[10px] text-dark-500">{timeAgo(convo.last_message_at)}</span>
                      </div>
                      <p className="text-xs text-dark-400 truncate">{convo.last_message}</p>
                    </div>
                    {convo.unread_count > 0 && (
                      <span className="w-5 h-5 bg-primary-400 text-dark-950 text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                        {convo.unread_count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedUserId && selectedConvo ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-dark-600/30 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400/30 to-accent-400/30 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {selectedConvo.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{selectedConvo.username}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 space-y-3 overflow-y-auto min-h-[300px] max-h-[500px]">
                {messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[70%] px-4 py-2.5 ${
                          isMine
                            ? 'bg-primary-400/15 border border-primary-400/20 rounded-2xl rounded-br-sm'
                            : 'bg-dark-800/80 rounded-2xl rounded-bl-sm'
                        }`}
                      >
                        <p className="text-sm text-dark-200 whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className="text-[10px] text-dark-500 mt-1">{formatTime(msg.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-dark-600/30">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    maxLength={2000}
                    className="flex-1 px-4 py-2.5 bg-dark-800/80 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 text-sm focus:outline-none focus:border-primary-400/40 transition-all"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !message.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-primary-400 to-primary-500 text-dark-950 font-bold text-sm rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {sending ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-dark-800/60 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-dark-400 font-medium">Select a conversation</p>
              <p className="text-dark-500 text-sm mt-1">Choose someone to start chatting</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
