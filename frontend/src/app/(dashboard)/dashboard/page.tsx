'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth';
import { rentalsAPI, rigsAPI, paymentsAPI } from '@/lib/api';
import { formatUSDT, statusBadgeColor, formatDateTime } from '@/lib/utils';
import type { Rental, Rig, Transaction } from '@/types';

const HashrateChart = dynamic(() => import('@/components/charts/hashrate-chart'), { ssr: false });
const EarningsChart = dynamic(() => import('@/components/charts/earnings-chart'), { ssr: false });

const mockHashrateData = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  hashrate: Math.random() * 100 + 50,
}));

const mockEarningsData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => ({
  date: d,
  earnings: Math.random() * 0.01,
}));

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [rigs, setRigs] = useState<Rig[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [rentalRes, rigRes, txRes] = await Promise.all([
          rentalsAPI.list({ role: 'renter', per_page: 5 }),
          rigsAPI.myRigs(),
          paymentsAPI.transactions({ per_page: 5 }),
        ]);
        setRentals(rentalRes.data.items);
        setRigs(rigRes.data);
        setTransactions(txRes.data.items);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const activeRentals = rentals.filter((r) => r.status === 'active').length;
  const activeRigs = rigs.filter((r) => r.status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden neon-card rounded-2xl p-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-400/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-accent-400/5 rounded-full blur-[80px]" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-xs text-primary-400 font-medium uppercase tracking-[0.3em] mb-1">Control Center</p>
            <h1 className="text-2xl font-black text-white">
              Welcome back, <span className="neon-text">{user?.username}</span>
            </h1>
            <p className="text-dark-400 text-sm mt-1">Monitor your mining operations and earnings</p>
          </div>
          <div className="flex gap-3">
            <Link href="/marketplace" className="group relative px-5 py-2.5 rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-500 opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-500 blur-lg opacity-0 group-hover:opacity-40 transition-opacity" />
              <span className="relative text-dark-950 font-bold text-sm tracking-wide flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Browse Rigs
              </span>
            </Link>
            <Link href="/my-rigs/new" className="px-5 py-2.5 border border-dark-500/50 hover:border-primary-400/40 text-dark-200 hover:text-primary-400 rounded-lg text-sm font-bold transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Rig
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Balance',
            value: formatUSDT(user?.balance || 0),
            suffix: 'USDT',
            color: 'text-accent-400',
            glow: 'from-accent-400/15',
            border: 'hover:border-accent-400/30',
            icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
            iconColor: 'text-accent-400',
          },
          {
            label: 'Active Rentals',
            value: activeRentals.toString(),
            suffix: '',
            color: 'text-primary-400',
            glow: 'from-primary-400/15',
            border: 'hover:border-primary-400/30',
            icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
            iconColor: 'text-primary-400',
          },
          {
            label: 'My Rigs',
            value: rigs.length.toString(),
            suffix: 'total',
            color: 'text-blue-400',
            glow: 'from-blue-400/15',
            border: 'hover:border-blue-400/30',
            icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
            iconColor: 'text-blue-400',
          },
          {
            label: 'Active Rigs',
            value: activeRigs.toString(),
            suffix: 'online',
            color: 'text-green-400',
            glow: 'from-green-400/15',
            border: 'hover:border-green-400/30',
            icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01',
            iconColor: 'text-green-400',
          },
        ].map((stat) => (
          <div key={stat.label} className={`group relative neon-card rounded-xl p-5 transition-all duration-500 ${stat.border}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.glow} to-transparent opacity-0 group-hover:opacity-100 rounded-xl blur-xl transition-opacity duration-700`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-dark-400 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
                <div className={`w-9 h-9 rounded-lg bg-dark-800/80 flex items-center justify-center ${stat.iconColor}`}>
                  <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                  </svg>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className={`text-3xl font-black tracking-tight ${stat.color}`}>{stat.value}</p>
                {stat.suffix && <span className="text-xs text-dark-500 font-medium">{stat.suffix}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-400/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <CardTitle>Hashrate Performance</CardTitle>
              </div>
              <span className="text-[10px] text-dark-500 uppercase tracking-widest font-medium">24h</span>
            </div>
          </CardHeader>
          <CardContent>
            <HashrateChart data={mockHashrateData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neon-gold/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-neon-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <CardTitle>Weekly Earnings</CardTitle>
              </div>
              <span className="text-[10px] text-dark-500 uppercase tracking-widest font-medium">7 days</span>
            </div>
          </CardHeader>
          <CardContent>
            <EarningsChart data={mockEarningsData} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-400/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <CardTitle>Recent Rentals</CardTitle>
              </div>
              {rentals.length > 0 && (
                <Link href="/rentals" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">View all</Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {rentals.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-dark-800/60 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <p className="text-dark-500 text-sm font-medium">No rentals yet</p>
                <Link href="/marketplace" className="text-xs text-primary-400 hover:text-primary-300 mt-1 inline-block transition-colors">Browse marketplace</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {rentals.map((r) => (
                  <Link key={r.id} href={`/rentals/${r.id}`} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg hover:bg-dark-700/60 border border-transparent hover:border-primary-400/10 transition-all duration-300 group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-400/5 flex items-center justify-center group-hover:bg-primary-400/10 transition-colors">
                        <svg className="w-4 h-4 text-primary-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{r.rig_name || `Rig #${r.rig_id}`}</p>
                        <p className="text-xs text-dark-400">{formatDateTime(r.created_at)}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadgeColor(r.status)}`}>
                      {r.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-400/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <CardTitle>Recent Transactions</CardTitle>
              </div>
              {transactions.length > 0 && (
                <Link href="/wallet" className="text-xs text-accent-400 hover:text-accent-300 transition-colors">View all</Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-dark-800/60 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <p className="text-dark-500 text-sm font-medium">No transactions yet</p>
                <Link href="/wallet" className="text-xs text-accent-400 hover:text-accent-300 mt-1 inline-block transition-colors">Go to wallet</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => {
                  const isIncome = tx.type.includes('earning') || tx.type === 'deposit' || tx.type === 'refund';
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg border border-transparent hover:border-dark-600/50 transition-all duration-300 group">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isIncome ? 'bg-green-400/10' : 'bg-red-400/10'}`}>
                          <svg className={`w-4 h-4 ${isIncome ? 'text-green-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isIncome ? 'M7 11l5-5m0 0l5 5m-5-5v12' : 'M17 13l-5 5m0 0l-5-5m5 5V6'} />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white capitalize">{tx.type.replace('_', ' ')}</p>
                          <p className="text-xs text-dark-400">{formatDateTime(tx.created_at)}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                        {isIncome ? '+' : '-'}{formatUSDT(tx.amount)} <span className="text-xs font-normal text-dark-500">USDT</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
