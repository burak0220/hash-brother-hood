'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import { rigsAPI, algorithmsAPI } from '@/lib/api';
import { getUnitOptions, getUnitBaseType, convertHashrate } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Algorithm } from '@/types';

const UNIT_OPTIONS = [
  { value: 'TH/s', label: 'TH/s (Terahash)' },
  { value: 'GH/s', label: 'GH/s (Gigahash)' },
  { value: 'MH/s', label: 'MH/s (Megahash)' },
  { value: 'KH/s', label: 'KH/s (Kilohash)' },
  { value: 'H/s', label: 'H/s (Hash)' },
  { value: 'Sol/s', label: 'Sol/s (Solutions)' },
  { value: 'G/s', label: 'G/s (Graphs)' },
];

export default function NewRigPage() {
  const router = useRouter();
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewAlgo, setShowNewAlgo] = useState(false);
  const [newAlgoName, setNewAlgoName] = useState('');
  const [newAlgoUnit, setNewAlgoUnit] = useState('MH/s');
  const [creatingAlgo, setCreatingAlgo] = useState(false);
  const [algoSearch, setAlgoSearch] = useState('');
  const [showAlgoDropdown, setShowAlgoDropdown] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [algorithmId, setAlgorithmId] = useState('');
  const [hashrate, setHashrate] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [pricePerHour, setPricePerHour] = useState('');
  const [minHours, setMinHours] = useState('1');
  const [maxHours, setMaxHours] = useState('720');
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
    algorithmsAPI.list().then(({ data }) => {
      setAlgorithms(data);
      if (data.length > 0) {
        setAlgorithmId(data[0].id.toString());
        setSelectedUnit(data[0].unit);
      }
    }).catch(() => {});
  }, []);

  // When algorithm changes, update unit + auto-fill difficulty defaults
  const handleAlgorithmChange = (newAlgoId: string) => {
    setAlgorithmId(newAlgoId);
    const algo = algorithms.find(a => a.id.toString() === newAlgoId);
    if (algo) {
      setSelectedUnit(algo.unit);
      // Auto-fill difficulty from algorithm defaults (only if not already filled)
      if (algo.diff_suggested && !suggestedDifficulty) setSuggestedDifficulty(String(algo.diff_suggested));
      if (algo.diff_min && !optimalDiffMin) setOptimalDiffMin(String(algo.diff_min));
      if (algo.diff_max && !optimalDiffMax) setOptimalDiffMax(String(algo.diff_max));
    }
  };

  const selectedAlgo = algorithms.find((a) => a.id.toString() === algorithmId);
  const algoBaseUnit = selectedAlgo?.unit || 'TH/s';
  const unitOptions = getUnitOptions(algoBaseUnit);

  const handleCreateAlgorithm = async () => {
    if (!newAlgoName.trim()) return;
    setCreatingAlgo(true);
    try {
      const { data: newAlgo } = await algorithmsAPI.create({
        display_name: newAlgoName.trim(),
        unit: newAlgoUnit,
      });
      setAlgorithms((prev) => [...prev, newAlgo].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setAlgorithmId(newAlgo.id.toString());
      setSelectedUnit(newAlgo.unit);
      setNewAlgoName('');
      setShowNewAlgo(false);
      toast.success(`${newAlgo.display_name} has been added to the platform.`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to add the algorithm. Please try again.');
    }
    setCreatingAlgo(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const price = parseFloat(pricePerHour);
    if (!price || price <= 0) {
      toast.error('Price per hour must be greater than zero.');
      setLoading(false);
      return;
    }
    try {
      // Convert hashrate from selected unit to algorithm's base unit
      const inputValue = parseFloat(hashrate);
      const convertedHashrate = convertHashrate(inputValue, selectedUnit, algoBaseUnit);

      await rigsAPI.create({
        name,
        description: description || null,
        algorithm_id: parseInt(algorithmId),
        hashrate: convertedHashrate,
        price_per_hour: parseFloat(pricePerHour),
        min_rental_hours: parseInt(minHours),
        max_rental_hours: parseInt(maxHours),
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
      toast.success('Your rig has been listed on the marketplace.');
      router.push('/my-rigs');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to create the rig listing. Please check your inputs and try again.');
    }
    setLoading(false);
  };

  // Preview: show the converted value in the algorithm's base unit
  const previewHashrate = hashrate
    ? convertHashrate(parseFloat(hashrate) || 0, selectedUnit, algoBaseUnit)
    : 0;

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Add New Rig</h1>
        <p className="text-dark-400">List your rig on the hashpower market</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Rig Name" placeholder="e.g., Antminer S19 Pro" value={name} onChange={(e) => setName(e.target.value)} required />

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">Description</label>
            <textarea
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all min-h-[80px]"
              placeholder={"Describe your rig to renters. Include:\n- Hardware (e.g., 2× Antminer S19 Pro)\n- Mining software (e.g., cgminer, xmrig)\n- Any pool restrictions or requirements\n- Recommended difficulty settings\n- Notes about uptime or maintenance windows"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Algorithm Selection — searchable dropdown */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-dark-300">Algorithm</label>
              <button
                type="button"
                onClick={() => setShowNewAlgo(!showNewAlgo)}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-1"
              >
                {showNewAlgo ? (
                  <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>Cancel</>
                ) : (
                  <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add new algorithm</>
                )}
              </button>
            </div>

            {showNewAlgo ? (
              <div className="p-4 bg-dark-800/50 border border-primary-400/20 rounded-lg space-y-3">
                <p className="text-xs text-dark-400">Add a new mining algorithm to the platform</p>
                <Input placeholder="e.g., CryptoNight-Heavy" value={newAlgoName} onChange={(e) => setNewAlgoName(e.target.value)} />
                <Select label="Hashrate Unit" options={UNIT_OPTIONS} value={newAlgoUnit} onChange={(e) => setNewAlgoUnit(e.target.value)} />
                <Button type="button" onClick={handleCreateAlgorithm} loading={creatingAlgo} className="w-full">Add Algorithm</Button>
              </div>
            ) : (
              <div className="relative">
                {/* Trigger button */}
                <button
                  type="button"
                  onClick={() => setShowAlgoDropdown(!showAlgoDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-sm text-left hover:border-dark-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                >
                  <span className={selectedAlgo ? 'text-white' : 'text-dark-500'}>
                    {selectedAlgo ? `${selectedAlgo.display_name} (${selectedAlgo.unit})` : 'Select algorithm...'}
                  </span>
                  <svg className={`w-4 h-4 text-dark-500 transition-transform ${showAlgoDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {/* Dropdown */}
                {showAlgoDropdown && (
                  <div className="absolute z-30 w-full mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl">
                    <div className="p-2 border-b border-dark-700">
                      <input
                        type="text"
                        placeholder="Search algorithm or coin..."
                        value={algoSearch}
                        onChange={(e) => setAlgoSearch(e.target.value)}
                        autoFocus
                        className="w-full px-3 py-1.5 bg-dark-700 rounded-md text-sm text-white placeholder-dark-500 outline-none"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {algorithms
                        .filter(a =>
                          a.display_name.toLowerCase().includes(algoSearch.toLowerCase()) ||
                          (a.coins && a.coins.toLowerCase().includes(algoSearch.toLowerCase()))
                        )
                        .map(a => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => { handleAlgorithmChange(a.id.toString()); setShowAlgoDropdown(false); setAlgoSearch(''); }}
                            className={`w-full text-left px-3 py-2.5 hover:bg-dark-700 transition-colors border-b border-dark-700/40 last:border-0 ${
                              algorithmId === a.id.toString() ? 'bg-primary-500/10 text-primary-400' : 'text-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{a.display_name}</span>
                              <span className="text-xs text-dark-500 font-mono">{a.unit}</span>
                            </div>
                            {a.coins && <p className="text-xs text-dark-500 mt-0.5">{a.coins}</p>}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}

                {/* Selected algo info */}
                {selectedAlgo?.coins && !showAlgoDropdown && (
                  <p className="text-xs text-dark-500 mt-1.5">
                    <span className="text-dark-600">Mines:</span> {selectedAlgo.coins}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Hashrate + Unit Selector */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">Hashrate</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  placeholder="e.g., 110"
                  value={hashrate}
                  onChange={(e) => setHashrate(e.target.value)}
                  required
                />
              </div>
              <div className="w-44">
                <Select
                  options={unitOptions}
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                />
              </div>
            </div>
            {/* Preview: show conversion if unit differs from algo base */}
            {hashrate && selectedUnit !== algoBaseUnit && previewHashrate > 0 && (
              <p className="text-xs text-dark-500 mt-1">
                = {previewHashrate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {algoBaseUnit}
              </p>
            )}
          </div>

          <Input
            label="Price per Hour (LTC)"
            type="number"
            step="0.00000001"
            min="0.00000001"
            placeholder="e.g., 0.00100000"
            value={pricePerHour}
            onChange={(e) => setPricePerHour(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Rental (hours)" type="number" value={minHours} onChange={(e) => setMinHours(e.target.value)} min="1" required />
            <Input label="Max Rental (hours)" type="number" value={maxHours} onChange={(e) => setMaxHours(e.target.value)} min="1" required />
          </div>

          <div>
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
            <p className="text-xs text-dark-500 mt-1.5 flex items-start gap-1.5">
              <svg className="w-3.5 h-3.5 text-dark-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Select the physical location of your rig. Renters will use this to pick rigs closest to their mining pool servers for lower latency and better hashrate delivery.
            </p>
          </div>

          {/* Number of Devices */}
          <Input
            label="Number of Devices"
            type="number"
            min="1"
            max="10000"
            placeholder="1"
            value={ndevices}
            onChange={(e) => setNdevices(e.target.value)}
          />

          {/* Difficulty Settings */}
          <div className="border border-dark-700/50 rounded-xl p-4 space-y-4 bg-dark-900/30">
            <div>
              <p className="text-sm font-semibold text-dark-200 mb-0.5">Work Difficulty Settings</p>
              <p className="text-xs text-dark-500">Help renters configure their pool's work difficulty correctly. Wrong difficulty causes invalid shares and poor hashrate delivery.</p>
            </div>

            <div>
              <Input
                label="Suggested Difficulty (recommended)"
                placeholder="e.g., 1024, 8192, 131072"
                value={suggestedDifficulty}
                onChange={(e) => setSuggestedDifficulty(e.target.value)}
              />
              <p className="text-xs text-dark-500 mt-1">Renters set this in their pool password field as <span className="font-mono text-dark-400">d=&lt;value&gt;</span>. Find the right value from your miner's current share difficulty.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input
                  label="Min Difficulty (optional)"
                  type="number"
                  min="1"
                  placeholder="e.g., 512"
                  value={optimalDiffMin}
                  onChange={(e) => setOptimalDiffMin(e.target.value)}
                />
                <p className="text-xs text-dark-600 mt-1">ASICs reject work below this threshold.</p>
              </div>
              <div>
                <Input
                  label="Max Difficulty (optional)"
                  type="number"
                  min="1"
                  placeholder="e.g., 262144"
                  value={optimalDiffMax}
                  onChange={(e) => setOptimalDiffMax(e.target.value)}
                />
                <p className="text-xs text-dark-600 mt-1">Prevents pools from sending too-hard work.</p>
              </div>
            </div>
          </div>

          {/* Extensions */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="extensions-new"
              checked={extensionsEnabled}
              onChange={(e) => setExtensionsEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <label htmlFor="extensions-new" className="text-sm text-dark-300 font-medium">Allow rental extensions</label>
              <p className="text-xs text-dark-500">Renters can extend active rentals before they expire.</p>
            </div>
          </div>

          {/* Auto Pricing */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="auto-price-new" checked={autoPriceEnabled}
                onChange={(e) => setAutoPriceEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500" />
              <label htmlFor="auto-price-new" className="text-sm text-dark-300">Auto Pricing (adjust price based on market)</label>
            </div>
            {autoPriceEnabled && (
              <Input label="Price Margin (%)" type="number" step="0.01" min="-50" max="100"
                placeholder="0 = market average, +10 = 10% above" value={autoPriceMargin}
                onChange={(e) => setAutoPriceMargin(e.target.value)} />
            )}
          </div>

          {/* Owner's Fallback Pool */}
          <div className="border border-dark-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-dark-300">Owner Fallback Pool (optional)</label>
              <span className="text-xs text-dark-500">Used when rig is idle or all renter pools fail</span>
            </div>
            <Input
              placeholder="stratum+tcp://your-pool:port"
              value={ownerPoolUrl}
              onChange={(e) => setOwnerPoolUrl(e.target.value)}
            />
            <Input
              placeholder="Wallet / Worker"
              value={ownerPoolUser}
              onChange={(e) => setOwnerPoolUser(e.target.value)}
            />
            <Input
              placeholder="Password (x)"
              value={ownerPoolPassword}
              onChange={(e) => setOwnerPoolPassword(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={loading}>Create Rig</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
