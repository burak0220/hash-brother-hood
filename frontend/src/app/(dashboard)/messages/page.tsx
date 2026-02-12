'use client';
import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth';

const mockConversations = [
  { id: 1, username: 'miner_pro', lastMessage: 'Is the rig still available?', time: '2 min ago', unread: 2, online: true },
  { id: 2, username: 'hash_king', lastMessage: 'Thanks, the rental is working great!', time: '1 hour ago', unread: 0, online: true },
  { id: 3, username: 'crypto_dave', lastMessage: 'Can you lower the price for 48h rental?', time: '3 hours ago', unread: 1, online: false },
  { id: 4, username: 'support', lastMessage: 'Your withdrawal has been approved.', time: '1 day ago', unread: 0, online: true },
];

export default function MessagesPage() {
  const { user } = useAuthStore();
  const [selectedConvo, setSelectedConvo] = useState<number | null>(null);
  const [message, setMessage] = useState('');

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
              <span className="text-xs text-dark-500">{mockConversations.length} chats</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {mockConversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setSelectedConvo(convo.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
                    selectedConvo === convo.id
                      ? 'bg-primary-400/10 border border-primary-400/20'
                      : 'hover:bg-dark-800/60 border border-transparent'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400/30 to-accent-400/30 flex items-center justify-center">
                      <span className="text-sm font-bold text-white">{convo.username.charAt(0).toUpperCase()}</span>
                    </div>
                    {convo.online && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-dark-900" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white truncate">{convo.username}</p>
                      <span className="text-[10px] text-dark-500">{convo.time}</span>
                    </div>
                    <p className="text-xs text-dark-400 truncate">{convo.lastMessage}</p>
                  </div>
                  {convo.unread > 0 && (
                    <span className="w-5 h-5 bg-primary-400 text-dark-950 text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                      {convo.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedConvo ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-dark-600/30 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400/30 to-accent-400/30 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {mockConversations.find(c => c.id === selectedConvo)?.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{mockConversations.find(c => c.id === selectedConvo)?.username}</p>
                  <p className="text-[10px] text-green-400">Online</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-[300px]">
                <div className="flex justify-start">
                  <div className="max-w-[70%] bg-dark-800/80 rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <p className="text-sm text-dark-200">Hey, is the rig still available for rent?</p>
                    <p className="text-[10px] text-dark-500 mt-1">10:32 AM</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[70%] bg-primary-400/15 border border-primary-400/20 rounded-2xl rounded-br-sm px-4 py-2.5">
                    <p className="text-sm text-dark-200">Yes! It&apos;s active and ready. What duration do you need?</p>
                    <p className="text-[10px] text-dark-500 mt-1">10:34 AM</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[70%] bg-dark-800/80 rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <p className="text-sm text-dark-200">Looking for 24 hours on SHA-256. What&apos;s your best price?</p>
                    <p className="text-[10px] text-dark-500 mt-1">10:35 AM</p>
                  </div>
                </div>
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-dark-600/30">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 bg-dark-800/80 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 text-sm focus:outline-none focus:border-primary-400/40 transition-all"
                  />
                  <button className="px-5 py-2.5 bg-gradient-to-r from-primary-400 to-primary-500 text-dark-950 font-bold text-sm rounded-xl hover:opacity-90 transition-opacity">
                    Send
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
