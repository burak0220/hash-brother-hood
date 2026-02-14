'use client';
import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Tabs from '@/components/ui/tabs';
import { adminAPI } from '@/lib/api';
import { formatUSDT, statusBadgeColor, formatDateTime, truncateAddress } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { User, Transaction, AdminStats, PlatformSetting, Algorithm } from '@/types';

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

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, usersRes, withdrawRes, settingsRes] = await Promise.all([
          adminAPI.stats(),
          adminAPI.users(),
          adminAPI.pendingWithdrawals(),
          adminAPI.settings(),
        ]);
        setStats(statsRes.data);
        setUsers(usersRes.data);
        setWithdrawals(withdrawRes.data);
        setSettings(settingsRes.data);
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

  const [walletBalance, setWalletBalance] = useState<{ usdt_balance: number; bnb_balance: number } | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const loadWalletBalance = async () => {
    try {
      const { data } = await adminAPI.walletBalance();
      setWalletBalance(data);
    } catch {}
  };

  const handleApproveWithdrawal = async (id: number) => {
    if (!confirm('Approve and auto-send USDT on BSC?')) return;
    setApprovingId(id);
    try {
      const { data } = await adminAPI.approveWithdrawal(id);
      setWithdrawals((prev) => prev.filter((w) => w.id !== id));
      toast.success(`Withdrawal approved and sent! TX: ${data.tx_hash ? data.tx_hash.slice(0, 16) + '...' : 'sent'}`);
      loadWalletBalance();
    } catch (err: any) { toast.error(err.response?.data?.detail || 'BSC transfer failed - withdrawal remains pending'); }
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
      toast.success(`Balance adjusted. New: ${data.new_balance} USDT`);
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
          { id: 'overview', label: 'Overview' },
          { id: 'users', label: 'Users' },
          { id: 'rigs', label: 'Rigs' },
          { id: 'rentals', label: 'Rentals' },
          { id: 'algorithms', label: 'Algorithms' },
          { id: 'withdrawals', label: 'Withdrawals' },
          { id: 'transactions', label: 'Transactions' },
          { id: 'notifications', label: 'Notifications' },
          { id: 'audit', label: 'Audit Logs' },
          { id: 'settings', label: 'Settings' },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {/* ===== OVERVIEW ===== */}
      {tab === 'overview' && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Total Users', value: stats.total_users, color: 'text-primary-400', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
            { label: 'Total Rigs', value: stats.total_rigs, color: 'text-blue-400', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
            { label: 'Total Rentals', value: stats.total_rentals, color: 'text-green-400', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'Active Rentals', value: stats.active_rentals, color: 'text-yellow-400', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
            { label: 'Total Revenue', value: `${formatUSDT(stats.total_revenue)} USDT`, color: 'text-accent-400', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
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
      )}

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
                      <td className="px-4 py-3 text-sm text-accent-400 font-medium">{formatUSDT(u.balance)}</td>
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
                  {['ID', 'Name', 'Owner', 'Algorithm', 'Hashrate', 'Price/h', 'Status', 'Featured', 'Actions'].map((h) => (
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
                    <td className="px-3 py-3 text-sm text-accent-400">{formatUSDT(r.price_per_hour)}</td>
                    <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeColor(r.status)}`}>{r.status}</span></td>
                    <td className="px-3 py-3">{r.is_featured ? <span className="text-neon-gold text-xs font-bold">FEATURED</span> : <span className="text-dark-500 text-xs">-</span>}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => handleToggleFeature(r.id)}>{r.is_featured ? 'Unfeature' : 'Feature'}</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteRig(r.id)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rigs.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-dark-500 text-sm">No rigs found</td></tr>}
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
                  {['ID', 'Rig', 'Renter', 'Duration', 'Cost', 'Fee', 'Status', 'Created', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rentals.map((r) => (
                  <tr key={r.id} className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors">
                    <td className="px-3 py-3 text-sm text-dark-300">{r.id}</td>
                    <td className="px-3 py-3 text-sm text-white">Rig #{r.rig_id}</td>
                    <td className="px-3 py-3 text-sm text-dark-300">User #{r.renter_id}</td>
                    <td className="px-3 py-3 text-sm text-white">{r.duration_hours}h</td>
                    <td className="px-3 py-3 text-sm text-accent-400">{formatUSDT(r.total_cost)}</td>
                    <td className="px-3 py-3 text-sm text-dark-400">{formatUSDT(r.total_cost * 0.03)}</td>
                    <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeColor(r.status)}`}>{r.status}</span></td>
                    <td className="px-3 py-3 text-xs text-dark-400">{r.created_at ? formatDateTime(r.created_at) : '-'}</td>
                    <td className="px-3 py-3">
                      {(r.status === 'active' || r.status === 'pending') && (
                        <Button size="sm" variant="danger" onClick={() => handleCancelRental(r.id)}>Cancel & Refund</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {rentals.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-dark-500 text-sm">No rentals found</td></tr>}
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
                <p className="text-xs text-dark-400 uppercase tracking-wider mb-1">Hot Wallet Balance (BSC)</p>
                {walletBalance ? (
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-2xl font-bold text-white">{walletBalance.usdt_balance.toFixed(2)} <span className="text-sm text-dark-400">USDT</span></p>
                    </div>
                    <div className="border-l border-dark-600 pl-6">
                      <p className="text-lg font-medium text-yellow-400">{walletBalance.bnb_balance.toFixed(4)} <span className="text-sm text-dark-500">BNB (gas)</span></p>
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
                        <p className="text-sm text-white font-medium">User #{w.user_id} &middot; <span className="text-accent-400">{formatUSDT(w.amount)} USDT</span></p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-dark-400">To:</p>
                          <a
                            href={`https://bscscan.com/address/${w.wallet_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-400 hover:text-primary-300 font-mono transition-colors"
                          >
                            {truncateAddress(w.wallet_address || '', 8)}
                          </a>
                          <span className="text-xs text-dark-500">&middot; Fee: {formatUSDT(w.fee)} USDT</span>
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
                  <strong className="text-dark-300">Auto-send:</strong> When you approve a withdrawal, USDT is automatically sent from the hot wallet to the user&apos;s BSC address. The transaction hash will be recorded in the audit log.
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
                        <td className={`px-4 py-3 text-sm font-medium ${isIncome ? 'text-green-400' : 'text-red-400'}`}>{isIncome ? '+' : '-'}{formatUSDT(tx.amount)}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeColor(tx.status)}`}>{tx.status}</span></td>
                        <td className="px-4 py-3">
                          {tx.tx_hash ? (
                            <a href={`https://bscscan.com/tx/${tx.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-400 hover:text-primary-300 font-mono transition-colors">{truncateAddress(tx.tx_hash, 6)}</a>
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
