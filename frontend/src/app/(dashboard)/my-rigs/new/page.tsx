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

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [algorithmId, setAlgorithmId] = useState('');
  const [hashrate, setHashrate] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [pricePerHour, setPricePerHour] = useState('');
  const [minHours, setMinHours] = useState('1');
  const [maxHours, setMaxHours] = useState('720');
  const [region, setRegion] = useState('auto');

  useEffect(() => {
    algorithmsAPI.list().then(({ data }) => {
      setAlgorithms(data);
      if (data.length > 0) {
        setAlgorithmId(data[0].id.toString());
        setSelectedUnit(data[0].unit);
      }
    }).catch(() => {});
  }, []);

  // When algorithm changes, update the selected unit to algorithm's default
  const handleAlgorithmChange = (newAlgoId: string) => {
    setAlgorithmId(newAlgoId);
    const algo = algorithms.find(a => a.id.toString() === newAlgoId);
    if (algo) {
      setSelectedUnit(algo.unit);
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
        <p className="text-dark-400">List your mining rig on the marketplace</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Rig Name" placeholder="e.g., Antminer S19 Pro" value={name} onChange={(e) => setName(e.target.value)} required />

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">Description</label>
            <textarea
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all min-h-[80px]"
              placeholder="Describe your rig..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Algorithm Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-dark-300">Algorithm</label>
              <button
                type="button"
                onClick={() => setShowNewAlgo(!showNewAlgo)}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-1"
              >
                {showNewAlgo ? (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    Cancel
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add new algorithm
                  </>
                )}
              </button>
            </div>

            {showNewAlgo ? (
              <div className="p-4 bg-dark-800/50 border border-primary-400/20 rounded-lg space-y-3">
                <p className="text-xs text-dark-400">Add a new mining algorithm to the platform</p>
                <Input
                  placeholder="e.g., CryptoNight-Heavy"
                  value={newAlgoName}
                  onChange={(e) => setNewAlgoName(e.target.value)}
                />
                <Select
                  label="Hashrate Unit"
                  options={UNIT_OPTIONS}
                  value={newAlgoUnit}
                  onChange={(e) => setNewAlgoUnit(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={handleCreateAlgorithm}
                  loading={creatingAlgo}
                  className="w-full"
                >
                  Add Algorithm
                </Button>
              </div>
            ) : (
              <Select
                options={algorithms.map((a) => ({ value: a.id, label: `${a.display_name} (${a.unit})` }))}
                value={algorithmId}
                onChange={(e) => handleAlgorithmChange(e.target.value)}
              />
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
            label="Price per Hour (USDT)"
            type="number"
            step="0.01"
            placeholder="e.g., 1.50"
            value={pricePerHour}
            onChange={(e) => setPricePerHour(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Rental (hours)" type="number" value={minHours} onChange={(e) => setMinHours(e.target.value)} min="1" required />
            <Input label="Max Rental (hours)" type="number" value={maxHours} onChange={(e) => setMaxHours(e.target.value)} min="1" required />
          </div>

          <Select
            label="Region"
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'us-east', label: 'US East' },
              { value: 'us-west', label: 'US West' },
              { value: 'eu-west', label: 'EU West' },
              { value: 'asia', label: 'Asia' },
            ]}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={loading}>Create Rig</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
