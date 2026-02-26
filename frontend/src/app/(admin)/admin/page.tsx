'use client';
import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Tabs from '@/components/ui/tabs';
import { adminAPI } from '@/lib/api';
import { formatLTC, statusBadgeColor, formatDateTime, truncateAddress } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { User, Transaction, AdminStats, PlatformSetting, Algorithm } from '@/types';

/* ── Admin Support Tab ─────────────────────────────────────────────────────── */
function AdminSupportTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.supportTickets().then(({ data }) => { setTickets(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleResolve = async (id: number) => {
    try {
      await adminAPI.resolveTicket(id);
      toast.success('Ticket resolved');
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'resolved' } : t));
      if (selected?.id === id) setSelected({ ...selected, status: 'resolved' });
    } catch { toast.error('Failed'); }
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    try {
      await adminAPI.addSupportMessage(selected.id, reply);
      setReply('');
      const { data } = await adminAPI.supportTickets();
      setTickets(data);
      const refreshed = data.find((t: any) => t.id === selected.id);
      if (refreshed) setSelected(refreshed);
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="text-center py-8 text-dark-400">Loading...</div>;
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle>Tickets ({tickets.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {tickets.map(t => (
              <div key={t.id} onClick={() => setSelected(t)}
                className={`p-3 rounded-lg cursor-pointer border transition-colors ${selected?.id === t.id ? 'border-primary-500 bg-dark-800' : 'border-dark-600/20 bg-dark-800/50 hover:bg-dark-800'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-white">#{t.id} {t.subject}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full border ${statusBadgeColor(t.status)}`}>{t.status}</span>
                </div>
                <p className="text-xs text-dark-400">{t.username} · {t.category} · {formatDateTime(t.created_at)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {selected && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>#{selected.id} — {selected.subject}</CardTitle>
              {selected.status !== 'resolved' && (
                <Button size="sm" onClick={() => handleResolve(selected.id)}>Resolve</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto mb-3">
              {(selected.messages || []).map((m: any) => (
                <div key={m.id} className={`p-2 rounded-lg ${m.is_internal ? 'bg-yellow-900/10 border border-yellow-700/20' : 'bg-dark-800'}`}>
                  <div className="flex justify-between text-xs text-dark-400 mb-1">
                    <span className="font-medium text-primary-400">{m.sender_name}</span>
                    <span>{formatDateTime(m.created_at)}</span>
                  </div>
                  <p className="text-sm text-white">{m.message}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply..."
                onKeyDown={(e) => e.key === 'Enter' && handleReply()} />
              <Button size="sm" onClick={handleReply}>Send</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Admin Disputes Tab ─────────────────────────────────────────────────────── */
function AdminDisputesTab() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [resolution, setResolution] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.disputes().then(({ data }) => { setDisputes(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const loadDetail = async (id: number) => {
    try {
      const { data } = await adminAPI.disputeDetail(id);
      setSelected(data);
    } catch { toast.error('Failed to load dispute'); }
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    try {
      await adminAPI.disputeMessage(selected.id, reply);
      setReply('');
      loadDetail(selected.id);
    } catch { toast.error('Failed'); }
  };

  const handleResolve = async (action: string) => {
    if (!selected || !resolution.trim()) return;
    try {
      await adminAPI.resolveDispute(selected.id, {
        action,
        resolution,
        refund_amount: refundAmount ? parseFloat(refundAmount) : undefined,
      });
      toast.success('Dispute resolved');
      setSelected({ ...selected, status: 'resolved' });
      setDisputes(prev => prev.map(d => d.id === selected.id ? { ...d, status: 'resolved' } : d));
      setResolution('');
      setRefundAmount('');
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <div className="text-center py-8 text-dark-400">Loading...</div>;
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle>Disputes ({disputes.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {disputes.map(d => (
              <button key={d.id} onClick={() => loadDetail(d.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${selected?.id === d.id ? 'border-primary-400/30 bg-primary-400/5' : 'border-dark-700 hover:border-dark-500'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-white">#{d.id} — Rental #{d.rental_id}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${d.status === 'open' ? 'text-yellow-400 border-yellow-400/30' : 'text-green-400 border-green-400/30'}`}>{d.status}</span>
                </div>
                <p className="text-xs text-dark-400 mt-1">By: {d.opener_username} · {new Date(d.created_at).toLocaleDateString()}</p>
                <p className="text-xs text-dark-300 mt-0.5 line-clamp-1">{d.reason}</p>
              </button>
            ))}
            {disputes.length === 0 && <p className="text-dark-500 text-sm text-center py-4">No disputes</p>}
          </div>
        </CardContent>
      </Card>
      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Dispute #{selected.id} — {selected.status}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Quick Links */}
              <div className="flex gap-2">
                {selected.rig_id && (
                  <a href={`/marketplace/${selected.rig_id}`} target="_blank"
                    className="text-xs px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all">
                    ⚡ Go to Rig #{selected.rig_id}
                  </a>
                )}
                <a href={`/rentals/${selected.rental_id}`} target="_blank"
                  className="text-xs px-3 py-1.5 bg-primary-500/10 border border-primary-500/30 text-primary-400 rounded-lg hover:bg-primary-500/20 transition-all">
                  📋 Rental #{selected.rental_id}
                </a>
              </div>
              <div className="bg-dark-800 p-3 rounded-lg">
                <p className="text-xs text-dark-400 mb-1">Reason</p>
                <p className="text-sm text-white">{selected.reason}</p>
              </div>
              {/* Messages */}
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {(selected.messages || []).map((m: any) => (
                  <div key={m.id} className="bg-dark-800/60 p-2 rounded-lg">
                    <span className="text-xs font-semibold text-primary-400">{m.sender}</span>
                    <p className="text-xs text-dark-200 mt-0.5">{m.content}</p>
                  </div>
                ))}
              </div>
              {/* Reply */}
              <div className="flex gap-2">
                <input className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Message..."
                  onKeyDown={(e) => e.key === 'Enter' && handleReply()} />
                <Button size="sm" onClick={handleReply}>Send</Button>
              </div>
              {/* Resolve */}
              {selected.status === 'open' && (
                <div className="border-t border-dark-700 pt-3 space-y-2">
                  <Input label="Resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Describe resolution..." />
                  <Input label="Refund to Renter (optional)" type="number" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="0.00" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleResolve('resolve')}>Resolve</Button>
                    <Button size="sm" variant="secondary" onClick={() => handleResolve('refund_renter')}>Resolve + Refund</Button>
                  </div>
                </div>
              )}
              {selected.resolution && (
                <div className="bg-green-400/10 border border-green-400/20 p-3 rounded-lg">
                  <p className="text-xs text-green-400 font-semibold">Resolution</p>
                  <p className="text-sm text-green-300">{selected.resolution}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [withdrawals, setWithdrawals] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [rigs, setRigs] = useState<any[]>([]);
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Notification form
  const [notifUserId, setNotifUserId] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifSending, setNotifSending] = useState(false);

  // Balance adjust
  const [adjustUserId, setAdjustUserId] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Pending actions
  const [pendingActions, setPendingActions] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, usersRes, withdrawRes, settingsRes, pendingRes] = await Promise.all([
          adminAPI.stats(),
          adminAPI.users(),
          adminAPI.pendingWithdrawals(),
          adminAPI.settings(),
          adminAPI.pendingActions(),
        ]);
        setStats(statsRes.data);
        setUsers(usersRes.data);
        setWithdrawals(withdrawRes.data);
        setSettings(settingsRes.data);
        setPendingActions(pendingRes.data);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  // Lazy load tabs
  useEffect(() => {
    if (tab === 'rigs' && rigs.length === 0) {
      adminAPI.rigs({ per_page: 50 }).then(({ data }) => setRigs(data.items)).catch(() => {});
    }
    if (tab === 'algorithms' && algorithms.length === 0) {
      adminAPI.algorithms().then(({ data }) => setAlgorithms(data)).catch(() => {});
    }
    if (tab === 'rentals' && rentals.length === 0) {
      adminAPI.rentals({ per_page: 50 }).then(({ data }) => setRentals(data.items)).catch(() => {});
    }
    if (tab === 'transactions' && transactions.length === 0) {
      adminAPI.transactions({ per_page: 50 }).then(({ data }) => setTransactions(data.items)).catch(() => {});
    }
    if (tab === 'audit' && auditLogs.length === 0) {
      adminAPI.auditLogs({ per_page: 50 }).then(({ data }) => setAuditLogs(data.items)).catch(() => {});
    }
    if (tab === 'withdrawals' && !walletBalance) {
      loadWalletBalance();
    }
  }, [tab]);

  const [walletBalance, setWalletBalance] = useState<{ ltc_balance: number } | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const loadWalletBalance = async () => {
    try {
      const { data } = await adminAPI.walletBalance();
      setWalletBalance(data);
    } catch {}
  };

  const handleApproveWithdrawal = async (id: number) => {
    if (!confirm('Approve and auto-send LTC?')) return;
    setApprovingId(id);
    try {
      const { data } = await adminAPI.approveWithdrawal(id);
      setWithdrawals((prev) => prev.filter((w) => w.id !== id));
      toast.success(`Withdrawal approved and sent! TX: ${data.tx_hash ? data.tx_hash.slice(0, 16) + '...' : 'sent'}`);
      loadWalletBalance();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'LTC transfer failed - withdrawal remains pending'); }
    setApprovingId(null);
  };

  const handleRejectWithdrawal = async (id: number) => {
    try {
      await adminAPI.rejectWithdrawal(id);
      setWithdrawals((prev) => prev.filter((w) => w.id !== id));
      toast.success('Withdrawal rejected & refunded');
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleToggleUser = async (userId: number, isActive: boolean) => {
    try {
      const { data } = await adminAPI.updateUser(userId, { is_active: !isActive });
      setUsers((prev) => prev.map((u) => (u.id === userId ? data : u)));
      toast.success(`User ${isActive ? 'disabled' : 'enabled'}`);
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAdjustBalance = async () => {
    if (!adjustUserId || !adjustAmount) return;
    try {
      const { data } = await adminAPI.adjustBalance(adjustUserId, {
        amount: parseFloat(adjustAmount),
        reason: adjustReason,
      });
      toast.success(`Balance adjusted. New: ${data.new_balance} LTC`);
      setAdjustUserId(null);
      setAdjustAmount('');
      setAdjustReason('');
      // Refresh users
      adminAPI.users().then(({ data }) => setUsers(data)).catch(() => {});
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleDeleteRig = async (id: number) => {
    if (!confirm('Delete this rig?')) return;
    try {
      await adminAPI.deleteRig(id);
      setRigs((prev) => prev.filter((r) => r.id !== id));
      toast.success('Rig deleted');
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleToggleFeature = async (id: number) => {
    try {
      const { data } = await adminAPI.toggleFeatureRig(id);
      setRigs((prev) => prev.map((r) => r.id === id ? { ...r, is_featured: data.is_featured } : r));
      toast.success(data.message);
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleToggleAlgorithm = async (id: number, isActive: boolean) => {
    try {
      const { data } = await adminAPI.updateAlgorithm(id, { is_active: !isActive });
      setAlgorithms((prev) => prev.map((a) => a.id === id ? data : a));
      toast.success(`Algorithm ${isActive ? 'deactivated' : 'activated'}`);
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleDeleteAlgorithm = async (id: number) => {
    if (!confirm('Delete this algorithm?')) return;
    try {
      await adminAPI.deleteAlgorithm(id);
      setAlgorithms((prev) => prev.filter((a) => a.id !== id));
      toast.success('Algorithm deleted');
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleCancelRental = async (id: number) => {
    if (!confirm('Cancel this rental and refund?')) return;
    try {
      await adminAPI.cancelRental(id);
      setRentals((prev) => prev.map((r) => r.id === id ? { ...r, status: 'cancelled' } : r));
      toast.success('Rental cancelled & refunded');
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleReviewRental = async (id: number, action: string, refundAmount?: number) => {
    const reason = action === 'approve_refund' ? 'Admin approved' : prompt(`Reason for ${action}:`) || '';
    try {
      const { data } = await adminAPI.reviewRental(id, {
        action,
        refund_amount: refundAmount,
        reason,
      });
      toast.success(data.message);
      // Refresh rentals
      adminAPI.rentals({ per_page: 50 }).then(({ data }) => setRentals(data.items)).catch(() => {});
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleRPIOverride = async (rigId: number) => {
    const score = prompt('Enter new RPI score (0-100):');
    if (!score) return;
    const reason = prompt('Reason for override:') || 'Admin override';
    try {
      const { data } = await adminAPI.overrideRPI(rigId, { rpi_score: parseFloat(score), reason });
      toast.success(data.message);
      setRigs(prev => prev.map(r => r.id === rigId ? { ...r, rpi_score: parseFloat(score) } : r));
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleRigCorrection = async (rigId: number) => {
    const action = prompt('What to correct? (hashrate / status / both):');
    if (!action) return;
    const updates: any = { reason: prompt('Reason:') || 'Admin correction' };
    if (action.includes('hashrate') || action === 'both') {
      const hr = prompt('New hashrate:');
      if (hr) updates.hashrate = parseFloat(hr);
    }
    if (action.includes('status') || action === 'both') {
      const st = prompt('New status (active/inactive/maintenance/disabled):');
      if (st) updates.status = st;
    }
    try {
      const { data } = await adminAPI.correctRig(rigId, updates);
      toast.success(data.message);
      adminAPI.rigs({ per_page: 50 }).then(({ data }) => setRigs(data.items)).catch(() => {});
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleSendNotification = async () => {
    if (!notifTitle || !notifMessage) return;
    setNotifSending(true);
    try {
      const { data } = await adminAPI.sendNotification({
        user_id: notifUserId ? parseInt(notifUserId) : undefined,
        title: notifTitle,
        message: notifMessage,
      });
      toast.success(data.message);
      setNotifTitle('');
      setNotifMessage('');
      setNotifUserId('');
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
    setNotifSending(false);
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      const { data } = await adminAPI.updateSetting(key, value);
      setSettings((prev) => prev.map((s) => (s.key === key ? data : s)));
      toast.success('Setting updated');
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden neon-card rounded-2xl p-6">
        <div className="absolute top-0 right-0 w-60 h-60 bg-neon-gold/5 rounded-full blur-[80px]" />
        <div className="relative">
          <p className="text-xs text-neon-gold font-medium uppercase tracking-[0.3em] mb-1">Administration</p>
          <h1 className="text-2xl font-black text-white">Admin Panel</h1>
          <p className="text-dark-400 text-sm mt-1">Full platform management and control</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'overview', label: pendingActions?.total ? `Overview (${pendingActions.total})` : 'Overview' },
          { id: 'users', label: 'Users' },
          { id: 'rigs', label: 'Rigs' },
          { id: 'rentals', label: pendingActions?.pending_escrows ? `Rentals (${pendingActions.pending_escrows})` : 'Rentals' },
          { id: 'disputes', label: pendingActions?.pending_disputes ? `Disputes (${pendingActions.pending_disputes})` : 'Disputes' },
          { id: 'algorithms', label: 'Algorithms' },
          { id: 'withdrawals', label: pendingActions?.pending_withdrawals ? `Withdrawals (${pendingActions.pending_withdrawals})` : 'Withdrawals' },
          { id: 'transactions', label: 'Transactions' },
          { id: 'notifications', label: 'Notifications' },
          { id: 'audit', label: 'Audit Logs' },
          { id: 'support', label: pendingActions?.open_tickets ? `Support (${pendingActions.open_tickets})` : 'Support' },
          { id: 'settings', label: 'Settings' },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {/* ===== OVERVIEW ===== */}
      {tab === 'overview' && stats && (
        <>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Total Users', value: stats.total_users, color: 'text-primary-400', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
            { label: 'Total Rigs', value: stats.total_rigs, color: 'text-blue-400', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
            { label: 'Total Rentals', value: stats.total_rentals, color: 'text-green-400', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'Active Rentals', value: stats.active_rentals, color: 'text-yellow-400', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
            { label: 'Total Revenue', value: `${formatLTC(stats.total_revenue)} LTC`, color: 'text-accent-400', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'Pending Withdrawals', value: stats.pending_withdrawals, color: 'text-red-400', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
          ].map((stat) => (
            <div key={stat.label} className="group neon-card rounded-xl p-5 hover:border-primary-400/20 transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <p className="text-dark-400 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
                <svg className={`w-5 h-5 ${stat.color} opacity-60`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                </svg>
              </div>
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
        {/* Pending Actions */}
        {pendingActions && pendingActions.total > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              Pending Actions ({pendingActions.total})
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Withdrawals', count: pendingActions.pending_withdrawals, tab: 'withdrawals', color: 'text-red-400 border-red-400/30' },
                { label: 'Disputes', count: pendingActions.pending_disputes, tab: 'disputes', color: 'text-yellow-400 border-yellow-400/30' },
                { label: 'Escrow Review', count: pendingActions.pending_escrows, tab: 'rentals', color: 'text-orange-400 border-orange-400/30' },
                { label: 'Support Tickets', count: pendingActions.open_tickets, tab: 'support', color: 'text-blue-400 border-blue-400/30' },
              ].filter(a => a.count > 0).map(a => (
                <button key={a.label} onClick={() => setTab(a.tab)}
                  className={`p-3 rounded-lg border ${a.color} bg-dark-900/50 hover:bg-dark-800 transition-all text-left`}>
                  <p className="text-2xl font-black">{a.count}</p>
                  <p className="text-xs mt-1 opacity-70">{a.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}
        </>
      )}

      {/* ===== DISPUTES ===== */}
      {tab === 'disputes' && <AdminDisputesTab />}

      {/* ===== USERS ===== */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Balance Adjust Modal */}
          {adjustUserId && (
            <Card className="border-neon-gold/30">
              <CardHeader><CardTitle>Adjust Balance - User #{adjustUserId}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-3 items-end">
                  <Input label="Amount (+ or -)" type="number" step="0.01" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="e.g., 50 or -20" />
                  <Input label="Reason" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Admin deposit" />
                  <Button onClick={handleAdjustBalance}>Apply</Button>
                  <Button variant="secondary" onClick={() => setAdjustUserId(null)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    {['ID', 'Username', 'Email', 'Role', 'Balance', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-dark-300">{u.id}</td>
                      <td className="px-4 py-3 text-sm text-white font-medium">{u.username}</td>
                      <td className="px-4 py-3 text-sm text-dark-300">{u.email}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-neon-gold/20 text-neon-gold' : 'bg-dark-700 text-dark-300'}`}>{u.role}</span></td>
                      <td className="px-4 py-3 text-sm text-accent-400 font-medium">{formatLTC(u.balance)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${u.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setAdjustUserId(u.id)}>Balance</Button>
                          <Button size="sm" variant={u.is_active ? 'danger' : 'primary'} onClick={() => handleToggleUser(u.id, u.is_active)}>{u.is_active ? 'Disable' : 'Enable'}</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ===== RIGS ===== */}
      {tab === 'rigs' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  {['ID', 'Name', 'Owner', 'Algorithm', 'Hashrate', 'Price/h', 'RPI', 'Status', 'Featured', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rigs.map((r) => (
                  <tr key={r.id} className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors">
                    <td className="px-3 py-3 text-sm text-dark-300">{r.id}</td>
                    <td className="px-3 py-3 text-sm text-white font-medium">{r.name}</td>
                    <td className="px-3 py-3 text-sm text-dark-300">{r.owner_username}</td>
                    <td className="px-3 py-3 text-sm text-primary-400">{r.algorithm_name}</td>
                    <td className="px-3 py-3 text-sm text-white">{r.hashrate}</td>
                    <td className="px-3 py-3 text-sm text-accent-400">{formatLTC(r.price_per_hour)}</td>
                    <td className="px-3 py-3 text-sm">
                      <span className={`font-semibold ${
                        Number(r.rpi_score) >= 90 ? 'text-green-400' :
                        Number(r.rpi_score) >= 75 ? 'text-yellow-400' :
                        Number(r.rpi_score) >= 60 ? 'text-orange-400' : 'text-red-400'
                      }`}>{Number(r.rpi_score || 100).toFixed(0)}</span>
                    </td>
                    <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeColor(r.status)}`}>{r.status}</span></td>
                    <td className="px-3 py-3">{r.is_featured ? <span className="text-neon-gold text-xs font-bold">FEATURED</span> : <span className="text-dark-500 text-xs">-</span>}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="secondary" onClick={() => handleToggleFeature(r.id)}>{r.is_featured ? 'Unfeature' : 'Feature'}</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleRPIOverride(r.id)}>RPI</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleRigCorrection(r.id)}>Correct</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteRig(r.id)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rigs.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-dark-500 text-sm">No rigs found</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ===== RENTALS ===== */}
      {tab === 'rentals' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  {['ID', 'Rig', 'Renter', 'Duration', 'Cost', 'Perf%', 'Refund', 'Status', 'Review', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rentals.map((r) => (
                  <tr key={r.id} className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors">
                    <td className="px-3 py-3 text-sm text-dark-300">{r.id}</td>
                    <td className="px-3 py-3 text-sm text-white">#{r.rig_id}</td>
                    <td className="px-3 py-3 text-sm text-dark-300">#{r.renter_id}</td>
                    <td className="px-3 py-3 text-sm text-white">{r.duration_hours}h{r.extended_hours > 0 ? ` (+${r.extended_hours}h)` : ''}</td>
                    <td className="px-3 py-3 text-sm text-accent-400">{formatLTC(r.total_cost)}</td>
                    <td className="px-3 py-3 text-sm">
                      {r.performance_percent != null ? (
                        <span className={Number(r.performance_percent) >= 95 ? 'text-green-400' : Number(r.performance_percent) >= 80 ? 'text-yellow-400' : 'text-red-400'}>
                          {Number(r.performance_percent).toFixed(1)}%
                        </span>
                      ) : <span className="text-dark-500">—</span>}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {r.refund_amount > 0 ? (
                        <span className="text-orange-400">{formatLTC(r.refund_amount)}</span>
                      ) : <span className="text-dark-500">—</span>}
                    </td>
                    <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeColor(r.status)}`}>{r.status}</span></td>
                    <td className="px-3 py-3 text-xs">
                      {r.reviewed_at ? (
                        <span className="text-green-400">✓ Reviewed</span>
                      ) : r.status === 'completed' ? (
                        <span className="text-yellow-400">Pending</span>
                      ) : <span className="text-dark-500">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(r.status === 'active' || r.status === 'pending') && (
                          <Button size="sm" variant="danger" onClick={() => handleCancelRental(r.id)}>Cancel</Button>
                        )}
                        {r.status === 'completed' && !r.reviewed_at && (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => handleReviewRental(r.id, 'approve_refund')}>Approve</Button>
                            <Button size="sm" variant="danger" onClick={() => handleReviewRental(r.id, 'reject_refund')}>Reject</Button>
                            <Button size="sm" onClick={() => {
                              const amt = prompt(`Adjust refund for rental #${r.id}\nCurrent: ${r.refund_amount || 0} LTC\nEnter new amount:`);
                              if (amt) handleReviewRental(r.id, 'adjust_refund', parseFloat(amt));
                            }}>Adjust</Button>
                          </>
                        )}
                        {r.status === 'completed' && (
                          <Button size="sm" variant="secondary" onClick={() => {
                            const amt = prompt(`Force refund for rental #${r.id}\nTotal cost: ${r.total_cost} LTC\nEnter refund amount:`);
                            if (amt) handleReviewRental(r.id, 'force_refund', parseFloat(amt));
                          }}>Force Refund</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {rentals.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-dark-500 text-sm">No rentals found</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ===== ALGORITHMS ===== */}
      {tab === 'algorithms' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Algorithms ({algorithms.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    {['ID', 'Name', 'Display Name', 'Unit', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {algorithms.map((a) => (
                    <tr key={a.id} className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-dark-300">{a.id}</td>
                      <td className="px-4 py-3 text-sm text-dark-300 font-mono">{a.name}</td>
                      <td className="px-4 py-3 text-sm text-white font-medium">{a.display_name}</td>
                      <td className="px-4 py-3 text-sm text-primary-400">{a.unit}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${a.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{a.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleToggleAlgorithm(a.id, a.is_active)}>{a.is_active ? 'Deactivate' : 'Activate'}</Button>
                          <Button size="sm" variant="danger" onClick={() => handleDeleteAlgorithm(a.id)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== WITHDRAWALS ===== */}
      {tab === 'withdrawals' && (
        <div className="space-y-4">
          {/* Hot Wallet Balance */}
          <Card className="bg-gradient-to-r from-yellow-900/20 to-dark-800 border-yellow-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-dark-400 uppercase tracking-wider mb-1">Hot Wallet Balance (LTC)</p>
                {walletBalance ? (
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-2xl font-bold text-white">{formatLTC(walletBalance.ltc_balance)} <span className="text-sm text-dark-400">LTC</span></p>
                    </div>
                  </div>
                ) : (
                  <p className="text-dark-500 text-sm">Loading wallet balance...</p>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={loadWalletBalance}>Refresh</Button>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pending Withdrawals ({withdrawals.length})</CardTitle></CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <p className="text-dark-500 text-sm text-center py-8">No pending withdrawals</p>
              ) : (
                <div className="space-y-3">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-dark-600/30">
                      <div>
                        <p className="text-sm text-white font-medium">User #{w.user_id} &middot; <span className="text-accent-400">{formatLTC(w.amount)} LTC</span></p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-dark-400">To:</p>
                          <a
                            href={`https://blockchair.com/litecoin/address/${w.wallet_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-400 hover:text-primary-300 font-mono transition-colors"
                          >
                            {truncateAddress(w.wallet_address || '', 8)}
                          </a>
                          <span className="text-xs text-dark-500">&middot; Fee: {formatLTC(w.fee)} LTC</span>
                        </div>
                        <p className="text-xs text-dark-500 mt-0.5">{formatDateTime(w.created_at)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleApproveWithdrawal(w.id)} loading={approvingId === w.id}>
                          {approvingId === w.id ? 'Sending...' : 'Approve & Send'}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleRejectWithdrawal(w.id)}>Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 bg-dark-800/30 rounded-lg p-3 border border-dark-700/30">
                <p className="text-xs text-dark-400">
                  <strong className="text-dark-300">Auto-send:</strong> When you approve a withdrawal, LTC is automatically sent from the hot wallet to the user&apos;s Litecoin address. The transaction hash will be recorded in the audit log.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== TRANSACTIONS ===== */}
      {tab === 'transactions' && (
        <Card>
          <CardHeader><CardTitle>All Transactions</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    {['ID', 'User', 'Type', 'Amount', 'Status', 'TX Hash', 'Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx: any) => {
                    const isIncome = tx.type?.includes('earning') || tx.type === 'deposit' || tx.type === 'refund';
                    return (
                      <tr key={tx.id} className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-dark-300">{tx.id}</td>
                        <td className="px-4 py-3 text-sm text-white">#{tx.user_id}</td>
                        <td className="px-4 py-3 text-sm text-dark-300 capitalize">{tx.type?.replace('_', ' ')}</td>
                        <td className={`px-4 py-3 text-sm font-medium ${isIncome ? 'text-green-400' : 'text-red-400'}`}>{isIncome ? '+' : '-'}{formatLTC(tx.amount)}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeColor(tx.status)}`}>{tx.status}</span></td>
                        <td className="px-4 py-3">
                          {tx.tx_hash ? (
                            <a href={`https://blockchair.com/litecoin/transaction/${tx.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-400 hover:text-primary-300 font-mono transition-colors">{truncateAddress(tx.tx_hash, 6)}</a>
                          ) : <span className="text-xs text-dark-600">-</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-dark-400">{tx.created_at ? formatDateTime(tx.created_at) : '-'}</td>
                      </tr>
                    );
                  })}
                  {transactions.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-dark-500 text-sm">No transactions</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== NOTIFICATIONS ===== */}
      {tab === 'notifications' && (
        <Card>
          <CardHeader><CardTitle>Send Notification</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4 max-w-lg">
              <Input label="User ID (leave empty for broadcast to all)" value={notifUserId} onChange={(e) => setNotifUserId(e.target.value)} placeholder="e.g., 5 or empty for all" />
              <Input label="Title" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} placeholder="e.g., System Maintenance" required />
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Message</label>
                <textarea
                  className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 min-h-[100px]"
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="Notification message..."
                />
              </div>
              <Button onClick={handleSendNotification} loading={notifSending}>
                {notifUserId ? 'Send to User' : 'Broadcast to All Users'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== AUDIT LOGS ===== */}
      {tab === 'audit' && (
        <Card>
          <CardHeader><CardTitle>Audit Logs</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-start justify-between p-3 bg-dark-800/50 rounded-lg border border-dark-600/20">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-primary-400/10 text-primary-400 text-xs font-mono rounded">{log.action}</span>
                      {log.entity_type && <span className="text-xs text-dark-400">{log.entity_type} #{log.entity_id}</span>}
                    </div>
                    {log.details && <p className="text-xs text-dark-500 mt-1 font-mono">{JSON.stringify(log.details)}</p>}
                  </div>
                  <span className="text-xs text-dark-500 whitespace-nowrap">{log.created_at ? formatDateTime(log.created_at) : '-'}</span>
                </div>
              ))}
              {auditLogs.length === 0 && <p className="text-dark-500 text-sm text-center py-8">No audit logs yet</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== SUPPORT TICKETS ===== */}
      {tab === 'support' && (
        <AdminSupportTab />
      )}

      {/* ===== SETTINGS ===== */}
      {tab === 'settings' && (
        <Card>
          <CardHeader><CardTitle>Platform Settings</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {settings.map((s) => (
                <div key={s.key} className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-dark-600/20">
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">{s.key}</p>
                    <p className="text-xs text-dark-400">{s.description || ''}</p>
                  </div>
                  <input
                    type="text"
                    className="w-44 px-3 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all"
                    defaultValue={s.value}
                    onBlur={(e) => {
                      if (e.target.value !== s.value) handleUpdateSetting(s.key, e.target.value);
                    }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
