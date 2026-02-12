'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import { rigsAPI } from '@/lib/api';
import { formatUSDT, formatHashrate, statusBadgeColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Rig } from '@/types';

export default function ManageRigPage() {
  const params = useParams();
  const router = useRouter();
  const rigId = Number(params.rigId);
  const [rig, setRig] = useState<Rig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hashrate, setHashrate] = useState('');
  const [pricePerHour, setPricePerHour] = useState('');
  const [status, setStatus] = useState('');
  const [minHours, setMinHours] = useState('');
  const [maxHours, setMaxHours] = useState('');

  useEffect(() => {
    rigsAPI.get(rigId).then(({ data }) => {
      setRig(data);
      setName(data.name);
      setDescription(data.description || '');
      setHashrate(data.hashrate.toString());
      setPricePerHour(data.price_per_hour.toString());
      setStatus(data.status);
      setMinHours(data.min_rental_hours.toString());
      setMaxHours(data.max_rental_hours.toString());
    }).catch(() => toast.error('Failed to load rig')).finally(() => setLoading(false));
  }, [rigId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await rigsAPI.update(rigId, {
        name, description: description || null,
        hashrate: parseFloat(hashrate), price_per_hour: parseFloat(pricePerHour),
        status, min_rental_hours: parseInt(minHours), max_rental_hours: parseInt(maxHours),
      });
      setRig(data);
      setEditing(false);
      toast.success('Rig updated');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update rig');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this rig?')) return;
    try {
      await rigsAPI.delete(rigId);
      toast.success('Rig deleted');
      router.push('/my-rigs');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete rig');
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
            <Input label="Hashrate" type="number" step="0.0001" value={hashrate} onChange={(e) => setHashrate(e.target.value)} />
            <Input label="Price per Hour (USDT)" type="number" step="0.01" value={pricePerHour} onChange={(e) => setPricePerHour(e.target.value)} />
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
            <div className="grid grid-cols-2 gap-4">
              <Input label="Min Rental (hours)" type="number" value={minHours} onChange={(e) => setMinHours(e.target.value)} />
              <Input label="Max Rental (hours)" type="number" value={maxHours} onChange={(e) => setMaxHours(e.target.value)} />
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Algorithm', value: rig.algorithm?.display_name || '-' },
              { label: 'Hashrate', value: formatHashrate(rig.hashrate, rig.algorithm?.unit) },
              { label: 'Price/Hour', value: `${formatUSDT(rig.price_per_hour)} USDT` },
              { label: 'Min Rental', value: `${rig.min_rental_hours}h` },
              { label: 'Max Rental', value: `${rig.max_rental_hours}h` },
              { label: 'Region', value: rig.region },
              { label: 'Uptime', value: `${Number(rig.uptime_percentage)}%` },
              { label: 'Total Rentals', value: rig.total_rentals.toString() },
              { label: 'Rating', value: `${Number(rig.average_rating).toFixed(1)}/5.0` },
            ].map((item) => (
              <div key={item.label} className="bg-dark-800 rounded-lg p-3">
                <p className="text-xs text-dark-400">{item.label}</p>
                <p className="text-sm font-medium text-white mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
