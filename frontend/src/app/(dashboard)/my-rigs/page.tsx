'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import { rigsAPI } from '@/lib/api';
import { formatLTC, formatHashrate, statusBadgeColor } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import type { Rig } from '@/types';
import toast from 'react-hot-toast';

const STRATUM_HOST = process.env.NEXT_PUBLIC_STRATUM_HOST || 'stratum.hashbrotherhood.com';
const STRATUM_PORT = process.env.NEXT_PUBLIC_STRATUM_PORT || '3333';

export default function MyRigsPage() {
  const { user } = useAuthStore();
  const [rigs, setRigs] = useState<Rig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkPrice, setBulkPrice] = useState('');

  useEffect(() => {
    rigsAPI.myRigs().then(({ data }) => setRigs(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkPrice = async () => {
    if (!bulkPrice || selectedIds.size === 0) return;
    try {
      const { data } = await rigsAPI.bulkUpdate({ rig_ids: Array.from(selectedIds), price_per_hour: parseFloat(bulkPrice) });
      toast.success(`Updated ${data.updated} rigs`);
      setSelectedIds(new Set());
      setBulkPrice('');
      rigsAPI.myRigs().then(({ data }) => setRigs(data));
    } catch { toast.error('Failed to update'); }
  };

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
          <p className="text-dark-400">Manage your hashpower listings</p>
        </div>
        <Link href="/my-rigs/new">
          <Button>Add New Rig</Button>
        </Link>
      </div>

      {rigs.length === 0 ? (
        <Card className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-dark-800/60 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/></svg>
          </div>
          <p className="text-dark-400 text-lg">No rigs yet</p>
          <p className="text-dark-500 text-sm mt-2 mb-4">List your first rig to start earning</p>
          <Link href="/my-rigs/new">
            <Button>Add Your First Rig</Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-primary-900/10 border border-primary-700/30 rounded-lg">
              <span className="text-sm text-primary-400">{selectedIds.size} selected</span>
              <input type="number" step="0.01" min="0" placeholder="New price/hr" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)}
                className="w-32 px-2 py-1 bg-dark-800 border border-dark-600 rounded text-sm text-white" />
              <Button size="sm" onClick={handleBulkPrice}>Update Price</Button>
              <Button size="sm" variant="secondary" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rigs.map((rig) => (
              <div key={rig.id} className="relative">
                <div className="absolute top-3 left-3 z-10" onClick={(e) => toggleSelect(rig.id, e)}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${selectedIds.has(rig.id) ? 'bg-primary-500 border-primary-500' : 'border-dark-500 hover:border-primary-400'}`}>
                    {selectedIds.has(rig.id) && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                  </div>
                </div>
                <Link href={`/my-rigs/${rig.id}`}>
                  <Card hover className="h-full pl-10">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-white truncate">{rig.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeColor(rig.status)}`}>
                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${rig.status === 'active' ? 'bg-green-400 animate-pulse' : rig.status === 'rented' ? 'bg-blue-400' : 'bg-red-400'}`}></span>
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
                    <span className="text-accent-400">{formatLTC(rig.price_per_hour)} LTC/hr</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">RPI</span>
                    <span className={`font-semibold ${Number(rig.rpi_score) >= 90 ? 'text-green-400' : Number(rig.rpi_score) >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {Number(rig.rpi_score || 100).toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Rentals</span>
                    <span className="text-white">{rig.total_rentals}</span>
                  </div>
                  {/* Miner connection info for owner */}
                  <div className="pt-2 border-t border-dark-700/60 mt-1">
                    <p className="text-[10px] text-dark-600 uppercase tracking-wider mb-1">Miner connects as</p>
                    <button
                      onClick={(e) => { e.preventDefault(); if (user) { navigator.clipboard.writeText(`${user.username}.${rig.id}`); toast.success('Worker name copied!'); } }}
                      className="font-mono text-xs text-dark-400 hover:text-primary-400 transition-colors truncate block w-full text-left"
                    >
                      {user?.username}.{rig.id} @ {STRATUM_HOST}:{STRATUM_PORT}
                    </button>
                  </div>
                </div>
                  </Card>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
