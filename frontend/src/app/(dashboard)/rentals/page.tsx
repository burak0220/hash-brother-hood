'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/card';
import Tabs from '@/components/ui/tabs';
import Button from '@/components/ui/button';
import { rentalsAPI } from '@/lib/api';
import { formatLTC, statusBadgeColor, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import toast from 'react-hot-toast';
import type { Rental } from '@/types';

const STRATUM_HOST = process.env.NEXT_PUBLIC_STRATUM_HOST || 'stratum.hashbrotherhood.com';
const STRATUM_PORT = process.env.NEXT_PUBLIC_STRATUM_PORT || '3333';

export default function RentalsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('renter');
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [ownerStats, setOwnerStats] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await rentalsAPI.list({ role: tab, page, per_page: 20 });
      setRentals(data.items);
      setPages(data.pages);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => { load(); }, [tab, page]);
  useEffect(() => {
    if (tab === 'owner') rentalsAPI.ownerStats().then(({ data }) => setOwnerStats(data)).catch(() => {});
  }, [tab]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Rentals</h1>
          <p className="text-dark-400">Manage your mining rentals</p>
        </div>
        <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/rentals/export/csv?role=${tab}`}
          className="px-3 py-1.5 text-xs bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-lg border border-dark-600 transition-colors"
          target="_blank" rel="noopener">
          Export CSV
        </a>
      </div>

      <Tabs
        tabs={[
          { id: 'renter', label: 'My Rentals' },
          { id: 'owner', label: 'Incoming Rentals' },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

      {/* Owner Stats Banner */}
      {tab === 'owner' && ownerStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Earnings', value: `${formatLTC(ownerStats.total_earnings)} LTC`, color: 'text-accent-400' },
            { label: 'Active Rentals', value: ownerStats.active_rentals, color: 'text-green-400' },
            { label: 'Total Rentals', value: ownerStats.total_rentals, color: 'text-white' },
            { label: 'My Rigs', value: ownerStats.rig_count, color: 'text-primary-400' },
            { label: 'Avg RPI', value: ownerStats.avg_rpi, color: 'text-yellow-400' },
          ].map(s => (
            <Card key={s.label} className="!p-3 text-center">
              <p className="text-xs text-dark-400">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rentals.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-dark-400 text-lg">No rentals found</p>
          <p className="text-dark-500 text-sm mt-2">
            {tab === 'renter' ? 'Browse the marketplace to rent a rig' : 'List a rig to receive rentals'}
          </p>
          {tab === 'renter' && (
            <Link href="/marketplace" className="inline-block mt-4"><Button>Browse Marketplace</Button></Link>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {rentals.map((rental) => (
            <Link key={rental.id} href={`/rentals/${rental.id}`}>
              <Card hover className="!p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-white">{rental.rig_name || `Rig #${rental.rig_id}`}</p>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeColor(rental.status)}`}>
                        {rental.status}
                      </span>
                    </div>
                    <p className="text-xs text-dark-400 mt-0.5">
                      {rental.algorithm_name} · {rental.duration_hours}h · {formatDateTime(rental.created_at)}
                    </p>
                    {tab === 'owner' && rental.renter && (
                      <p className="text-xs text-primary-400 mt-0.5">Renter: {rental.renter.username}</p>
                    )}
                    {/* Active: show miner connection info inline */}
                    {rental.status === 'active' && tab === 'renter' && rental.renter && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/20 border border-green-700/30 rounded text-xs text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          Active
                        </span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(`${rental.renter!.username}.${rental.rig_id}`);
                            toast.success('Worker name copied!');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-dark-800 border border-dark-600 rounded text-xs text-dark-300 hover:text-white hover:border-dark-500 transition-colors font-mono"
                        >
                          {rental.renter.username}.{rental.rig_id}
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        </button>
                        <span className="text-xs text-dark-600 font-mono">{STRATUM_HOST}:{STRATUM_PORT}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {rental.performance_percent != null && (
                      <span className={`text-xs font-medium ${Number(rental.performance_percent) >= 95 ? 'text-green-400' : Number(rental.performance_percent) >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {Number(rental.performance_percent).toFixed(0)}%
                      </span>
                    )}
                    <span className="text-sm font-medium text-accent-400">{formatLTC(rental.total_cost)} LTC</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-dark-400">Page {page} of {pages}</span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
