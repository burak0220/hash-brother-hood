'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/card';
import Tabs from '@/components/ui/tabs';
import Button from '@/components/ui/button';
import { rentalsAPI } from '@/lib/api';
import { formatUSDT, statusBadgeColor, formatDateTime } from '@/lib/utils';
import type { Rental } from '@/types';

export default function RentalsPage() {
  const [tab, setTab] = useState('renter');
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await rentalsAPI.list({ role: tab, page, per_page: 20 });
      setRentals(data.items);
      setPages(data.pages);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    load();
  }, [tab, page]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Rentals</h1>
        <p className="text-dark-400">Manage your mining rentals</p>
      </div>

      <Tabs
        tabs={[
          { id: 'renter', label: 'My Rentals' },
          { id: 'owner', label: 'Incoming Rentals' },
        ]}
        activeTab={tab}
        onChange={setTab}
      />

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
            <Link href="/marketplace" className="inline-block mt-4">
              <Button>Browse Marketplace</Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {rentals.map((rental) => (
            <Link key={rental.id} href={`/rentals/${rental.id}`}>
              <Card hover className="!p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium text-white">{rental.rig_name || `Rig #${rental.rig_id}`}</p>
                      <p className="text-xs text-dark-400">
                        {rental.algorithm_name} &middot; {rental.duration_hours}h &middot; {formatDateTime(rental.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-accent-400">{formatUSDT(rental.total_cost)} USDT</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeColor(rental.status)}`}>
                      {rental.status}
                    </span>
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
