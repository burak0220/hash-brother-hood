'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Badge from '@/components/ui/badge';
import { rigsAPI, rentalsAPI, reviewsAPI, messagesAPI } from '@/lib/api';
import { formatUSDT, formatHashrate, statusBadgeColor, formatDate, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import toast from 'react-hot-toast';
import type { Rig, Review } from '@/types';

export default function RigDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const rigId = Number(params.rigId);
  const [rig, setRig] = useState<Rig | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  // Rent form
  const [showRent, setShowRent] = useState(false);
  const [duration, setDuration] = useState('2');
  const [poolUrl, setPoolUrl] = useState('');
  const [poolUser, setPoolUser] = useState('');
  const [poolPassword, setPoolPassword] = useState('x');
  const [renting, setRenting] = useState(false);

  const poolPresets: Record<string, { url: string; note: string }> = {
    'NiceHash': { url: 'stratum+tcp://sha256.auto.nicehash.com:9200', note: 'Use your NiceHash BTC address as worker' },
    'F2Pool': { url: 'stratum+tcp://btc.f2pool.com:3333', note: 'Use account.worker as pool user' },
    'Antpool': { url: 'stratum+tcp://stratum.antpool.com:3333', note: 'Use your Antpool sub-account' },
    'ViaBTC': { url: 'stratum+tcp://btc.viabtc.com:3333', note: 'Use account.worker as pool user' },
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
      } catch {
        toast.error('Unable to load rig details. Please try again.');
      }
      setLoading(false);
    }
    load();
  }, [rigId]);

  const handleRent = async (e: React.FormEvent) => {
    e.preventDefault();
    setRenting(true);
    try {
      await rentalsAPI.create({
        rig_id: rigId,
        duration_hours: parseInt(duration),
        pool_url: poolUrl,
        pool_user: poolUser,
        pool_password: poolPassword,
      });
      toast.success('Rental started successfully! Redirecting to your rentals.');
      router.push('/rentals');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to create the rental. Please check your balance and try again.');
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
    return (
      <Card className="text-center py-12">
        <p className="text-dark-400 text-lg">Rig not found</p>
      </Card>
    );
  }

  const parsedDuration = Math.max(0, parseInt(duration || '0'));
  const totalCost = Number(rig.price_per_hour) * parsedDuration;
  const isOwner = user?.id === rig.owner_id;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <button onClick={() => router.back()} className="text-dark-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Rig Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white">{rig.name}</h1>
                <p className="text-dark-400 text-sm mt-1">by {rig.owner?.username || 'Unknown'}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusBadgeColor(rig.status)}`}>
                {rig.status}
              </span>
            </div>

            {rig.description && <p className="text-dark-300 mb-6">{rig.description}</p>}

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

          {/* Reviews */}
          <Card>
            <CardHeader>
              <CardTitle>Reviews ({reviews.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-dark-500 text-sm text-center py-4">No reviews yet</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-dark-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">{review.reviewer?.username?.charAt(0).toUpperCase() || '?'}</span>
                          </div>
                          <span className="text-sm font-medium text-white">{review.reviewer?.username || 'Anonymous'}</span>
                        </div>
                        <span className="text-yellow-400 text-sm">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                      </div>
                      {review.comment && <p className="text-sm text-dark-300">{review.comment}</p>}
                      <p className="text-xs text-dark-500 mt-2">{formatDate(review.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rent Form */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Rent This Rig</CardTitle>
            </CardHeader>
            <CardContent>
              {isOwner ? (
                <p className="text-dark-400 text-sm">This is your rig.</p>
              ) : !user ? (
                <p className="text-dark-400 text-sm">Please login to rent this rig.</p>
              ) : rig.status !== 'active' ? (
                <p className="text-dark-400 text-sm">This rig is currently unavailable.</p>
              ) : !showRent ? (
                <div>
                  <div className="bg-dark-800 rounded-lg p-4 mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-dark-400">Price</span>
                      <span className="text-accent-400 font-medium">{formatUSDT(rig.price_per_hour)} USDT/hr</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Your Balance</span>
                      <span className="text-white font-medium">{formatUSDT(user?.balance || 0)} USDT</span>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => setShowRent(true)}>
                    Rent Now
                  </Button>
                  {rig.owner_id && (
                    <button
                      onClick={async () => {
                        try {
                          await messagesAPI.send({ receiver_id: rig.owner_id, content: `Hi, I'm interested in renting your rig "${rig.name}".` });
                          toast.success('Your message has been sent to the rig owner.');
                          router.push('/messages');
                        } catch {
                          toast.error('Unable to send the message. Please try again.');
                        }
                      }}
                      className="w-full mt-2 px-4 py-2.5 border border-dark-600/50 text-dark-300 text-sm rounded-xl hover:bg-dark-800/60 transition-all"
                    >
                      Message Owner
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleRent} className="space-y-4">
                  <Input
                    label="Duration (hours)"
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    min={rig.min_rental_hours}
                    max={rig.max_rental_hours}
                    required
                  />
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">Pool Preset</label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {Object.entries(poolPresets).map(([name, preset]) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setPoolUrl(preset.url)}
                          className={`px-2 py-1 text-xs rounded border transition-all ${
                            poolUrl === preset.url
                              ? 'border-primary-400/40 bg-primary-400/10 text-primary-400'
                              : 'border-dark-600/50 text-dark-400 hover:border-dark-500'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    label="Pool URL"
                    placeholder="stratum+tcp://pool:port"
                    value={poolUrl}
                    onChange={(e) => setPoolUrl(e.target.value)}
                    required
                  />
                  <Input
                    label="Wallet Address / Worker Name"
                    placeholder="wallet_address.worker_name"
                    value={poolUser}
                    onChange={(e) => setPoolUser(e.target.value)}
                    required
                  />
                  <Input
                    label="Pool Password"
                    placeholder="x"
                    value={poolPassword}
                    onChange={(e) => setPoolPassword(e.target.value)}
                  />

                  <div className="bg-dark-800 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Duration</span>
                      <span className="text-white">{duration}h</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Price/Hour</span>
                      <span className="text-white">{formatUSDT(rig.price_per_hour)} USDT</span>
                    </div>
                    <div className="border-t border-dark-600 my-2" />
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-white">Total Cost</span>
                      <span className="text-accent-400">{formatUSDT(totalCost)} USDT</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => setShowRent(false)} type="button">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" loading={renting}>
                      Confirm Rental
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
