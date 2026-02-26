'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import { rigsAPI, rentalsAPI, reviewsAPI, usersAPI } from '@/lib/api';
import { formatLTC, formatHashrate, statusBadgeColor, formatDate, timeAgo, regionInfo } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import toast from 'react-hot-toast';
import type { Rig, Review, PoolProfile } from '@/types';

/* ── Hashrate History Chart (MRR-style) ────────────────────────────────────── */
function HashrateHistoryChart({ rigId, advertisedHashrate, unit }: { rigId: number; advertisedHashrate: number; unit: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    rigsAPI.hashrateHistory(rigId, 48).then(({ data }) => setLogs(data)).catch(() => {});
  }, [rigId]);
  if (logs.length === 0) return (
    <div className="h-24 flex items-center justify-center text-dark-600 text-xs">No hashrate data yet</div>
  );

  const recentLogs = logs.slice(-60);
  const maxMeasured = Math.max(...recentLogs.map(l => l.measured_hashrate || 0));
  const maxHr = Math.max(maxMeasured, advertisedHashrate) * 1.15; // 15% headroom
  const avgHashrate = recentLogs.reduce((s, l) => s + (l.measured_hashrate || 0), 0) / recentLogs.length;
  const efficiency = advertisedHashrate > 0 ? Math.min(100, (avgHashrate / advertisedHashrate) * 100) : 0;
  const advertisedPct = maxHr > 0 ? (advertisedHashrate / maxHr) * 100 : 0;

  const effColor = efficiency >= 95 ? 'text-green-400' : efficiency >= 75 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-dark-900 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-dark-500 uppercase tracking-wider">Advertised</p>
          <p className="text-sm font-bold text-primary-400 mt-0.5">{formatHashrate(advertisedHashrate, unit)}</p>
        </div>
        <div className="bg-dark-900 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-dark-500 uppercase tracking-wider">Avg Actual</p>
          <p className={`text-sm font-bold mt-0.5 ${effColor}`}>{formatHashrate(avgHashrate, unit)}</p>
        </div>
        <div className="bg-dark-900 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-dark-500 uppercase tracking-wider">Efficiency</p>
          <p className={`text-sm font-bold mt-0.5 ${effColor}`}>{efficiency.toFixed(1)}%</p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-36">
        {/* Background grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-px bg-dark-700/30 w-full" />)}
        </div>

        {/* Advertised hashrate reference line */}
        <div className="absolute inset-x-0 z-10 pointer-events-none" style={{ bottom: `${advertisedPct}%` }}>
          <div className="border-t-2 border-dashed border-primary-400/70 w-full" />
          <span className="absolute right-0 -top-4 text-[9px] text-primary-400 font-semibold bg-dark-950/90 px-1 rounded">
            {formatHashrate(advertisedHashrate, unit)}
          </span>
        </div>

        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-px">
          {recentLogs.map((log, i) => {
            const pct = maxHr > 0 ? ((log.measured_hashrate || 0) / maxHr) * 100 : 0;
            const isLow = (log.measured_hashrate || 0) < advertisedHashrate * 0.95;
            return (
              <div
                key={i}
                className="flex-1 h-full flex flex-col justify-end group"
                title={`${formatHashrate(log.measured_hashrate || 0, unit)}`}
              >
                <div
                  className={`rounded-t-[1px] transition-colors ${isLow ? 'bg-red-500/50 group-hover:bg-red-400/75' : 'bg-primary-500/55 group-hover:bg-primary-400/75'}`}
                  style={{ height: `${Math.max(pct, 1.5)}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis + legend */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-dark-600">48h ago</span>
        <div className="flex items-center gap-3 text-[9px] text-dark-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 border-t-2 border-dashed border-primary-400/70" />
            Advertised
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 rounded-[1px] bg-primary-500/55" />
            ≥95%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 rounded-[1px] bg-red-500/50" />
            &lt;95%
          </span>
        </div>
        <span className="text-[9px] text-dark-600">now</span>
      </div>
    </div>
  );
}

/* ── Rig Rental History ─────────────────────────────────────────────────────── */
function RigRentalHistory({ rigId }: { rigId: number }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    rentalsAPI.list({ page: 1, per_page: 20 }).then(({ data }) => {
      // Filter client-side for this rig (backend doesn't have rig filter on list)
      setHistory(data.items.filter((r: any) => r.rig_id === rigId));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [rigId]);
  if (loading) return <p className="text-dark-500 text-sm text-center py-4">Loading...</p>;
  if (history.length === 0) return <p className="text-dark-500 text-sm text-center py-4">No rental history for this rig.</p>;
  return (
    <div className="space-y-2">
      {history.map(r => (
        <div key={r.id} className="flex items-center justify-between bg-dark-800 rounded-lg p-3">
          <div>
            <p className="text-sm text-white">Rental #{r.id}</p>
            <p className="text-xs text-dark-400">{r.duration_hours}h · {formatDate(r.created_at)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-accent-400">{formatLTC(r.total_cost)} LTC</p>
            <p className={`text-xs ${r.performance_percent && Number(r.performance_percent) >= 95 ? 'text-green-400' : 'text-yellow-400'}`}>
              {r.performance_percent ? `${Number(r.performance_percent).toFixed(0)}% delivery` : r.status}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── RPI Badge (MRR tiers: NEW / BAD / FAIR / GOOD / BEST) ─────────────────── */
function RPIBadge({ score, totalRentals }: { score: number; totalRentals: number }) {
  const s = Number(score);
  // MRR tier logic: < 5 rentals = NEW; otherwise score-based
  let tier: 'NEW' | 'BAD' | 'FAIR' | 'GOOD' | 'BEST';
  let color: string;
  if (totalRentals < 5) {
    tier = 'NEW'; color = 'text-blue-400 border-blue-600/40 bg-blue-900/20';
  } else if (s < 60) {
    tier = 'BAD'; color = 'text-red-400 border-red-600/40 bg-red-900/20';
  } else if (s < 75) {
    tier = 'FAIR'; color = 'text-orange-400 border-orange-600/40 bg-orange-900/20';
  } else if (s < 90) {
    tier = 'GOOD'; color = 'text-yellow-400 border-yellow-600/40 bg-yellow-900/20';
  } else {
    tier = 'BEST'; color = 'text-green-400 border-green-600/40 bg-green-900/20';
  }
  const tierDesc: Record<string, string> = {
    NEW: 'Fewer than 5 rentals completed',
    BAD: 'Significant performance issues',
    FAIR: 'Below average performance',
    GOOD: 'Reliable performance',
    BEST: 'Exceptional & consistent',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${color}`} title={tierDesc[tier]}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      RPI {tier} · {s.toFixed(0)}/100
    </div>
  );
}

/* ── Pool Slot Component ───────────────────────────────────────────────────── */
function PoolSlot({
  index, label, url, user: poolUser, password,
  onUrlChange, onUserChange, onPasswordChange, required = false,
}: {
  index: number; label: string;
  url: string; user: string; password: string;
  onUrlChange: (v: string) => void; onUserChange: (v: string) => void; onPasswordChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="bg-dark-800/60 border border-dark-700/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
          required ? 'bg-primary-500 text-dark-950' : 'bg-dark-700 text-dark-400'
        }`}>{index}</span>
        <span className="text-xs font-semibold text-dark-300 uppercase tracking-wider">{label}</span>
        {required && <span className="text-[10px] text-primary-400 ml-auto">Required</span>}
      </div>

      <div>
        <label className="block text-xs text-dark-500 mb-1">Pool URL</label>
        <Input
          placeholder="stratum+tcp://pool.example.com:3333"
          value={url} onChange={(e) => onUrlChange(e.target.value)}
          required={required}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-dark-500 mb-1">Wallet / Worker name</label>
          <Input
            placeholder="e.g. TXabc...xyz.worker1"
            value={poolUser}
            onChange={(e) => onUserChange(e.target.value)}
            required={required}
          />
        </div>
        <div>
          <label className="block text-xs text-dark-500 mb-1">Password</label>
          <Input
            placeholder="x"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────────────── */
export default function RigDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const rigId = Number(params.rigId);
  const [rig, setRig] = useState<Rig | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [poolProfiles, setPoolProfiles] = useState<PoolProfile[]>([]);

  // Rent form state
  const [showRent, setShowRent] = useState(false);
  const [duration, setDuration] = useState('2');
  const [renting, setRenting] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [autoFilledAlgo, setAutoFilledAlgo] = useState<string | null>(null);
  const [showBackupPools, setShowBackupPools] = useState(false);
  const [rigInfoTab, setRigInfoTab] = useState('statistics');

  // 5-pool failover state
  const [pools, setPools] = useState([
    { url: '', user: '', password: 'x' },
    { url: '', user: '', password: 'x' },
    { url: '', user: '', password: 'x' },
    { url: '', user: '', password: 'x' },
    { url: '', user: '', password: 'x' },
  ]);

  const updatePool = (index: number, field: 'url' | 'user' | 'password', value: string) => {
    setPools(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  useEffect(() => {
    async function load() {
      try {
        const [rigRes, reviewRes] = await Promise.all([
          rigsAPI.get(rigId),
          reviewsAPI.rigReviews(rigId),
        ]);
        setRig(rigRes.data);
        setReviews(reviewRes.data);
      } catch (_e) {
        toast.error('Unable to load rig details.');
      }
      setLoading(false);
    }
    load();
    if (user) {
      usersAPI.poolProfiles().then(({ data }) => setPoolProfiles(data)).catch(() => {});
    }
  }, [rigId, user]);

  // Auto-fill pool profile matching this rig's algorithm (MRR-style: silent auto-fill)
  useEffect(() => {
    if (!rig || poolProfiles.length === 0 || selectedProfileId) return;
    const match = poolProfiles.find(p => p.algorithm_id === rig.algorithm_id)
      || poolProfiles.find(p => !p.algorithm_id); // fallback to general profile
    if (match) {
      handleProfileSelect(match.id.toString());
      setAutoFilledAlgo(rig.algorithm?.display_name || 'saved');
    }
  }, [rig, poolProfiles]);

  // Load all 5 pools from profile
  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
    if (!profileId) return;
    const profile = poolProfiles.find(p => p.id === parseInt(profileId));
    if (profile) {
      setPools([
        { url: profile.pool_url, user: profile.pool_user, password: profile.pool_password },
        { url: profile.pool2_url || '', user: profile.pool2_user || '', password: profile.pool2_password || 'x' },
        { url: profile.pool3_url || '', user: profile.pool3_user || '', password: profile.pool3_password || 'x' },
        { url: profile.pool4_url || '', user: profile.pool4_user || '', password: profile.pool4_password || 'x' },
        { url: profile.pool5_url || '', user: profile.pool5_user || '', password: profile.pool5_password || 'x' },
      ]);
      // Auto-show backup pools if profile has them
      if (profile.pool2_url || profile.pool3_url) setShowBackupPools(true);
    }
  };

  const normalizePoolUrl = (url: string): string => {
    if (!url) return url;
    const trimmed = url.trim();
    if (trimmed && !trimmed.startsWith('stratum')) return 'stratum+tcp://' + trimmed;
    return trimmed;
  };

  const handleRent = async (e: React.FormEvent) => {
    e.preventDefault();
    setRenting(true);
    try {
      await rentalsAPI.create({
        rig_id: rigId,
        duration_hours: parseInt(duration),
        pool_url: normalizePoolUrl(pools[0].url),
        pool_user: pools[0].user,
        pool_password: pools[0].password,
        pool2_url: pools[1].url ? normalizePoolUrl(pools[1].url) : undefined,
        pool2_user: pools[1].user || undefined,
        pool2_password: pools[1].password || undefined,
        pool3_url: pools[2].url ? normalizePoolUrl(pools[2].url) : undefined,
        pool3_user: pools[2].user || undefined,
        pool3_password: pools[2].password || undefined,
        pool4_url: pools[3].url ? normalizePoolUrl(pools[3].url) : undefined,
        pool4_user: pools[3].user || undefined,
        pool4_password: pools[3].password || undefined,
        pool5_url: pools[4].url ? normalizePoolUrl(pools[4].url) : undefined,
        pool5_user: pools[4].user || undefined,
        pool5_password: pools[4].password || undefined,
      });

      // Auto-save pool profile per algorithm (MRR-style: silently update or create)
      if (pools[0].url && pools[0].user) {
        try {
          const profileData = {
            pool_url: normalizePoolUrl(pools[0].url),
            pool_user: pools[0].user,
            pool_password: pools[0].password || 'x',
            pool2_url: pools[1].url ? normalizePoolUrl(pools[1].url) : undefined,
            pool2_user: pools[1].user || undefined,
            pool2_password: pools[1].password || undefined,
            pool3_url: pools[2].url ? normalizePoolUrl(pools[2].url) : undefined,
            pool3_user: pools[2].user || undefined,
            pool3_password: pools[2].password || undefined,
            pool4_url: pools[3].url ? normalizePoolUrl(pools[3].url) : undefined,
            pool4_user: pools[3].user || undefined,
            pool4_password: pools[3].password || undefined,
            pool5_url: pools[4].url ? normalizePoolUrl(pools[4].url) : undefined,
            pool5_user: pools[4].user || undefined,
            pool5_password: pools[4].password || undefined,
          };
          if (selectedProfileId) {
            await usersAPI.updatePoolProfile(parseInt(selectedProfileId), profileData);
          } else {
            // First time for this algorithm — create profile named after the algorithm
            await usersAPI.createPoolProfile({
              name: rig?.algorithm?.display_name || 'My Pool',
              algorithm_id: rig?.algorithm_id || undefined,
              ...profileData,
            });
          }
        } catch (_e) { /* silent — pool save is non-critical */ }
      }

      toast.success('Rental started successfully!');
      router.push('/rentals');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Unable to create rental.');
    }
    setRenting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!rig) {
    return <Card className="text-center py-12"><p className="text-dark-400 text-lg">Rig not found</p></Card>;
  }

  const parsedDuration = Math.max(0, parseInt(duration || '0'));
  const totalCost = Number(rig.price_per_hour) * parsedDuration;
  const renterFee = Math.round(totalCost * 0.03 * 100) / 100; // 3% renter fee
  const totalWithFee = Math.round((totalCost + renterFee) * 100) / 100;
  const isOwner = user?.id === rig.owner_id;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <button onClick={() => router.back()} className="text-dark-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Marketplace
      </button>

      {/* ── Hero Header ── */}
      <Card className="!p-0 overflow-hidden">
        {/* Top bar: name + status */}
        <div className="px-6 py-4 border-b border-dark-700/50 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{rig.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-dark-400 uppercase tracking-wider">{rig.algorithm?.display_name}</span>
              <span className="text-xs text-dark-500 flex items-center gap-1">
                <span className="text-sm leading-none">{regionInfo(rig.region).flag}</span>
                {regionInfo(rig.region).label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <RPIBadge score={rig.rpi_score} totalRentals={rig.total_rentals} />
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusBadgeColor(rig.status)}`}>
              <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${rig.status === 'active' ? 'bg-green-400 animate-pulse' : rig.status === 'rented' ? 'bg-blue-400' : 'bg-red-400'}`} />
              {rig.status}
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-dark-700/50">
          {[
            { label: 'Hashrate', value: formatHashrate(rig.hashrate, rig.algorithm?.unit), accent: true },
            { label: 'Price / Hour', value: `${formatLTC(rig.price_per_hour)} LTC`, accent: true },
            { label: 'Devices', value: `${rig.ndevices ?? 1}` },
            { label: 'Uptime', value: `${Number(rig.uptime_percentage).toFixed(1)}%` },
            { label: 'Rentals', value: `${rig.total_rentals}` },
          ].map(item => (
            <div key={item.label} className="px-4 py-4 text-center">
              <p className={`text-lg font-black ${item.accent ? 'text-accent-400' : 'text-white'}`}>{item.value}</p>
              <p className="text-[10px] text-dark-500 uppercase tracking-wider mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Owner row */}
        <div className="px-6 py-3 border-t border-dark-700/50 flex items-center justify-between bg-dark-900/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">{(rig.owner?.username || '?').charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-sm text-dark-400">by <span className="text-primary-400 font-medium">{rig.owner?.username || 'Unknown'}</span></span>
          </div>
          <span className="text-xs text-dark-500">
            {rig.min_rental_hours}–{rig.max_rental_hours}h · {rig.total_rentals} rentals
          </span>
        </div>
      </Card>

      {/* ── Owner Info ── */}
      {rig.owner && (
        <Card className="!py-3 !px-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0 shadow-neon">
              <span className="text-white text-sm font-black">{rig.owner.username.charAt(0).toUpperCase()}</span>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-white font-bold">{rig.owner.username}</span>
                <span className="text-dark-500 text-xs">Member {timeAgo(rig.owner.created_at)}</span>
                {rig.owner.bio && <span className="text-dark-400 text-xs hidden md:inline">·</span>}
              </div>
              {rig.owner.bio && (
                <p className="text-xs text-dark-400 mt-1 line-clamp-2">{rig.owner.bio}</p>
              )}
            </div>
            {/* Quick stats */}
            <div className="flex items-center gap-4 shrink-0 text-center">
              <div>
                <p className="text-sm font-bold text-white">{rig.total_rentals}</p>
                <p className="text-[10px] text-dark-500 uppercase tracking-wider">Rentals</p>
              </div>
              <div>
                <p className="text-sm font-bold text-white">{Number(rig.average_rating) > 0 ? `${Number(rig.average_rating).toFixed(1)}★` : '—'}</p>
                <p className="text-[10px] text-dark-500 uppercase tracking-wider">Rating</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Two-column: Info Tabs (left) + Rent Form (right) ── */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── Info Tabs (LEFT) ── */}
        <Card>
          <div className="flex overflow-x-auto border-b border-dark-700">
            {['statistics', 'description', 'rental-history', 'reviews'].map(t => (
              <button key={t} onClick={() => setRigInfoTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${rigInfoTab === t ? 'border-primary-400 text-primary-400' : 'border-transparent text-dark-400 hover:text-white'}`}>
                {t === 'statistics' ? 'Statistics' : t === 'description' ? 'Description' : t === 'rental-history' ? 'Rental History' : `Reviews (${reviews.length})`}
              </button>
            ))}
          </div>
          <CardContent>
            {rigInfoTab === 'statistics' && (
              <div className="space-y-5">
                {/* Hashrate chart */}
                <div>
                  <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">Hashrate Performance (48h)</p>
                  <HashrateHistoryChart
                    rigId={rigId}
                    advertisedHashrate={Number(rig.hashrate)}
                    unit={rig.algorithm?.unit || 'TH/s'}
                  />
                </div>

                {/* Rig info grid */}
                <div>
                  <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">Rig Specifications</p>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Region gets special treatment with a flag */}
                    <div className="col-span-2 bg-dark-900 rounded-lg px-3 py-2 flex justify-between items-center">
                      <span className="text-[10px] text-dark-500 uppercase tracking-wider">Region</span>
                      <span className="text-xs font-medium text-dark-200 flex items-center gap-1.5">
                        <span className="text-base leading-none">{regionInfo(rig.region).flag}</span>
                        {regionInfo(rig.region).label}
                      </span>
                    </div>
                    {[
                      { label: 'Algorithm', value: rig.algorithm?.display_name || '—' },
                      { label: 'Devices', value: `${rig.ndevices ?? 1} device${(rig.ndevices ?? 1) > 1 ? 's' : ''}` },
                      { label: 'Listed', value: formatDate(rig.created_at) },
                      { label: 'Min Rental', value: `${rig.min_rental_hours}h` },
                      { label: 'Max Rental', value: `${rig.max_rental_hours}h` },
                      { label: 'Extensions', value: rig.extensions_enabled ? 'Allowed' : 'Disabled' },
                      { label: 'Uptime', value: `${Number(rig.uptime_percentage).toFixed(1)}%` },
                    ].map(item => (
                      <div key={item.label} className="bg-dark-900 rounded-lg px-3 py-2 flex justify-between items-center">
                        <span className="text-[10px] text-dark-500 uppercase tracking-wider">{item.label}</span>
                        <span className="text-xs font-medium text-dark-200">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Difficulty reference */}
                {(rig.suggested_difficulty || rig.optimal_diff_min || rig.optimal_diff_max) && (
                  <div>
                    <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">Work Difficulty</p>
                    <div className="space-y-2">
                      {rig.suggested_difficulty && (
                        <div className="flex items-center justify-between bg-amber-900/10 border border-amber-700/25 rounded-lg px-3 py-2.5">
                          <div>
                            <p className="text-[10px] text-amber-500 uppercase tracking-wider">Suggested Difficulty</p>
                            <p className="text-sm font-mono font-bold text-white mt-0.5">{rig.suggested_difficulty}</p>
                          </div>
                          <p className="text-[10px] text-dark-500 font-mono">d={rig.suggested_difficulty}</p>
                        </div>
                      )}
                      {(rig.optimal_diff_min || rig.optimal_diff_max) && (
                        <div className="grid grid-cols-2 gap-2">
                          {rig.optimal_diff_min && (
                            <div className="bg-red-900/10 border border-red-700/25 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-red-400/80 uppercase tracking-wider">Min Difficulty</p>
                              <p className="text-sm font-mono font-bold text-white">{rig.optimal_diff_min.toLocaleString()}</p>
                            </div>
                          )}
                          {rig.optimal_diff_max && (
                            <div className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-dark-500 uppercase tracking-wider">Max Difficulty</p>
                              <p className="text-sm font-mono font-bold text-white">{rig.optimal_diff_max.toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {rigInfoTab === 'description' && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-yellow-900/10 border border-yellow-700/20 rounded-lg">
                  <svg className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-yellow-400">Be cautious of rigs that restrict you to a specific pool. You should always be able to mine at any pool of your choice.</p>
                </div>
                {rig.description ? (
                  <div className="bg-dark-900/50 border border-dark-700/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">{(rig.owner?.username || '?').charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-xs text-dark-400">Notes from <span className="text-primary-400 font-medium">{rig.owner?.username || 'Owner'}</span></span>
                    </div>
                    <p className="text-sm text-dark-200 whitespace-pre-wrap leading-relaxed">{rig.description}</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-8 h-8 text-dark-700 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-dark-500">No owner notes for this rig.</p>
                    <p className="text-xs text-dark-600 mt-1">Check the Statistics tab for difficulty settings.</p>
                  </div>
                )}
              </div>
            )}
            {rigInfoTab === 'rental-history' && <RigRentalHistory rigId={rigId} />}
            {rigInfoTab === 'reviews' && (
              reviews.length === 0 ? (
                <p className="text-dark-500 text-sm text-center py-4">No reviews yet</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-dark-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{review.reviewer?.username || 'Anonymous'}</span>
                        <span className="text-yellow-400 text-sm">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                      </div>
                      {review.comment && <p className="text-sm text-dark-300">{review.comment}</p>}
                      <p className="text-xs text-dark-500 mt-2">{formatDate(review.created_at)}</p>
                    </div>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* ── Rent This Rig (RIGHT) ── */}
        <Card className="!p-0 overflow-hidden border-primary-500/20 sticky top-6">
          {/* Section header */}
          <div className="px-6 py-4 border-b border-dark-700/50 bg-primary-500/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-500/15 border border-primary-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Rent This Rig</h2>
              <p className="text-xs text-dark-400">Configure your pool and start mining instantly</p>
            </div>
          </div>

          <div className="p-6">
            {isOwner ? (
              <div className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full bg-dark-800 border border-dark-700 flex items-center justify-center">
                  <svg className="w-5 h-5 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
                  </svg>
                </div>
                <p className="text-dark-400 text-sm">This is your rig. You cannot rent your own listing.</p>
              </div>
            ) : !user ? (
              <div className="flex items-center justify-between py-4">
                <p className="text-dark-400 text-sm">You need to be logged in to rent this rig.</p>
                <Button onClick={() => router.push('/login')}>Log In</Button>
              </div>
            ) : rig.status !== 'active' ? (
              <div className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full bg-red-900/20 border border-red-700/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Rig Unavailable</p>
                  <p className="text-xs text-dark-500 mt-0.5">This rig is currently {rig.status}. Check back later.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRent} className="space-y-5">

                {/* Duration + Cost Summary */}
                <div>
                  <label className="block text-xs text-dark-400 mb-1.5">
                    Duration — min {rig.min_rental_hours}h · max {rig.max_rental_hours}h
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      min={rig.min_rental_hours}
                      max={rig.max_rental_hours}
                      required
                      className="flex-1"
                    />
                    <span className="text-dark-500 text-sm shrink-0">hours</span>
                  </div>
                </div>

                {/* Live cost box */}
                <div className="bg-dark-900 border border-dark-700 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-500">{formatLTC(rig.price_per_hour)} × {parsedDuration}h</span>
                    <span className="text-white">{formatLTC(totalCost)} LTC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-500">Service fee (3%)</span>
                    <span className="text-dark-400">{formatLTC(renterFee)} LTC</span>
                  </div>
                  <div className="border-t border-dark-700 pt-2 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-white">Total</span>
                    <span className="text-xl font-black text-accent-400">{formatLTC(totalWithFee)} LTC</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-dark-600">Your balance</span>
                    <span className={totalWithFee > Number(user?.balance || 0) && parsedDuration > 0 ? 'text-red-400 font-medium' : 'text-dark-500'}>
                      {formatLTC(user?.balance || 0)} LTC
                    </span>
                  </div>
                </div>

                {/* ── Difficulty Settings for Renter ── */}
                {(rig.suggested_difficulty || rig.optimal_diff_min || rig.optimal_diff_max) && (
                  <div className="bg-amber-900/10 border border-amber-700/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Difficulty Settings Required</p>
                    </div>

                    {rig.suggested_difficulty && (
                      <div className="flex items-center justify-between bg-dark-900/60 rounded-lg px-3 py-2.5">
                        <div>
                          <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-0.5">Suggested Difficulty</p>
                          <p className="text-base font-mono font-bold text-white">{rig.suggested_difficulty}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(`d=${rig.suggested_difficulty}`); toast.success('Copied!'); }}
                          className="text-xs text-primary-400 hover:text-primary-300 font-mono bg-primary-400/10 hover:bg-primary-400/20 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Copy d={rig.suggested_difficulty}
                        </button>
                      </div>
                    )}

                    {(rig.optimal_diff_min || rig.optimal_diff_max) && (
                      <div className="flex gap-2 text-xs">
                        {rig.optimal_diff_min && (
                          <div className="flex-1 bg-red-900/10 border border-red-700/20 rounded-lg px-2.5 py-2">
                            <p className="text-[9px] text-red-400/70 uppercase tracking-wider">Min — do not go below</p>
                            <p className="font-mono font-bold text-red-300 mt-0.5">{rig.optimal_diff_min.toLocaleString()}</p>
                          </div>
                        )}
                        {rig.optimal_diff_max && (
                          <div className="flex-1 bg-dark-900/60 border border-dark-700/50 rounded-lg px-2.5 py-2">
                            <p className="text-[9px] text-dark-500 uppercase tracking-wider">Max — do not exceed</p>
                            <p className="font-mono font-bold text-dark-300 mt-0.5">{rig.optimal_diff_max.toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-[10px] text-dark-500 leading-relaxed">
                      Set in your pool password field: <span className="font-mono text-amber-400/70">d={rig.suggested_difficulty || rig.optimal_diff_min || '1024'}</span> — or in your pool's worker/dashboard settings. Incorrect difficulty causes invalid shares and poor performance.
                    </p>
                  </div>
                )}

                {/* ── Suggested difficulty hint (if no optimal range) ── */}
                {rig.suggested_difficulty && !rig.optimal_diff_min && !rig.optimal_diff_max && (
                  <></> /* already shown above */
                )}

                {/* Auto-filled pool indicator (MRR-style: silent auto-fill, show only badge) */}
                {autoFilledAlgo ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-900/10 border border-green-700/20 rounded-lg">
                    <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-green-400 flex-1">
                      Pool auto-filled from your <span className="font-semibold">{autoFilledAlgo}</span> profile
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setPools([
                          { url: '', user: '', password: 'x' },
                          { url: '', user: '', password: 'x' },
                          { url: '', user: '', password: 'x' },
                          { url: '', user: '', password: 'x' },
                          { url: '', user: '', password: 'x' },
                        ]);
                        setSelectedProfileId('');
                        setAutoFilledAlgo(null);
                        setShowBackupPools(false);
                      }}
                      className="text-dark-500 hover:text-dark-300 text-[10px] underline transition-colors shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-dark-600 -mt-1">Pool info will be saved automatically after your first rental for this algorithm.</p>
                )}

                {/* Primary Pool */}
                <PoolSlot
                  index={1} label="Primary Pool" required
                  url={pools[0].url} user={pools[0].user} password={pools[0].password}
                  onUrlChange={(v) => updatePool(0, 'url', v)}
                  onUserChange={(v) => updatePool(0, 'user', v)}
                  onPasswordChange={(v) => updatePool(0, 'password', v)}
                />

                {/* Backup Pools toggle */}
                <button
                  type="button"
                  onClick={() => setShowBackupPools(!showBackupPools)}
                  className="flex items-center gap-2 text-xs text-dark-400 hover:text-primary-400 transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform ${showBackupPools ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {showBackupPools ? 'Hide backup pools' : 'Add backup / failover pools (2–5)'}
                </button>

                {showBackupPools && (
                  <div className="space-y-4 pl-2 border-l-2 border-dark-700/50">
                    {[1, 2, 3, 4].map(i => (
                      <PoolSlot
                        key={i}
                        index={i + 1} label={`Backup Pool ${i + 1}`}
                        url={pools[i].url} user={pools[i].user} password={pools[i].password}
                        onUrlChange={(v) => updatePool(i, 'url', v)}
                        onUserChange={(v) => updatePool(i, 'user', v)}
                        onPasswordChange={(v) => updatePool(i, 'password', v)}
                      />
                    ))}
                    <p className="text-xs text-dark-600 pl-1">If a pool goes offline, hashrate automatically switches to the next backup.</p>
                  </div>
                )}

                {/* Submit */}
                <div className="pt-2 border-t border-dark-700/50">
                  {totalWithFee > Number(user?.balance || 0) && parsedDuration > 0 && (
                    <p className="text-sm text-red-400 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Insufficient balance. Please deposit LTC to your wallet first.
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full py-3 text-base font-bold"
                    loading={renting}
                    disabled={
                      parsedDuration < rig.min_rental_hours ||
                      parsedDuration > rig.max_rental_hours ||
                      totalWithFee > Number(user?.balance || 0)
                    }
                  >
                    Confirm Rental · {formatLTC(totalWithFee)} LTC
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}
