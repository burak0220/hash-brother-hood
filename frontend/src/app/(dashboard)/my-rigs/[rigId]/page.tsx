'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import { rigsAPI } from '@/lib/api';
import { formatLTC, formatHashrate, statusBadgeColor, getUnitOptions, convertHashrate, regionInfo } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import toast from 'react-hot-toast';
import type { Rig } from '@/types';

const STRATUM_HOST = process.env.NEXT_PUBLIC_STRATUM_HOST || 'stratum.hashbrotherhood.com';
const STRATUM_PORT = process.env.NEXT_PUBLIC_STRATUM_PORT || '3333';

export default function ManageRigPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const rigId = Number(params.rigId);
  const [rig, setRig] = useState<Rig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hashrate, setHashrate] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [pricePerHour, setPricePerHour] = useState('');
  const [status, setStatus] = useState('');
  const [minHours, setMinHours] = useState('');
  const [maxHours, setMaxHours] = useState('');
  const [region, setRegion] = useState('auto');
  // MRR features
  const [suggestedDifficulty, setSuggestedDifficulty] = useState('');
  const [optimalDiffMin, setOptimalDiffMin] = useState('');
  const [optimalDiffMax, setOptimalDiffMax] = useState('');
  const [ndevices, setNdevices] = useState('1');
  const [extensionsEnabled, setExtensionsEnabled] = useState(true);
  const [autoPriceEnabled, setAutoPriceEnabled] = useState(false);
  const [autoPriceMargin, setAutoPriceMargin] = useState('0');
  const [ownerPoolUrl, setOwnerPoolUrl] = useState('');
  const [ownerPoolUser, setOwnerPoolUser] = useState('');
  const [ownerPoolPassword, setOwnerPoolPassword] = useState('x');

  useEffect(() => {
    rigsAPI.get(rigId).then(({ data }) => {
      setRig(data);
      setName(data.name);
      setDescription(data.description || '');
      setHashrate(data.hashrate.toString());
      setSelectedUnit(data.algorithm?.unit || 'TH/s');
      setPricePerHour(data.price_per_hour.toString());
      setStatus(data.status);
      setMinHours(data.min_rental_hours.toString());
      setMaxHours(data.max_rental_hours.toString());
      setRegion(data.region || 'auto');
      setSuggestedDifficulty(data.suggested_difficulty || '');
      setOptimalDiffMin(data.optimal_diff_min?.toString() || '');
      setOptimalDiffMax(data.optimal_diff_max?.toString() || '');
      setNdevices((data.ndevices ?? 1).toString());
      setExtensionsEnabled(data.extensions_enabled ?? true);
      setAutoPriceEnabled(data.auto_price_enabled);
      setAutoPriceMargin(data.auto_price_margin.toString());
      setOwnerPoolUrl(data.owner_pool_url || '');
      setOwnerPoolUser(data.owner_pool_user || '');
      setOwnerPoolPassword(data.owner_pool_password || 'x');
    }).catch(() => toast.error('Unable to load rig details. Please try again.')).finally(() => setLoading(false));
  }, [rigId]);

  const algoBaseUnit = rig?.algorithm?.unit || 'TH/s';
  const unitOptions = getUnitOptions(algoBaseUnit);

  // Preview converted hashrate
  const previewHashrate = hashrate
    ? convertHashrate(parseFloat(hashrate) || 0, selectedUnit, algoBaseUnit)
    : 0;

  const handleSave = async () => {
    setSaving(true);
    const price = parseFloat(pricePerHour);
    if (!price || price <= 0) {
      toast.error('Price per hour must be greater than zero.');
      setSaving(false);
      return;
    }
    try {
      // Convert hashrate from selected unit to algorithm's base unit
      const inputValue = parseFloat(hashrate);
      const convertedHashrate = convertHashrate(inputValue, selectedUnit, algoBaseUnit);

      const { data } = await rigsAPI.update(rigId, {
        name, description: description || null,
        hashrate: convertedHashrate, price_per_hour: parseFloat(pricePerHour),
        status, min_rental_hours: parseInt(minHours), max_rental_hours: parseInt(maxHours),
        region,
        suggested_difficulty: suggestedDifficulty || null,
        optimal_diff_min: optimalDiffMin ? parseInt(optimalDiffMin) : undefined,
        optimal_diff_max: optimalDiffMax ? parseInt(optimalDiffMax) : undefined,
        ndevices: parseInt(ndevices) || 1,
        extensions_enabled: extensionsEnabled,
        auto_price_enabled: autoPriceEnabled,
        auto_price_margin: parseFloat(autoPriceMargin),
        owner_pool_url: ownerPoolUrl || null,
        owner_pool_user: ownerPoolUser || null,
        owner_pool_password: ownerPoolPassword || 'x',
      });
      setRig(data);
      // Reset hashrate display to base unit value
      setHashrate(data.hashrate.toString());
      setSelectedUnit(data.algorithm?.unit || algoBaseUnit);
      setEditing(false);
      toast.success('Your rig has been updated successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to update the rig. Please try again.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this rig? This action cannot be undone.')) return;
    try {
      await rigsAPI.delete(rigId);
      toast.success('Your rig has been removed from the platform.');
      router.push('/my-rigs');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to delete the rig. It may have active rentals.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!rig) {
    return <Card className="text-center py-12"><p className="text-dark-400">Rig not found</p></Card>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-dark-400 hover:text-white text-sm flex items-center gap-1 mb-2 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-white">{rig.name}</h1>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${statusBadgeColor(rig.status)}`}>{rig.status}</span>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Save</Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <Card>
          <div className="space-y-4">
            <Input label="Rig Name" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Description</label>
              <textarea
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 min-h-[80px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {/* Hashrate + Unit Selector */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Hashrate</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input type="number" step="0.0001" min="0.0001" value={hashrate} onChange={(e) => setHashrate(e.target.value)} />
                </div>
                <div className="w-44">
                  <Select
                    options={unitOptions}
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                  />
                </div>
              </div>
              {hashrate && selectedUnit !== algoBaseUnit && previewHashrate > 0 && (
                <p className="text-xs text-dark-500 mt-1">
                  = {previewHashrate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {algoBaseUnit}
                </p>
              )}
            </div>
            <Input label="Price per Hour (LTC)" type="number" step="0.00000001" min="0.00000001" value={pricePerHour} onChange={(e) => setPricePerHour(e.target.value)} />
            <Select
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'maintenance', label: 'Maintenance' },
              ]}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
            <Select
              label="Region"
              options={[
                { value: 'auto',       label: '🌐  Auto (no preference)' },
                { value: 'us-east',    label: '🇺🇸  US East (New York / Virginia)' },
                { value: 'us-west',    label: '🇺🇸  US West (California / Oregon)' },
                { value: 'us-central', label: '🇺🇸  US Central (Texas / Chicago)' },
                { value: 'ca',         label: '🇨🇦  Canada' },
                { value: 'eu-west',    label: '🇪🇺  EU West (UK / Netherlands)' },
                { value: 'eu-de',      label: '🇩🇪  EU Germany (Frankfurt)' },
                { value: 'eu-fr',      label: '🇫🇷  EU France (Paris)' },
                { value: 'eu-nl',      label: '🇳🇱  EU Netherlands (Amsterdam)' },
                { value: 'eu-fi',      label: '🇫🇮  EU Finland (Helsinki)' },
                { value: 'eu-se',      label: '🇸🇪  EU Sweden (Stockholm)' },
                { value: 'ru',         label: '🇷🇺  Russia (Moscow)' },
                { value: 'asia',       label: '🌏  Asia Pacific' },
                { value: 'asia-sg',    label: '🇸🇬  Asia Pacific (Singapore)' },
                { value: 'asia-jp',    label: '🇯🇵  Asia Pacific (Tokyo)' },
                { value: 'asia-hk',    label: '🇭🇰  Asia Pacific (Hong Kong)' },
                { value: 'asia-kr',    label: '🇰🇷  Asia Pacific (Seoul)' },
                { value: 'au',         label: '🇦🇺  Australia (Sydney)' },
                { value: 'sa',         label: '🌎  South America (São Paulo)' },
              ]}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Min Rental (hours)" type="number" min="1" value={minHours} onChange={(e) => setMinHours(e.target.value)} />
              <Input label="Max Rental (hours)" type="number" min="1" max="8760" value={maxHours} onChange={(e) => setMaxHours(e.target.value)} />
            </div>

            {/* MRR Features */}
            <div className="border-t border-dark-700 pt-4 mt-2">
              <p className="text-sm font-medium text-dark-300 mb-3">Advanced Settings</p>

              <div className="space-y-4">
                <Input
                  label="Number of Devices"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={ndevices}
                  onChange={(e) => setNdevices(e.target.value)}
                />

                {/* Difficulty Settings */}
                <div className="border border-dark-700/50 rounded-xl p-3 space-y-3 bg-dark-900/30">
                  <p className="text-xs font-semibold text-dark-300">Work Difficulty Settings</p>
                  <Input
                    label="Suggested Difficulty"
                    placeholder="e.g., 1024, 8192"
                    value={suggestedDifficulty}
                    onChange={(e) => setSuggestedDifficulty(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Min Difficulty"
                      type="number"
                      min="1"
                      placeholder="e.g., 512"
                      value={optimalDiffMin}
                      onChange={(e) => setOptimalDiffMin(e.target.value)}
                    />
                    <Input
                      label="Max Difficulty"
                      type="number"
                      min="1"
                      placeholder="e.g., 262144"
                      value={optimalDiffMax}
                      onChange={(e) => setOptimalDiffMax(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-dark-600">Renters set difficulty in their pool password: <span className="font-mono">d=&lt;value&gt;</span></p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="ext-edit"
                    checked={extensionsEnabled}
                    onChange={(e) => setExtensionsEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
                  />
                  <label htmlFor="ext-edit" className="text-sm text-dark-300">Allow rental extensions</label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="auto-price"
                    checked={autoPriceEnabled}
                    onChange={(e) => setAutoPriceEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
                  />
                  <label htmlFor="auto-price" className="text-sm text-dark-300">Auto Pricing (adjust based on market)</label>
                </div>

                {autoPriceEnabled && (
                  <Input
                    label="Price Margin (%)"
                    type="number" step="0.01" min="-50" max="100"
                    placeholder="0 = market average, +10 = 10% above"
                    value={autoPriceMargin}
                    onChange={(e) => setAutoPriceMargin(e.target.value)}
                  />
                )}

                <div className="border-t border-dark-700 pt-3">
                  <p className="text-xs font-medium text-dark-400 mb-2">Owner Fallback Pool (used when rig is idle or all renter pools fail)</p>
                  <div className="space-y-2">
                    <Input placeholder="stratum+tcp://pool:port" value={ownerPoolUrl} onChange={(e) => setOwnerPoolUrl(e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Wallet / Worker" value={ownerPoolUser} onChange={(e) => setOwnerPoolUser(e.target.value)} />
                      <Input placeholder="Password (x)" value={ownerPoolPassword} onChange={(e) => setOwnerPoolPassword(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Algorithm', value: rig.algorithm?.display_name || '-' },
              { label: 'Hashrate', value: formatHashrate(rig.hashrate, rig.algorithm?.unit) },
              { label: 'Price/Hour', value: `${formatLTC(rig.price_per_hour)} LTC` },
              { label: 'Min Rental', value: `${rig.min_rental_hours}h` },
              { label: 'Max Rental', value: `${rig.max_rental_hours}h` },
              { label: 'Region', value: `${regionInfo(rig.region).flag} ${regionInfo(rig.region).label}` },
              { label: 'Devices', value: `${rig.ndevices ?? 1}` },
              { label: 'Extensions', value: rig.extensions_enabled ? 'Allowed' : 'Disabled' },
              { label: 'Uptime', value: `${Number(rig.uptime_percentage)}%` },
              { label: 'Total Rentals', value: rig.total_rentals.toString() },
              { label: 'Rating', value: `${Number(rig.average_rating).toFixed(1)}/5.0` },
              { label: 'RPI Score', value: `${Number(rig.rpi_score).toFixed(0)}/100` },
              ...(rig.suggested_difficulty ? [{ label: 'Suggested Diff', value: rig.suggested_difficulty }] : []),
              ...(rig.optimal_diff_min ? [{ label: 'Min Difficulty', value: rig.optimal_diff_min.toLocaleString() }] : []),
              ...(rig.optimal_diff_max ? [{ label: 'Max Difficulty', value: rig.optimal_diff_max.toLocaleString() }] : []),
              { label: 'Auto Pricing', value: rig.auto_price_enabled ? `On (${rig.auto_price_margin}%)` : 'Off' },
            ].map((item) => (
              <div key={item.label} className="bg-dark-800 rounded-lg p-3">
                <p className="text-xs text-dark-400">{item.label}</p>
                <p className="text-sm font-medium text-white mt-1">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Connection Info — how to connect your miner */}
          <div className="mt-4 p-4 bg-primary-900/10 border border-primary-700/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
              <p className="text-sm font-semibold text-primary-400">Connect Your Miner</p>
            </div>
            <p className="text-xs text-dark-400 mb-2">Point your mining software to these settings:</p>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex items-center justify-between bg-dark-800 rounded px-3 py-2 gap-2">
                <span className="text-dark-400 shrink-0">URL</span>
                <span className="text-white truncate">stratum+tcp://{STRATUM_HOST}:{STRATUM_PORT}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(`stratum+tcp://${STRATUM_HOST}:${STRATUM_PORT}`); toast.success('Stratum URL copied!'); }}
                  className="text-dark-500 hover:text-primary-400 transition-colors shrink-0"
                  title="Copy"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
              </div>
              <div className="flex items-center justify-between bg-dark-800 rounded px-3 py-2 gap-2">
                <span className="text-dark-400 shrink-0">Worker</span>
                <span className="text-white truncate">{user?.username || rig.owner?.username}.{rig.id}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${user?.username || rig.owner?.username}.${rig.id}`); toast.success('Worker name copied!'); }}
                  className="text-dark-500 hover:text-primary-400 transition-colors shrink-0"
                  title="Copy"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
              </div>
              <div className="flex items-center justify-between bg-dark-800 rounded px-3 py-2 gap-2">
                <span className="text-dark-400 shrink-0">Password</span>
                <span className="text-white">x</span>
                <span className="w-3.5" />
              </div>
            </div>
            <p className="text-xs text-dark-500 mt-2">When a renter hires your rig, hashrate is routed to their pool. When idle, it goes to your fallback pool.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
