'use client';
import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import { supportAPI } from '@/lib/api';
import { formatDateTime, statusBadgeColor } from '@/lib/utils';
import { toast } from 'react-hot-toast';

interface Ticket {
  id: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  rental_id: number | null;
  created_at: string;
  message_count: number;
  messages: { id: number; sender_name: string; message: string; created_at: string }[];
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // New ticket form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const { data } = await supportAPI.list();
      setTickets(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) return toast.error('Subject and message required');
    setCreating(true);
    try {
      await supportAPI.create({ subject, message, category });
      toast.success('Ticket created');
      setShowNew(false);
      setSubject('');
      setMessage('');
      load();
    } catch { toast.error('Failed to create ticket'); }
    setCreating(false);
  };

  const handleSendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return;
    setSending(true);
    try {
      await supportAPI.addMessage(selectedTicket.id, newMessage);
      setNewMessage('');
      const { data } = await supportAPI.get(selectedTicket.id);
      setSelectedTicket(data);
      load();
    } catch { toast.error('Failed to send'); }
    setSending(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Support</h1>
          <p className="text-dark-400">Get help with your account or rentals</p>
        </div>
        <Button onClick={() => { setShowNew(true); setSelectedTicket(null); }}>New Ticket</Button>
      </div>

      {/* New Ticket Form */}
      {showNew && (
        <Card>
          <CardHeader><CardTitle>New Support Ticket</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 max-w-lg">
              <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of your issue" />
              <Select label="Category" options={[
                { value: 'general', label: 'General' },
                { value: 'billing', label: 'Billing' },
                { value: 'technical', label: 'Technical' },
                { value: 'dispute', label: 'Dispute' },
              ]} value={category} onChange={(e) => setCategory(e.target.value)} />
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Message</label>
                <textarea className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 min-h-[100px]"
                  value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue in detail..." />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} loading={creating}>Submit</Button>
                <Button variant="secondary" onClick={() => setShowNew(false)}>Cancel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Ticket Detail */}
      {selectedTicket && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>#{selectedTicket.id} — {selectedTicket.subject}</CardTitle>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeColor(selectedTicket.status)}`}>{selectedTicket.status}</span>
                <Button variant="secondary" size="sm" onClick={() => setSelectedTicket(null)}>Close</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
              {selectedTicket.messages.map(m => (
                <div key={m.id} className="bg-dark-800 rounded-lg p-3">
                  <div className="flex justify-between text-xs text-dark-400 mb-1">
                    <span className="font-medium text-primary-400">{m.sender_name}</span>
                    <span>{formatDateTime(m.created_at)}</span>
                  </div>
                  <p className="text-sm text-white whitespace-pre-wrap">{m.message}</p>
                </div>
              ))}
            </div>
            {selectedTicket.status !== 'closed' && (
              <div className="flex gap-2">
                <input className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a reply..."
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()} />
                <Button onClick={handleSendMessage} loading={sending} size="sm">Send</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ticket List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tickets.length === 0 && !showNew ? (
        <Card className="text-center py-12">
          <p className="text-dark-400">No support tickets yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => (
            <div key={t.id} className="cursor-pointer" onClick={() => { setSelectedTicket(null); supportAPI.get(t.id).then(({ data }) => setSelectedTicket(data)); setShowNew(false); }}>
              <Card hover className="!p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">#{t.id} — {t.subject}</p>
                  <p className="text-xs text-dark-400">{t.category} · {formatDateTime(t.created_at)} · {t.message_count} messages</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeColor(t.status)}`}>{t.status}</span>
              </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
