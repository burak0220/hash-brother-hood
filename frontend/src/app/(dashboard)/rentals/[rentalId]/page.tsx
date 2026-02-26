'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import { rentalsAPI, reviewsAPI, disputesAPI } from '@/lib/api';
import { formatLTC, formatHashrate, statusBadgeColor, formatDateTime, regionInfo } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import toast from 'react-hot-toast';
import type { Rental, Review, RentalMessage } from '@/types';

/* ── Countdown ─────────────────────────────────────────────────────────────── */
function useCountdown(endsAt: string | null) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Completed'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
}

/* ── Performance Badge ─────────────────────────────────────────────────────── */
function PerfBadge({ pct }: { pct: number }) {
  const color = pct >= 95 ? 'text-green-400 border-green-700 bg-green-900/20'
    : pct >= 80 ? 'text-yellow-400 border-yellow-700 bg-yellow-900/20'
    : 'text-red-400 border-red-700 bg-red-900/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

/* ── Chat Panel (rental-only, active rentals only for sending) ─────────────── */
function RentalChat({ rentalId, userId, isReadOnly }: { rentalId: number; userId: number; isReadOnly: boolean }) {
  const [messages, setMessages] = useState<RentalMessage[]>([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await rentalsAPI.getMessages(rentalId);
      setMessages(data);
    } catch {}
  }, [rentalId]);

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      const { data } = await rentalsAPI.sendMessage(rentalId, content.trim());
      setMessages(prev => [...prev, data]);
      setContent('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send message.');
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-80">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 && (
          <p className="text-dark-500 text-sm text-center pt-8">No messages yet.</p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
              msg.sender_id === userId
                ? 'bg-primary-600 text-white rounded-br-none'
                : 'bg-dark-700 text-dark-100 rounded-bl-none'
            }`}>
              {msg.sender_id !== userId && (
                <p className="text-xs font-medium text-dark-400 mb-0.5">{msg.sender_username}</p>
              )}
              <p>{msg.content}</p>
              <p className={`text-xs mt-1 ${msg.sender_id === userId ? 'text-primary-200' : 'text-dark-500'}`}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {!isReadOnly ? (
        <form onSubmit={send} className="flex gap-2 mt-3 pt-3 border-t border-dark-700">
          <input
            className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            placeholder="Type a message..." value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000}
          />
          <Button type="submit" size="sm" loading={sending} disabled={!content.trim()}>Send</Button>
        </form>
      ) : (
        <p className="text-xs text-dark-500 text-center mt-3 pt-3 border-t border-dark-700">Rental ended — chat is read-only</p>
      )}
    </div>
  );
}

/* ── Pool Edit Modal (5-pool) ──────────────────────────────────────────────── */
function PoolEditModal({ rental, onClose, onSaved }: { rental: Rental; onClose: () => void; onSaved: (r: Rental) => void }) {
  const poolFields = [
    { key: '', label: 'Primary Pool', required: true },
    { key: '2', label: 'Backup Pool 2' },
    { key: '3', label: 'Backup Pool 3' },
    { key: '4', label: 'Backup Pool 4' },
    { key: '5', label: 'Backup Pool 5' },
  ];

  const getField = (key: string, field: string) => {
    const k = key ? `pool${key}_${field}` : `pool_${field}`;
    return (rental as any)[k] || (field === 'password' ? 'x' : '');
  };

  const [pools, setPools] = useState(
    poolFields.map(pf => ({
      url: getField(pf.key, 'url'),
      user: getField(pf.key, 'user'),
      password: getField(pf.key, 'password'),
    }))
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        pool_url: pools[0].url, pool_user: pools[0].user, pool_password: pools[0].password,
      };
      for (let i = 1; i < 5; i++) {
        const n = i + 1;
        if (pools[i].url) {
          payload[`pool${n}_url`] = pools[i].url;
          payload[`pool${n}_user`] = pools[i].user;
          payload[`pool${n}_password`] = pools[i].password;
        }
      }
      const { data } = await rentalsAPI.updatePool(rental.id, payload);
      onSaved(data.rental);
      toast.success('Pool configuration updated.');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update pool.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Edit Pool Configuration</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white text-xl">✕</button>
        </div>
        <form onSubmit={handleSave} className="space-y-5">
          {poolFields.map((pf, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  pf.required ? 'bg-primary-500 text-dark-950' : 'bg-dark-700 text-dark-400'
                }`}>{i + 1}</span>
                <label className="text-sm font-medium text-dark-300">{pf.label}</label>
              </div>
              <div className="space-y-2">
                <Input placeholder="stratum+tcp://pool:port" value={pools[i].url}
                  onChange={(e) => setPools(p => p.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                  required={pf.required} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Wallet / Worker" value={pools[i].user}
                    onChange={(e) => setPools(p => p.map((x, j) => j === i ? { ...x, user: e.target.value } : x))}
                    required={pf.required} />
                  <Input placeholder="Password (x)" value={pools[i].password}
                    onChange={(e) => setPools(p => p.map((x, j) => j === i ? { ...x, password: e.target.value } : x))} />
                </div>
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1">Apply Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Extension Modal ───────────────────────────────────────────────────────── */
function ExtensionModal({ rental, onClose, onExtended }: { rental: Rental; onClose: () => void; onExtended: (r: Rental) => void }) {
  const [hours, setHours] = useState('1');
  const [extending, setExtending] = useState(false);

  const maxExtendable = rental.extensions_disabled ? 0 : 720 - ((rental.original_duration_hours || rental.duration_hours || 0) + rental.extended_hours);
  const extCost = Number(rental.price_per_hour) * parseInt(hours || '0');

  const handleExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    setExtending(true);
    try {
      const { data } = await rentalsAPI.extend(rental.id, parseInt(hours));
      onExtended(data.rental);
      toast.success(`Rental extended by ${hours} hours.`);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to extend rental.');
    }
    setExtending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Extend Rental</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white text-xl">✕</button>
        </div>
        <form onSubmit={handleExtend} className="space-y-4">
          <Input
            label={`Additional hours (max ${maxExtendable}h)`}
            type="number" min="1" max={maxExtendable}
            value={hours} onChange={(e) => setHours(e.target.value)} required
          />
          <div className="bg-dark-800 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Price/Hour</span>
              <span className="text-white">{formatLTC(rental.price_per_hour)} LTC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Extension</span>
              <span className="text-white">{hours}h</span>
            </div>
            <div className="border-t border-dark-600 my-1" />
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-white">Extension Cost</span>
              <span className="text-accent-400">{formatLTC(extCost)} LTC</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" loading={extending} className="flex-1">Purchase Extension</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────────────── */
export default function RentalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const rentalId = Number(params.rentalId);
  const [rental, setRental] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [hashrateStats, setHashrateStats] = useState<any>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'details' | 'pools' | 'chat' | 'performance'>('details');
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [showPoolEdit, setShowPoolEdit] = useState(false);
  const [showExtension, setShowExtension] = useState(false);

  const countdown = useCountdown(rental?.ends_at ?? null);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await rentalsAPI.get(rentalId);
        setRental(data);
        if (data.rig_id) {
          try {
            const { data: reviews } = await reviewsAPI.rigReviews(data.rig_id);
            const myReview = reviews.find((r: Review) => r.rental_id === rentalId && r.reviewer_id === user?.id);
            if (myReview) setExistingReview(myReview);
          } catch {}
        }
        if (data.status === 'active') {
          try {
            const { data: stats } = await rentalsAPI.hashrateStats(rentalId, 24);
            setHashrateStats(stats);
          } catch {}
        }
      } catch {
        toast.error('Unable to load rental details.');
      }
      setLoading(false);
    }
    load();
  }, [rentalId, user?.id]);

  const handleCancel = async () => {
    if (!confirm('Cancel this rental? A partial refund will be calculated.')) return;
    setCancelling(true);
    try {
      const { data } = await rentalsAPI.cancel(rentalId);
      setRental(data);
      toast.success('Rental cancelled. Refund credited.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to cancel.');
    }
    setCancelling(false);
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      const { data } = await reviewsAPI.create({ rental_id: rentalId, rating: reviewRating, comment: reviewComment || undefined });
      setExistingReview(data);
      setShowReview(false);
      toast.success('Review submitted!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to submit review.');
    }
    setSubmittingReview(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!rental) return <Card className="text-center py-12"><p className="text-dark-400">Rental not found</p></Card>;

  const isRenter = rental.renter_id === user?.id;
  const isOwner = rental.owner_id === user?.id;
  const canReview = rental.status === 'completed' && isRenter && !existingReview;
  const canChat = (isRenter || isOwner) && ['active', 'completed'].includes(rental.status);
  const chatReadOnly = rental.status !== 'active';
  const canEditPool = isRenter && rental.status === 'active';
  const canExtend = isRenter && rental.status === 'active' && !rental.extensions_disabled;
  const canDispute = (isRenter || isOwner) && ['active', 'completed'].includes(rental.status);

  // Performance
  const perfPct = rental.performance_percent ? Number(rental.performance_percent) : null;
  const livePct = hashrateStats?.stats?.avg_percentage ? Number(hashrateStats.stats.avg_percentage) : null;
  const displayPct = rental.status === 'active' ? livePct : perfPct;
  const liveHr = hashrateStats?.stats?.avg_hashrate ? Number(hashrateStats.stats.avg_hashrate) : null;
  const actualHr = rental.actual_hashrate_avg ? Number(rental.actual_hashrate_avg) : null;
  const displayHr = rental.status === 'active' ? liveHr : actualHr;

  // Pool display helper
  const poolSlots = [
    { label: 'Primary', url: rental.pool_url, user: rental.pool_user },
    { label: 'Backup 2', url: rental.pool2_url, user: rental.pool2_user },
    { label: 'Backup 3', url: rental.pool3_url, user: rental.pool3_user },
    { label: 'Backup 4', url: rental.pool4_url, user: rental.pool4_user },
    { label: 'Backup 5', url: rental.pool5_url, user: rental.pool5_user },
  ].filter(p => p.url);

  const tabs = [
    { key: 'details', label: 'Details' },
    { key: 'pools', label: `Pools (${poolSlots.length})` },
    ...(canChat ? [{ key: 'chat', label: 'Communications' }] : []),
    ...(['active', 'completed'].includes(rental.status) ? [{ key: 'performance', label: 'Performance' }] : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {showPoolEdit && <PoolEditModal rental={rental} onClose={() => setShowPoolEdit(false)} onSaved={(r) => setRental(r)} />}
      {showExtension && <ExtensionModal rental={rental} onClose={() => setShowExtension(false)} onExtended={(r) => setRental(r)} />}

      <button onClick={() => router.back()} className="text-dark-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Rental #{rental.id}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium border ${statusBadgeColor(rental.status)}`}>{rental.status}</span>
            {rental.rpi_at_start && (
              <span className="text-xs text-dark-500">RPI at start: {Number(rental.rpi_at_start).toFixed(0)}</span>
            )}
            {rental.status === 'active' && rental.ends_at && (
              <span className="text-sm text-dark-400">
                Ends in: <span className="text-white font-mono font-medium">{countdown}</span>
              </span>
            )}
          </div>
          {/* Extension info */}
          {rental.extended_hours > 0 && (
            <p className="text-xs text-primary-400 mt-1">
              Extended: +{rental.extended_hours}h ({formatLTC(rental.extension_cost)} LTC)
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canExtend && <Button size="sm" onClick={() => setShowExtension(true)}>Extend Rental</Button>}
          {canEditPool && <Button variant="secondary" size="sm" onClick={() => setShowPoolEdit(true)}>Edit Pools</Button>}
          {canDispute && !showDispute && (
            <Button variant="danger" size="sm" onClick={() => setShowDispute(true)}>Open Dispute</Button>
          )}
          {canReview && !showReview && <Button size="sm" onClick={() => setShowReview(true)}>Leave Review</Button>}
        </div>
      </div>

      {/* ── Connect Your Miner (renter + active only) ── */}
      {isRenter && rental.status === 'active' && rental.renter && (
        <div className="bg-gradient-to-r from-green-900/20 to-dark-900 border border-green-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <h2 className="text-base font-bold text-green-400">Connect Your Miner</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Stratum URL */}
            <div>
              <p className="text-xs text-dark-500 uppercase tracking-wider mb-1">Stratum URL</p>
              <div className="flex items-center gap-2 bg-dark-800 rounded-lg px-3 py-2.5">
                <span className="font-mono text-sm text-white flex-1 select-all">
                  stratum+tcp://{process.env.NEXT_PUBLIC_STRATUM_HOST || 'stratum.hashbrotherhood.com'}:{process.env.NEXT_PUBLIC_STRATUM_PORT || '3333'}
                </span>
                <button
                  onClick={() => { navigator.clipboard.writeText(`stratum+tcp://${process.env.NEXT_PUBLIC_STRATUM_HOST || 'stratum.hashbrotherhood.com'}:${process.env.NEXT_PUBLIC_STRATUM_PORT || '3333'}`); toast.success('Copied!'); }}
                  className="text-dark-500 hover:text-white transition-colors shrink-0"
                  title="Copy"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
              </div>
            </div>
            {/* Worker */}
            <div>
              <p className="text-xs text-dark-500 uppercase tracking-wider mb-1">Worker Name</p>
              <div className="flex items-center gap-2 bg-dark-800 rounded-lg px-3 py-2.5">
                <span className="font-mono text-sm text-primary-400 flex-1 select-all">
                  {rental.renter.username}.{rental.rig_id}
                </span>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${rental.renter!.username}.${rental.rig_id}`); toast.success('Copied!'); }}
                  className="text-dark-500 hover:text-white transition-colors shrink-0"
                  title="Copy"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
              </div>
            </div>
            {/* Password */}
            <div>
              <p className="text-xs text-dark-500 uppercase tracking-wider mb-1">Password</p>
              <div className="bg-dark-800 rounded-lg px-3 py-2.5">
                <span className="font-mono text-sm text-dark-300">x</span>
              </div>
            </div>
            {/* Quick cgminer example */}
            <div>
              <p className="text-xs text-dark-500 uppercase tracking-wider mb-1">Example (cgminer / xmrig)</p>
              <div className="bg-dark-800 rounded-lg px-3 py-2.5 overflow-x-auto">
                <span className="font-mono text-xs text-dark-400 whitespace-nowrap">
                  -o stratum+tcp://...:{process.env.NEXT_PUBLIC_STRATUM_PORT || '3333'} -u {rental.renter.username}.{rental.rig_id} -p x
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-dark-500 mt-3">
            Your miner connects to our proxy — it automatically routes to your configured pool.
          </p>
        </div>
      )}

      {/* Refund Banner */}
      {rental.refund_amount > 0 && (
        <div className="p-4 bg-green-900/10 border border-green-700/30 rounded-lg">
          <p className="text-sm text-green-400 font-medium">
            💰 Auto-Refund: {formatLTC(rental.refund_amount)} LTC
          </p>
          {rental.refund_reason && <p className="text-xs text-green-300/70 mt-1">{rental.refund_reason}</p>}
          {rental.reviewed_at && <p className="text-xs text-dark-500 mt-1">Reviewed at: {formatDateTime(rental.reviewed_at)}</p>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-dark-700 pb-px">
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-dark-800 text-primary-400 border-b-2 border-primary-400'
                : 'text-dark-400 hover:text-white'
            }`}
          >{tab.label}</button>
        ))}
      </div>

      {/* Tab: Details */}
      {activeTab === 'details' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Rental Info</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Rig', value: rental.rig_name || `#${rental.rig_id}` },
                  { label: 'Algorithm', value: rental.algorithm_name || '-' },
                  { label: 'Hashrate', value: rental.hashrate.toString() },
                  { label: 'Duration', value: `${rental.duration_hours}h${rental.extended_hours > 0 ? ` (orig: ${rental.original_duration_hours}h + ext: ${rental.extended_hours}h)` : ''}` },
                  { label: 'Price/Hour', value: `${formatLTC(rental.price_per_hour)} LTC` },
                  { label: 'Total Cost', value: `${formatLTC(rental.total_cost)} LTC` },
                  { label: 'Renter', value: rental.renter?.username || '-' },
                  { label: 'Owner', value: rental.owner?.username || '-' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-dark-400">{item.label}</span>
                    <span className="text-white font-medium">{item.value}</span>
                  </div>
                ))}
                {/* Region row */}
                <div className="flex justify-between text-sm">
                  <span className="text-dark-400">Region</span>
                  <span className="text-white font-medium flex items-center gap-1.5">
                    <span className="text-base leading-none">{regionInfo(rental.rig_region).flag}</span>
                    {regionInfo(rental.rig_region).label}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Timestamps</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Created', value: formatDateTime(rental.created_at) },
                  { label: 'Started', value: rental.started_at ? formatDateTime(rental.started_at) : '-' },
                  { label: 'Ends', value: rental.ends_at ? formatDateTime(rental.ends_at) : '-' },
                  { label: 'Completed', value: rental.completed_at ? formatDateTime(rental.completed_at) : '-' },
                  { label: 'Review Window Ends', value: rental.dispute_window_ends ? formatDateTime(rental.dispute_window_ends) : '-' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-dark-400">{item.label}</span>
                    <span className="text-white font-medium text-xs">{item.value}</span>
                  </div>
                ))}
              </div>
              {/* Share info */}
              {(rental.expected_shares > 0 || rental.actual_shares > 0) && (
                <div className="mt-4 pt-4 border-t border-dark-700 space-y-2">
                  <p className="text-xs text-dark-400 font-medium uppercase tracking-wider">Share Tracking</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Expected</span>
                    <span className="text-white">{rental.expected_shares.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Accepted</span>
                    <span className="text-green-400">{rental.actual_shares.toLocaleString()}</span>
                  </div>
                  {rental.rejected_shares > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Rejected</span>
                      <span className="text-red-400">{rental.rejected_shares.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Pools */}
      {activeTab === 'pools' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pool Configuration ({poolSlots.length}/5)</CardTitle>
              {canEditPool && (
                <Button size="sm" variant="secondary" onClick={() => setShowPoolEdit(true)}>Edit Pools</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {poolSlots.map((pool, i) => (
                <div key={i} className="bg-dark-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      i === 0 ? 'bg-primary-500 text-dark-950' : 'bg-dark-600 text-dark-400'
                    }`}>{i + 1}</span>
                    <span className="text-xs font-medium text-dark-300">{pool.label}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-500">URL</span>
                      <span className="text-white font-mono text-xs truncate max-w-[70%]">{pool.url}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-500">User</span>
                      <span className="text-white font-mono text-xs truncate max-w-[70%]">{pool.user}</span>
                    </div>
                  </div>
                </div>
              ))}
              {poolSlots.length === 0 && <p className="text-dark-500 text-sm text-center py-4">No pools configured</p>}
              <p className="text-xs text-dark-500">Pools are tried in order. If the primary pool fails, hashrate moves to the next available backup.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Chat */}
      {activeTab === 'chat' && canChat && (
        <Card>
          <CardHeader>
            <CardTitle>
              Communications with {isRenter ? rental.owner?.username || 'Owner' : rental.renter?.username || 'Renter'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RentalChat rentalId={rentalId} userId={user?.id || 0} isReadOnly={chatReadOnly} />
          </CardContent>
        </Card>
      )}

      {/* Tab: Performance */}
      {activeTab === 'performance' && ['active', 'completed'].includes(rental.status) && (
        <Card>
          <CardHeader><CardTitle>Hashrate Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-dark-800 rounded-lg p-4 text-center">
                <p className="text-xs text-dark-400 mb-1">Expected</p>
                <p className="text-lg font-bold text-white">{Number(rental.hashrate).toFixed(2)}</p>
                <p className="text-xs text-dark-500">advertised</p>
              </div>
              <div className="bg-dark-800 rounded-lg p-4 text-center">
                <p className="text-xs text-dark-400 mb-1">Actual (avg)</p>
                <p className="text-lg font-bold text-white">{displayHr !== null ? displayHr.toFixed(2) : '—'}</p>
                <p className="text-xs text-dark-500">{rental.status === 'active' ? 'last 24h' : 'total avg'}</p>
              </div>
              <div className="bg-dark-800 rounded-lg p-4 text-center">
                <p className="text-xs text-dark-400 mb-1">Delivery</p>
                <div className="flex items-center justify-center">
                  {displayPct !== null ? <PerfBadge pct={displayPct} /> : <span className="text-dark-500 text-sm">—</span>}
                </div>
                <p className="text-xs text-dark-500 mt-1">actual / expected</p>
              </div>
            </div>

            {/* Hashrate Chart */}
            {hashrateStats?.logs && hashrateStats.logs.length > 0 && (
              <div className="bg-dark-800 rounded-lg p-4 mb-4">
                <p className="text-xs text-dark-400 mb-3">Hashrate Over Time</p>
                <div className="h-40 flex items-end gap-px">
                  {hashrateStats.logs.slice(-48).map((log: any, i: number) => {
                    const maxHr = Math.max(...hashrateStats.logs.slice(-48).map((l: any) => l.measured_hashrate || 0), Number(rental.hashrate));
                    const pct = maxHr > 0 ? ((log.measured_hashrate || 0) / maxHr) * 100 : 0;
                    const isLow = (log.measured_hashrate || 0) < Number(rental.hashrate) * 0.95;
                    return (
                      <div key={i} className="flex-1 flex flex-col justify-end" title={`${Number(log.measured_hashrate).toFixed(2)} @ ${log.recorded_at || ''}`}>
                        <div className={`rounded-t ${isLow ? 'bg-red-500/70' : 'bg-primary-500/70'}`}
                          style={{ height: `${Math.max(pct, 2)}%` }} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-dark-500">oldest</span>
                  <span className="text-xs text-dark-500">latest</span>
                </div>
                {/* Expected hashrate line reference */}
                <p className="text-xs text-dark-500 mt-2">🔵 blue = above 95% | 🔴 red = below 95% of advertised</p>
              </div>
            )}

            {/* Escrow Info */}
            {rental.escrow_amount > 0 && (
              <div className="p-3 bg-dark-800 rounded-lg mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-dark-400">Escrow Amount</span>
                  <span className="text-yellow-400 font-medium">{formatLTC(rental.escrow_amount)} LTC</span>
                </div>
                <p className="text-xs text-dark-500 mt-1">
                  {rental.escrow_released ? '✅ Released to owner' : '🔒 Locked until review window ends (12h after completion)'}
                </p>
              </div>
            )}

            {displayPct !== null && displayPct < 95 && (
              <div className="p-3 bg-yellow-900/10 border border-yellow-700/20 rounded-lg">
                <p className="text-xs text-yellow-400">
                  ⚠ Hashrate delivery is below 95%. After the 12-hour review window, an automatic refund will be calculated based on the delivery shortfall.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Review Form */}
      {showReview && (
        <Card>
          <CardHeader><CardTitle>Leave a Review</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} type="button" onClick={() => setReviewRating(star)}
                      className={`text-2xl transition-colors ${star <= reviewRating ? 'text-yellow-400' : 'text-dark-600 hover:text-dark-400'}`}>★</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Comment (optional)</label>
                <textarea
                  className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 min-h-[80px]"
                  value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="How was your experience?" maxLength={2000}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowReview(false)}>Cancel</Button>
                <Button onClick={handleSubmitReview} loading={submittingReview}>Submit Review</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Review */}
      {existingReview && (
        <Card>
          <CardHeader><CardTitle>Your Review</CardTitle></CardHeader>
          <CardContent>
            <span className="text-yellow-400">{'★'.repeat(existingReview.rating)}{'☆'.repeat(5 - existingReview.rating)}</span>
            {existingReview.comment && <p className="text-sm text-dark-300 mt-2">{existingReview.comment}</p>}
          </CardContent>
        </Card>
      )}

      {/* Dispute Form */}
      {showDispute && (
        <Card>
          <CardHeader><CardTitle>Open a Dispute</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4 max-w-lg">
              <textarea
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 min-h-[80px]"
                value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Describe the issue..." maxLength={2000}
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowDispute(false)}>Cancel</Button>
                <Button loading={submittingDispute} disabled={disputeReason.length < 10}
                  onClick={async () => {
                    setSubmittingDispute(true);
                    try {
                      await disputesAPI.create({ rental_id: rentalId, reason: disputeReason });
                      toast.success('Dispute filed.');
                      router.push('/disputes');
                    } catch (err: any) {
                      toast.error(err.response?.data?.detail || 'Unable to file dispute.');
                    }
                    setSubmittingDispute(false);
                  }}>Submit Dispute</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
