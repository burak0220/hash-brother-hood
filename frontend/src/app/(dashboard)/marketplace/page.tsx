'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import { rigsAPI, algorithmsAPI, favoritesAPI, rentalsAPI, usersAPI } from '@/lib/api';
import { formatLTC, formatHashrate, regionInfo, REGIONS } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import toast from 'react-hot-toast';
import type { Rig, Algorithm, PoolProfile } from '@/types';

export default function MarketplacePage() {
  const { user } = useAuthStore();
  const [allRigs, setAllRigs] = useState<Rig[]>([]);
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // Mass Rent
  const [selectedRigIds, setSelectedRigIds] = useState<Set<number>>(new Set());
  const [showMassRent, setShowMassRent] = useState(false);
  const [massRenting, setMassRenting] = useState(false);
  const [massRentDuration, setMassRentDuration] = useState('2');
  const [poolProfiles, setPoolProfiles] = useState<PoolProfile[]>([]);
  const [massPoolUrl, setMassPoolUrl] = useState('');
  const [massPoolUser, setMassPoolUser] = useState('');
  const [massPoolPassword, setMassPoolPassword] = useState('x');

  // Filters
  const [search, setSearch] = useState('');
  const [algorithmId, setAlgorithmId] = useState('');
  const [sortBy, setSortBy] = useState('price_per_hour');
  const [sortOrder, setSortOrder] = useState('asc');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minHashrate, setMinHashrate] = useState('');
  const [showRented, setShowRented] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const [regionFilter, setRegionFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [favIds, setFavIds] = useState<Set<number>>(new Set());
  const [algoCounts, setAlgoCounts] = useState<Record<string, number>>({});

  // ─── Computed stats ───
  const stats = useMemo(() => {
    const available = allRigs.filter(r => r.status === 'active').length;
    const rented = allRigs.filter(r => r.status === 'rented').length;
    const offline = allRigs.filter(r => r.status !== 'active' && r.status !== 'rented').length;
    const avgPrice = available > 0
      ? allRigs.filter(r => r.status === 'active').reduce((s, r) => s + Number(r.price_per_hour), 0) / available
      : 0;
    return { available, rented, offline, avgPrice };
  }, [allRigs]);

  // ─── Client-side status filter ───
  const rigs = useMemo(() => {
    let filtered = [...allRigs];
    if (!showRented) filtered = filtered.filter(r => r.status !== 'rented');
    if (!showOffline) filtered = filtered.filter(r => r.status !== 'disabled' && r.status !== 'inactive');
    if (regionFilter) filtered = filtered.filter(r => r.region === regionFilter);
    return filtered;
  }, [allRigs, showRented, showOffline, regionFilter]);

  const selectedAlgo = algorithms.find(a => a.id === parseInt(algorithmId));

  // ─── Data loading ───
  const loadRigs = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, per_page: 50, sort_by: sortBy, sort_order: sortOrder };
      if (search) params.search = search;
      if (algorithmId) params.algorithm_id = parseInt(algorithmId);
      if (minPrice) params.min_price = parseFloat(minPrice);
      if (maxPrice) params.max_price = parseFloat(maxPrice);
      if (minHashrate) params.min_hashrate = parseFloat(minHashrate);
      const { data } = await rigsAPI.marketplace(params);
      setAllRigs(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch (_e) { /* silent */ }
    setLoading(false);
  };

  useEffect(() => {
    algorithmsAPI.list().then(({ data }) => setAlgorithms(data)).catch(() => {});
    favoritesAPI.list().then(({ data }) => setFavIds(new Set(data.map((f: any) => f.rig_id)))).catch(() => {});
    rigsAPI.algoStats().then(({ data }) => setAlgoCounts(data)).catch(() => {});
  }, []);

  useEffect(() => { loadRigs(); }, [page, algorithmId, sortBy, sortOrder]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); loadRigs(); };

  const toggleSelect = (id: number) => {
    setSelectedRigIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleFav = async (rigId: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    try {
      if (favIds.has(rigId)) {
        await favoritesAPI.remove(rigId); setFavIds(p => { const n = new Set(p); n.delete(rigId); return n; });
      } else {
        await favoritesAPI.add(rigId); setFavIds(p => new Set(p).add(rigId));
      }
    } catch (_e) { /* silent */ }
  };

  // ─── RPI color helper ───
  const rpiColor = (score: number) => {
    if (score >= 90) return 'text-green-400 bg-green-900/30';
    if (score >= 70) return 'text-yellow-400 bg-yellow-900/30';
    return 'text-red-400 bg-red-900/30';
  };

  // ─── Algorithm accent color helper ───
  const algoAccentColors = ['bg-primary-400', 'bg-accent-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-pink-400', 'bg-orange-400'];
  const algoAccent = (id?: number) => algoAccentColors[(id || 0) % algoAccentColors.length];

  return (
    <>
    <div className="space-y-5 animate-fade-in">

      {/* ═══════════════════════════════════════════════════════════════════════
          STATS BANNER
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Available', val: stats.available, color: 'text-green-400', iconColor: 'text-green-400', gradient: 'from-dark-900 to-green-900/10', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> },
          { label: 'Rented', val: stats.rented, color: 'text-blue-400', iconColor: 'text-blue-400', gradient: 'from-dark-900 to-blue-900/10', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg> },
          { label: 'Offline', val: stats.offline, color: 'text-dark-500', iconColor: 'text-dark-600', gradient: 'from-dark-900 to-dark-800/60', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg> },
          { label: 'Avg Price/hr', val: formatLTC(stats.avgPrice), color: 'text-accent-400', iconColor: 'text-accent-400', gradient: 'from-dark-900 to-accent-900/10', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
          { label: 'Settlement', val: 'LTC', color: 'text-accent-400', iconColor: 'text-accent-400', gradient: 'from-dark-900 to-accent-900/10', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.gradient} border border-dark-700/50 rounded-xl p-3.5 flex items-center gap-3 hover:border-dark-600 transition-colors`}>
            <div className={`w-9 h-9 rounded-lg bg-dark-800/60 flex items-center justify-center shrink-0 ${s.iconColor}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-[10px] text-dark-500 uppercase tracking-wider">{s.label}</p>
              <p className={`text-lg font-black ${s.color} leading-tight`}>{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TITLE + ALGORITHM TABS (MRR style)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div>
        <h1 className="text-xl font-bold text-white mb-1">
          {selectedAlgo ? `${selectedAlgo.display_name} Hashpower Market` : 'Hashpower Marketplace'}
        </h1>
        <p className="text-sm text-dark-500 mb-3">
          Showing {rigs.length} of {total} rigs
          {!showRented && stats.rented > 0 ? ` · ${stats.rented} rented hidden` : ''}
        </p>
        {/* Horizontal algorithm tab bar — only algorithms with active rigs */}
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <div className="flex gap-1.5 min-w-max">
            {/* All tab */}
            <button
              onClick={() => { setAlgorithmId(''); setPage(1); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                algorithmId === ''
                  ? 'bg-primary-500/15 text-primary-400 border-primary-500/30'
                  : 'bg-dark-800 text-dark-400 border-dark-700 hover:text-white hover:border-dark-600'
              }`}
            >
              All
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                algorithmId === '' ? 'bg-primary-500/20 text-primary-300' : 'bg-dark-700 text-dark-400'
              }`}>
                {Object.values(algoCounts).reduce((s, v) => s + v, 0)}
              </span>
            </button>
            {/* Per-algorithm tabs — sorted by rig count descending */}
            {algorithms
              .filter(a => algoCounts[String(a.id)] > 0)
              .sort((a, b) => (algoCounts[String(b.id)] || 0) - (algoCounts[String(a.id)] || 0))
              .map(algo => (
                <button
                  key={algo.id}
                  onClick={() => { setAlgorithmId(String(algo.id)); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                    algorithmId === String(algo.id)
                      ? 'bg-primary-500/15 text-primary-400 border-primary-500/30'
                      : 'bg-dark-800 text-dark-400 border-dark-700 hover:text-white hover:border-dark-600'
                  }`}
                >
                  {algo.display_name}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    algorithmId === String(algo.id) ? 'bg-primary-500/20 text-primary-300' : 'bg-dark-700 text-dark-400'
                  }`}>
                    {algorithmId === String(algo.id) ? total : algoCounts[String(algo.id)]}
                  </span>
                </button>
              ))
            }
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SEARCH BAR + SORT + FILTERS
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-dark-900 border border-dark-700/50 rounded-xl p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search hashpower listings..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/40" />
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none cursor-pointer">
            <option value="price_per_hour">Sort by Price</option>
            <option value="hashrate">Sort by Hashrate</option>
            <option value="rpi_score">Sort by RPI</option>
            <option value="created_at">Sort by Date</option>
          </select>
          <button type="button" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-dark-400 hover:text-white text-sm transition-colors">
            {sortOrder === 'asc' ? '↑ Low first' : '↓ High first'}
          </button>
          <Button type="submit">Search</Button>
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 ${showAdvanced ? 'bg-primary-500/10 text-primary-400 border-primary-500/30' : 'bg-dark-800 text-dark-400 border-dark-600 hover:text-white'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
            Filters
          </button>
        </form>

        {showAdvanced && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-dark-700/50">
            <Input label="Min Price (LTC/hr)" type="number" step="0.00000001" placeholder="0.00" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
            <Input label="Max Price (LTC/hr)" type="number" step="0.00000001" placeholder="999" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            <Input label="Min Hashrate" type="number" placeholder="0" value={minHashrate} onChange={(e) => setMinHashrate(e.target.value)} />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-dark-400 font-medium">Region</label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 cursor-pointer"
              >
                <option value="">All Regions</option>
                {Object.entries(REGIONS).map(([key, r]) => (
                  <option key={key} value={key}>{r.flag}  {r.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="secondary" size="sm" onClick={() => { setMinPrice(''); setMaxPrice(''); setMinHashrate(''); setRegionFilter(''); setPage(1); loadRigs(); }}>
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TOOLBAR: Checkboxes + Mass Rent + View Toggle
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-5">
          <label className="flex items-center gap-1.5 cursor-pointer select-none group">
            <input type="checkbox" checked={showRented} onChange={(e) => setShowRented(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-dark-500 bg-dark-800 text-blue-500 focus:ring-0 cursor-pointer" />
            <span className="text-xs text-dark-400 group-hover:text-dark-300">Show Rented</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none group">
            <input type="checkbox" checked={showOffline} onChange={(e) => setShowOffline(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-dark-500 bg-dark-800 text-dark-500 focus:ring-0 cursor-pointer" />
            <span className="text-xs text-dark-400 group-hover:text-dark-300">Show Offline</span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          {selectedRigIds.size > 0 && (
            <div className="flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-lg px-3 py-1.5">
              <span className="text-xs text-primary-400 font-semibold">{selectedRigIds.size} selected</span>
              <Button size="sm" onClick={() => { setShowMassRent(true); if (user) usersAPI.poolProfiles().then(({ data }) => setPoolProfiles(data)).catch(() => {}); }}>
                Mass Rent
              </Button>
              <button onClick={() => setSelectedRigIds(new Set())} className="text-xs text-dark-400 hover:text-white ml-1">✕</button>
            </div>
          )}
          {/* View toggle icons */}
          <div className="flex bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
            <button onClick={() => setViewMode('grid')} title="Grid view"
              className={`px-2.5 py-2 transition-all ${viewMode === 'grid' ? 'bg-primary-500/15 text-primary-400' : 'text-dark-500 hover:text-white'}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/></svg>
            </button>
            <button onClick={() => setViewMode('table')} title="Table view"
              className={`px-2.5 py-2 transition-all ${viewMode === 'table' ? 'bg-primary-500/15 text-primary-400' : 'text-dark-500 hover:text-white'}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm15 2h-4v3h4V4zm0 4h-4v3h4V8zm0 4h-4v3h3a1 1 0 001-1v-2zm-5 3v-3H6v3h4zm-5 0v-3H1v2a1 1 0 001 1h3zm-4-4h4V8H1v3zm0-4h4V4H1v3zm5-3v3h4V4H6zm4 4H6v3h4V8z"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          RIG LIST
      ═══════════════════════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-dark-500 text-sm">Loading rigs...</p>
          </div>
        </div>
      ) : rigs.length === 0 ? (
        <div className="bg-dark-900 border border-dark-700/50 rounded-xl text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-dark-800/60 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <p className="text-dark-400 text-lg font-medium">No listings found</p>
          <p className="text-dark-500 text-sm mt-1">Adjust your filters or check back — new hashpower drops regularly</p>
        </div>

      ) : viewMode === 'table' ? (
        /* ─────── TABLE VIEW ─────── */
        <div className="bg-dark-900 border border-dark-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="py-3 px-3 w-10">
                    <input type="checkbox"
                      className="w-3.5 h-3.5 rounded border-dark-500 bg-dark-800 text-primary-500 cursor-pointer"
                      checked={selectedRigIds.size > 0 && selectedRigIds.size === rigs.filter(r => r.status === 'active' && r.owner_id !== user?.id).length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedRigIds(new Set(rigs.filter(r => r.status === 'active' && r.owner_id !== user?.id).map(r => r.id)));
                        else setSelectedRigIds(new Set());
                      }} />
                  </th>
                  {['Name', 'Region', 'Hashrate', 'Price/hr', 'Price/day', 'Min', 'Max', 'RPI', 'Rating', ''].map((h, i) => (
                    <th key={h || `col-${i}`} className={`py-3 px-2 text-[11px] text-dark-400 uppercase tracking-wider font-semibold ${
                      i === 0 ? 'text-left' : i >= 8 ? 'text-right pr-3' : ['Hashrate','Price/hr','Price/day'].includes(h) ? 'text-right' : 'text-center'
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rigs.map(rig => {
                  const rpi = Number(rig.rpi_score);
                  const canRent = rig.status === 'active' && user && rig.owner_id !== user.id;
                  return (
                    <tr key={rig.id} className="border-b border-dark-800/50 hover:bg-dark-800/40 transition-colors group">
                      {/* Checkbox / Status dot */}
                      <td className="py-3.5 px-3">
                        {canRent ? (
                          <input type="checkbox" checked={selectedRigIds.has(rig.id)} onChange={() => toggleSelect(rig.id)}
                            className="w-3.5 h-3.5 rounded border-dark-500 bg-dark-800 text-primary-500 cursor-pointer" />
                        ) : (
                          <span className={`block w-2.5 h-2.5 rounded-full mx-auto ${rig.status === 'active' ? 'bg-green-400' : rig.status === 'rented' ? 'bg-blue-400' : 'bg-dark-600'}`} />
                        )}
                      </td>
                      {/* Name + algo + owner */}
                      <td className="py-3.5 px-2">
                        <Link href={`/marketplace/${rig.id}`} className="group/link flex items-center gap-2.5">
                          <button onClick={(e) => toggleFav(rig.id, e)} className={`opacity-40 group-hover:opacity-100 transition-opacity shrink-0 ${favIds.has(rig.id) ? 'text-red-400' : 'text-dark-500'}`}>
                            {favIds.has(rig.id) ? (
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-white group-hover/link:text-primary-400 transition-colors truncate">{rig.name}</p>
                            <p className="text-[11px] text-dark-500 truncate">{rig.algorithm?.display_name} · {rig.owner?.username}</p>
                          </div>
                        </Link>
                      </td>
                      {/* Region */}
                      <td className="py-3.5 px-2 text-center">
                        <span title={regionInfo(rig.region).label} className="text-lg leading-none cursor-default" aria-label={regionInfo(rig.region).label}>
                          {regionInfo(rig.region).flag}
                        </span>
                      </td>
                      {/* Hashrate */}
                      <td className="py-3.5 px-2 text-right">
                        <span className="font-mono text-sm text-white font-medium">{formatHashrate(rig.hashrate, rig.algorithm?.unit)}</span>
                      </td>
                      {/* Price/hr */}
                      <td className="py-3.5 px-2 text-right">
                        <span className="text-sm font-bold text-accent-400">{formatLTC(rig.price_per_hour)}</span>
                      </td>
                      {/* Price/day */}
                      <td className="py-3.5 px-2 text-right">
                        <span className="text-xs text-dark-400">{formatLTC(Number(rig.price_per_hour) * 24)}</span>
                      </td>
                      {/* Min hours */}
                      <td className="py-3.5 px-2 text-center text-sm text-dark-300">{rig.min_rental_hours}h</td>
                      {/* Max hours */}
                      <td className="py-3.5 px-2 text-center text-sm text-dark-300">{rig.max_rental_hours}h</td>
                      {/* RPI badge */}
                      <td className="py-3.5 px-2 text-center">
                        <span className={`inline-flex items-center justify-center w-9 h-7 rounded-md text-xs font-bold ${rpiColor(rpi)}`}>
                          {rpi.toFixed(0)}
                        </span>
                      </td>
                      {/* Rating */}
                      <td className="py-3.5 px-2 text-center whitespace-nowrap">
                        <span className="text-yellow-400 text-xs">{'★'.repeat(Math.round(Number(rig.average_rating) || 0))}</span>
                        <span className="text-dark-700 text-xs">{'★'.repeat(5 - Math.round(Number(rig.average_rating) || 0))}</span>
                        <span className="text-dark-500 text-[10px] ml-0.5">({rig.total_rentals})</span>
                      </td>
                      {/* Action */}
                      <td className="py-3.5 px-3 text-right">
                        {canRent ? (
                          <Link href={`/marketplace/${rig.id}`}>
                            <span className="inline-block px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-all hover:shadow-lg hover:shadow-green-500/20 cursor-pointer">
                              Rent Now!
                            </span>
                          </Link>
                        ) : rig.status === 'rented' ? (
                          <span className="inline-block px-3 py-1.5 bg-blue-900/20 text-blue-400 text-[11px] rounded-lg border border-blue-800/30">Rented</span>
                        ) : (
                          <Link href={`/marketplace/${rig.id}`}>
                            <span className="text-xs text-dark-400 hover:text-primary-400 transition-colors cursor-pointer">Details →</span>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      ) : (
        /* ─────── GRID VIEW ─────── */
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rigs.map(rig => {
            const rpi = Number(rig.rpi_score);
            const canRent = rig.status === 'active' && user && rig.owner_id !== user.id;
            return (
              <div key={rig.id} className="group relative">
                {canRent && (
                  <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedRigIds.has(rig.id)} onChange={() => toggleSelect(rig.id)}
                      className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 cursor-pointer" />
                  </div>
                )}
                <Card hover className="h-full !p-0 overflow-hidden">
                  {/* Algorithm accent strip */}
                  <div className={`h-0.5 ${algoAccent(rig.algorithm?.id)}`} />
                  {/* Header */}
                  <div className="p-4 pb-3 border-b border-dark-700/40">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/marketplace/${rig.id}`} className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate group-hover:text-primary-400 transition-colors text-[15px]">{rig.name}</h3>
                        <p className="text-[11px] text-dark-500 mt-0.5">{rig.algorithm?.display_name} · <span className="text-primary-400/50">{rig.owner?.username}</span></p>
                      </Link>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${rig.status === 'active' ? 'bg-green-400 animate-pulse' : rig.status === 'rented' ? 'bg-blue-400' : 'bg-dark-600'}`} />
                    </div>
                    {rig.description && <p className="text-[11px] text-dark-500 mt-1.5 line-clamp-2 leading-relaxed">{rig.description}</p>}
                  </div>

                  {/* Stats */}
                  <div className="p-4 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-dark-800/50 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-dark-500 uppercase tracking-wider">Hashrate</p>
                        <p className="text-sm font-black text-white mt-0.5">{formatHashrate(rig.hashrate, rig.algorithm?.unit)}</p>
                      </div>
                      <div className="bg-dark-800/50 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-dark-500 uppercase tracking-wider">Price/hr</p>
                        <p className="text-base font-black text-accent-400 mt-0.5">{formatLTC(rig.price_per_hour)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-dark-800/50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-dark-500">Min</p>
                        <p className="text-xs font-bold text-white">{rig.min_rental_hours}h</p>
                      </div>
                      <div className="bg-dark-800/50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-dark-500">Max</p>
                        <p className="text-xs font-bold text-white">{rig.max_rental_hours}h</p>
                      </div>
                      <div className={`rounded-lg p-2 text-center ${rpiColor(rpi)}`}>
                        <p className="text-[10px] opacity-70">RPI</p>
                        <p className="text-xs font-bold">{rpi.toFixed(0)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <div>
                        <span className="text-yellow-400">{'★'.repeat(Math.round(Number(rig.average_rating) || 0))}</span>
                        <span className="text-dark-700">{'★'.repeat(5 - Math.round(Number(rig.average_rating) || 0))}</span>
                        <span className="text-dark-500 ml-1">({rig.total_rentals})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span title={regionInfo(rig.region).label} className="text-sm leading-none" aria-label={regionInfo(rig.region).label}>
                          {regionInfo(rig.region).flag}
                        </span>
                        <span className="text-dark-500">{regionInfo(rig.region).short}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-4 pb-3 flex items-center gap-2">
                    {canRent ? (
                      <Link href={`/marketplace/${rig.id}`} className="flex-1">
                        <span className="block w-full text-center py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg transition-all hover:shadow-lg hover:shadow-green-500/20">
                          Rent Now!
                        </span>
                      </Link>
                    ) : rig.status === 'rented' ? (
                      <span className="flex-1 text-center text-xs text-blue-400 py-2">Rented</span>
                    ) : (
                      <Link href={`/marketplace/${rig.id}`} className="flex-1">
                        <span className="block w-full text-center py-2 bg-dark-700 hover:bg-dark-600 text-dark-300 text-sm rounded-lg transition-colors">Details</span>
                      </Link>
                    )}
                    <button onClick={(e) => toggleFav(rig.id, e)} className={`p-1.5 rounded-lg hover:bg-dark-700/50 transition-all hover:scale-110 ${favIds.has(rig.id) ? 'text-red-400' : 'text-dark-500'}`}>
                      {favIds.has(rig.id) ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                      )}
                    </button>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGINATION
      ═══════════════════════════════════════════════════════════════════════ */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 text-sm text-dark-400 hover:text-white disabled:opacity-30 transition-colors">← Prev</button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
            const p = pages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= pages - 3 ? pages - 6 + i : page - 3 + i;
            return (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                  page === p ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'text-dark-400 hover:text-white hover:bg-dark-800'
                }`}>{p}</button>
            );
          })}
          <button disabled={page >= pages} onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-sm text-dark-400 hover:text-white disabled:opacity-30 transition-colors">Next →</button>
        </div>
      )}
    </div>

    {/* ═══════════════════════════════════════════════════════════════════════
        MASS RENT MODAL
    ═══════════════════════════════════════════════════════════════════════ */}
    {showMassRent && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">Mass Rent — {selectedRigIds.size} Rigs</h2>
            <button onClick={() => setShowMassRent(false)} className="text-dark-400 hover:text-white text-xl transition-colors">✕</button>
          </div>
          <div className="space-y-4">
            <Input label="Duration (hours)" type="number" min="1" value={massRentDuration} onChange={(e) => setMassRentDuration(e.target.value)} required />
            {poolProfiles.length > 0 && (
              <div>
                <label className="block text-xs text-dark-400 mb-1">Load from Saved Pool Profile</label>
                <select className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none"
                  onChange={(e) => {
                    const p = poolProfiles.find(pp => pp.id === parseInt(e.target.value));
                    if (p) { setMassPoolUrl(p.pool_url); setMassPoolUser(p.pool_user); setMassPoolPassword(p.pool_password); }
                  }}>
                  <option value="">— Select Pool Profile —</option>
                  {poolProfiles.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' ★' : ''}</option>)}
                </select>
              </div>
            )}
            <Input label="Primary Pool URL" placeholder="stratum+tcp://pool:port" value={massPoolUrl} onChange={(e) => setMassPoolUrl(e.target.value)} required />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Pool User / Wallet" placeholder="wallet.worker" value={massPoolUser} onChange={(e) => setMassPoolUser(e.target.value)} required />
              <Input label="Password" placeholder="x" value={massPoolPassword} onChange={(e) => setMassPoolPassword(e.target.value)} />
            </div>
            <div className="bg-dark-800 rounded-lg p-4">
              {(() => {
                const rentalCost = allRigs.filter(r => selectedRigIds.has(r.id)).reduce((sum, r) => sum + Number(r.price_per_hour) * parseInt(massRentDuration || '0'), 0);
                const total = Math.round(rentalCost * 1.03 * 100) / 100;
                return (<>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-white">Amount Due</span>
                    <span className="text-lg font-black text-accent-400">{formatLTC(total)} LTC</span>
                  </div>
                  <p className="text-xs text-dark-500 mt-1">{selectedRigIds.size} rigs × {massRentDuration}h</p>
                </>);
              })()}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowMassRent(false)} className="flex-1">Cancel</Button>
              <Button loading={massRenting} className="flex-1" onClick={async () => {
                if (!massPoolUrl || !massPoolUser) { toast.error('Pool URL and User required.'); return; }
                setMassRenting(true);
                try {
                  const { data } = await rentalsAPI.massRent({
                    rig_ids: Array.from(selectedRigIds), duration_hours: parseInt(massRentDuration),
                    pool_url: massPoolUrl, pool_user: massPoolUser, pool_password: massPoolPassword,
                  });
                  toast.success(data.message);
                  if (data.failed.length > 0) data.failed.forEach((f: any) => toast.error(`Rig #${f.rig_id}: ${f.error}`));
                  setShowMassRent(false); setSelectedRigIds(new Set()); loadRigs();
                } catch (err: any) { toast.error(err.response?.data?.detail || 'Mass rent failed.'); }
                setMassRenting(false);
              }}>Rent All ({selectedRigIds.size})</Button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
