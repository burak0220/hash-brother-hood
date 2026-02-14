'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Button from '@/components/ui/button';
import { rigsAPI, algorithmsAPI, favoritesAPI } from '@/lib/api';
import { formatUSDT, formatHashrate, statusBadgeColor } from '@/lib/utils';
import type { Rig, Algorithm } from '@/types';

export default function MarketplacePage() {
  const [rigs, setRigs] = useState<Rig[]>([]);
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [algorithmId, setAlgorithmId] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [favIds, setFavIds] = useState<Set<number>>(new Set());

  const loadRigs = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, per_page: 12, sort_by: sortBy, sort_order: 'desc' };
      if (search) params.search = search;
      if (algorithmId) params.algorithm_id = parseInt(algorithmId);
      const { data } = await rigsAPI.marketplace(params);
      setRigs(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    algorithmsAPI.list().then(({ data }) => setAlgorithms(data)).catch(() => {});
    favoritesAPI.list().then(({ data }) => setFavIds(new Set(data.map(f => f.rig_id)))).catch(() => {});
  }, []);

  useEffect(() => {
    loadRigs();
  }, [page, algorithmId, sortBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadRigs();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Marketplace</h1>
        <p className="text-dark-400">Browse and rent mining rigs</p>
      </div>

      {/* Filters */}
      <Card className="!p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search rigs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              options={[{ value: '', label: 'All Algorithms' }, ...algorithms.map((a) => ({ value: a.id, label: a.display_name }))]}
              value={algorithmId}
              onChange={(e) => { setAlgorithmId(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-48">
            <Select
              options={[
                { value: 'created_at', label: 'Newest' },
                { value: 'price_per_hour', label: 'Price' },
                { value: 'hashrate', label: 'Hashrate' },
                { value: 'average_rating', label: 'Rating' },
              ]}
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            />
          </div>
          <Button type="submit" size="md">Search</Button>
        </form>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rigs.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-dark-400 text-lg">No rigs found</p>
          <p className="text-dark-500 text-sm mt-2">Try adjusting your filters</p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-dark-400">{total} rigs found</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rigs.map((rig) => (
              <Link key={rig.id} href={`/marketplace/${rig.id}`}>
                <Card hover className="h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white truncate">{rig.name}</h3>
                      <p className="text-xs text-dark-400">by {rig.owner?.username || 'Unknown'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeColor(rig.status)}`}>
                      {rig.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Algorithm</span>
                      <span className="text-white font-medium">{rig.algorithm?.display_name || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Hashrate</span>
                      <span className="text-white font-medium">{formatHashrate(rig.hashrate, rig.algorithm?.unit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Price</span>
                      <span className="text-accent-400 font-medium">{formatUSDT(rig.price_per_hour)} USDT/hr</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Rating</span>
                      <span className="text-yellow-400 font-medium">
                        {'★'.repeat(Math.min(5, Math.max(0, Math.round(Number(rig.average_rating) || 0))))}{'☆'.repeat(5 - Math.min(5, Math.max(0, Math.round(Number(rig.average_rating) || 0))))}
                        <span className="text-dark-400 ml-1">({rig.total_rentals})</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-dark-500">
                    <span>{rig.region}</span>
                    <div className="flex items-center gap-2">
                      <span>{Number(rig.uptime_percentage)}% uptime</span>
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            if (favIds.has(rig.id)) {
                              await favoritesAPI.remove(rig.id);
                              setFavIds((prev) => { const n = new Set(prev); n.delete(rig.id); return n; });
                            } else {
                              await favoritesAPI.add(rig.id);
                              setFavIds((prev) => new Set(prev).add(rig.id));
                            }
                          } catch {}
                        }}
                        className="text-base hover:scale-110 transition-transform"
                        title={favIds.has(rig.id) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {favIds.has(rig.id) ? '❤️' : '🤍'}
                      </button>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-dark-400">Page {page} of {pages}</span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
