'use client';
import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { disputesAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Dispute } from '@/types';

function statusColor(status: string) {
  switch (status) {
    case 'open': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'under_review': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'resolved': return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/20';
    default: return 'bg-dark-800 text-dark-400 border-dark-600';
  }
}

export default function DisputesPage() {
  const { user } = useAuthStore();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const { data } = await disputesAPI.list();
      setDisputes(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadDispute = async (id: number) => {
    try {
      const { data } = await disputesAPI.get(id);
      setSelected(data);
    } catch {}
  };

  const handleSendMessage = async () => {
    if (!selected || !newMessage.trim() || sending) return;
    setSending(true);
    try {
      await disputesAPI.addMessage(selected.id, newMessage.trim());
      setNewMessage('');
      await loadDispute(selected.id);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send');
    }
    setSending(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-xs text-primary-400 font-medium uppercase tracking-[0.3em] mb-1">Support</p>
        <h1 className="text-2xl font-black text-white">Disputes</h1>
        <p className="text-dark-400 text-sm mt-1">Manage rental disputes and resolutions</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6" style={{ minHeight: '60vh' }}>
        {/* Disputes List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>My Disputes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-dark-500 text-sm text-center py-8">Loading...</p>
            ) : disputes.length === 0 ? (
              <p className="text-dark-500 text-sm text-center py-8">No disputes</p>
            ) : (
              <div className="space-y-2">
                {disputes.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => loadDispute(d.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selected?.id === d.id
                        ? 'bg-primary-400/10 border-primary-400/20'
                        : 'border-transparent hover:bg-dark-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">Rental #{d.rental_id}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColor(d.status)}`}>
                        {d.status}
                      </span>
                    </div>
                    <p className="text-xs text-dark-400 truncate">{d.reason}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dispute Detail */}
        <Card className="lg:col-span-2 flex flex-col">
          {selected ? (
            <>
              <div className="p-4 border-b border-dark-600/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Dispute #{selected.id} - Rental #{selected.rental_id}</h3>
                    <p className="text-[10px] text-dark-500">Opened by {selected.opener_username} on {formatDateTime(selected.created_at)}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${statusColor(selected.status)}`}>
                    {selected.status}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-dark-800/30 border-b border-dark-600/30">
                <p className="text-xs text-dark-400 mb-1">Reason:</p>
                <p className="text-sm text-dark-200">{selected.reason}</p>
              </div>

              {selected.resolution && (
                <div className="p-4 bg-green-500/5 border-b border-dark-600/30">
                  <p className="text-xs text-green-400 mb-1">Resolution:</p>
                  <p className="text-sm text-dark-200">{selected.resolution}</p>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 p-4 space-y-3 overflow-y-auto min-h-[200px] max-h-[400px]">
                {selected.messages.length === 0 ? (
                  <p className="text-dark-500 text-sm text-center py-4">No messages yet</p>
                ) : (
                  selected.messages.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-4 py-2.5 ${
                          isMine
                            ? 'bg-primary-400/15 border border-primary-400/20 rounded-2xl rounded-br-sm'
                            : 'bg-dark-800/80 rounded-2xl rounded-bl-sm'
                        }`}>
                          <p className="text-[10px] text-dark-500 mb-1">{msg.sender_username}</p>
                          <p className="text-sm text-dark-200 whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-[10px] text-dark-500 mt-1">{formatDateTime(msg.created_at)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input */}
              {!['resolved', 'rejected'].includes(selected.status) && (
                <div className="p-4 border-t border-dark-600/30">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      placeholder="Add a message..."
                      maxLength={2000}
                      className="flex-1 px-4 py-2.5 bg-dark-800/80 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 text-sm focus:outline-none focus:border-primary-400/40 transition-all"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={sending || !newMessage.trim()}
                      className="px-5 py-2.5 bg-gradient-to-r from-primary-400 to-primary-500 text-dark-950 font-bold text-sm rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <p className="text-dark-400 font-medium">Select a dispute to view details</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
