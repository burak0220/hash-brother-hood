'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import { rentalsAPI } from '@/lib/api';
import { formatUSDT, formatHashrate, statusBadgeColor, formatDateTime } from '@/lib/utils';
import HashrateChart from '@/components/charts/hashrate-chart';
import { useAuthStore } from '@/stores/auth';
import toast from 'react-hot-toast';
import type { Rental } from '@/types';

const mockPerf = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  hashrate: Math.random() * 100 + 50,
}));

export default function RentalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const rentalId = Number(params.rentalId);
  const [rental, setRental] = useState<Rental | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    rentalsAPI.get(rentalId).then(({ data }) => setRental(data)).catch(() => toast.error('Rental not found')).finally(() => setLoading(false));
  }, [rentalId]);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this rental?')) return;
    setCancelling(true);
    try {
      const { data } = await rentalsAPI.cancel(rentalId);
      setRental(data);
      toast.success('Rental cancelled');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to cancel');
    }
    setCancelling(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!rental) {
    return <Card className="text-center py-12"><p className="text-dark-400">Rental not found</p></Card>;
  }

  const canCancel = (rental.status === 'pending' || rental.status === 'active') &&
    (rental.renter_id === user?.id || rental.owner_id === user?.id);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <button onClick={() => router.back()} className="text-dark-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Rental #{rental.id}</h1>
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium border mt-1 ${statusBadgeColor(rental.status)}`}>{rental.status}</span>
        </div>
        {canCancel && (
          <Button variant="danger" onClick={handleCancel} loading={cancelling}>Cancel Rental</Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Rental Details</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Rig', value: rental.rig_name || `#${rental.rig_id}` },
                { label: 'Algorithm', value: rental.algorithm_name || '-' },
                { label: 'Hashrate', value: rental.hashrate.toString() },
                { label: 'Duration', value: `${rental.duration_hours}h` },
                { label: 'Price/Hour', value: `${formatUSDT(rental.price_per_hour)} USDT` },
                { label: 'Total Cost', value: `${formatUSDT(rental.total_cost)} USDT` },
              ].map((item) => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-dark-400">{item.label}</span>
                  <span className="text-white font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pool Configuration</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Pool URL</span>
                <span className="text-white font-mono text-xs">{rental.pool_url || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Pool User</span>
                <span className="text-white font-mono text-xs">{rental.pool_user || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Started</span>
                <span className="text-white">{rental.started_at ? formatDateTime(rental.started_at) : '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Ends</span>
                <span className="text-white">{rental.ends_at ? formatDateTime(rental.ends_at) : '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Renter</span>
                <span className="text-white">{rental.renter?.username || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Owner</span>
                <span className="text-white">{rental.owner?.username || '-'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {rental.status === 'active' && (
        <Card>
          <CardHeader><CardTitle>Hashrate Performance</CardTitle></CardHeader>
          <CardContent>
            <HashrateChart data={mockPerf} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
