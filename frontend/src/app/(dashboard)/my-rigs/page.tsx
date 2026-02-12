'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import { rigsAPI } from '@/lib/api';
import { formatUSDT, formatHashrate, statusBadgeColor } from '@/lib/utils';
import type { Rig } from '@/types';

export default function MyRigsPage() {
  const [rigs, setRigs] = useState<Rig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rigsAPI.myRigs().then(({ data }) => setRigs(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Rigs</h1>
          <p className="text-dark-400">Manage your mining rigs</p>
        </div>
        <Link href="/my-rigs/new">
          <Button>Add New Rig</Button>
        </Link>
      </div>

      {rigs.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-4xl mb-4">🔧</div>
          <p className="text-dark-400 text-lg">No rigs yet</p>
          <p className="text-dark-500 text-sm mt-2 mb-4">List your first mining rig to start earning</p>
          <Link href="/my-rigs/new">
            <Button>Add Your First Rig</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rigs.map((rig) => (
            <Link key={rig.id} href={`/my-rigs/${rig.id}`}>
              <Card hover className="h-full">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-white truncate">{rig.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeColor(rig.status)}`}>
                    {rig.status}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Algorithm</span>
                    <span className="text-white">{rig.algorithm?.display_name || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Hashrate</span>
                    <span className="text-white">{formatHashrate(rig.hashrate, rig.algorithm?.unit)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Price</span>
                    <span className="text-accent-400">{formatUSDT(rig.price_per_hour)} USDT/hr</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Rentals</span>
                    <span className="text-white">{rig.total_rentals}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
