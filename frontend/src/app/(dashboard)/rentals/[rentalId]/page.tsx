'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import { rentalsAPI, reviewsAPI, disputesAPI } from '@/lib/api';
import { formatUSDT, formatHashrate, statusBadgeColor, formatDateTime } from '@/lib/utils';
import HashrateChart from '@/components/charts/hashrate-chart';
import { useAuthStore } from '@/stores/auth';
import toast from 'react-hot-toast';
import type { Rental, Review } from '@/types';

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

  // Dispute
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Review form
  const [showReview, setShowReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [existingReview, setExistingReview] = useState<Review | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await rentalsAPI.get(rentalId);
        setRental(data);
        // Check if user already reviewed this rental
        if (data.rig_id) {
          try {
            const { data: reviews } = await reviewsAPI.rigReviews(data.rig_id);
            const myReview = reviews.find((r: Review) => r.rental_id === rentalId && r.reviewer_id === user?.id);
            if (myReview) setExistingReview(myReview);
          } catch {}
        }
      } catch {
        toast.error('Unable to load rental details. The rental may no longer exist.');
      }
      setLoading(false);
    }
    load();
  }, [rentalId, user?.id]);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this rental? A partial refund will be calculated based on the remaining time.')) return;
    setCancelling(true);
    try {
      const { data } = await rentalsAPI.cancel(rentalId);
      setRental(data);
      toast.success('Your rental has been cancelled. The refund has been credited to your wallet.');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to cancel this rental. Please try again or contact support.');
    }
    setCancelling(false);
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      const { data } = await reviewsAPI.create({
        rental_id: rentalId,
        rating: reviewRating,
        comment: reviewComment || undefined,
      });
      setExistingReview(data);
      setShowReview(false);
      toast.success('Your review has been submitted. Thank you for your feedback!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to submit your review. Please try again.');
    }
    setSubmittingReview(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!rental) {
    return <Card className="text-center py-12"><p className="text-dark-400">Rental not found</p></Card>;
  }

  const canCancel = (rental.status === 'pending' || rental.status === 'active') &&
    (rental.renter_id === user?.id || rental.owner_id === user?.id);

  const canReview = rental.status === 'completed' && rental.renter_id === user?.id && !existingReview;

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
        <div className="flex gap-2">
          {canCancel && (
            <Button variant="danger" onClick={handleCancel} loading={cancelling}>Cancel Rental</Button>
          )}
          {['active', 'completed'].includes(rental.status) && !showDispute && (
            <Button variant="secondary" onClick={() => setShowDispute(true)}>Open Dispute</Button>
          )}
          {canReview && !showReview && (
            <Button onClick={() => setShowReview(true)}>Leave Review</Button>
          )}
        </div>
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

      {/* Review Form */}
      {showReview && (
        <Card>
          <CardHeader><CardTitle>Leave a Review</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className={`text-2xl transition-colors ${star <= reviewRating ? 'text-yellow-400' : 'text-dark-600 hover:text-dark-400'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Comment (optional)</label>
                <textarea
                  className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 min-h-[80px]"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="How was your experience?"
                  maxLength={2000}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowReview(false)}>Cancel</Button>
                <Button onClick={handleSubmitReview} loading={submittingReview}>Submit Review</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Review */}
      {existingReview && (
        <Card>
          <CardHeader><CardTitle>Your Review</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-400">{'★'.repeat(existingReview.rating)}{'☆'.repeat(5 - existingReview.rating)}</span>
            </div>
            {existingReview.comment && <p className="text-sm text-dark-300">{existingReview.comment}</p>}
          </CardContent>
        </Card>
      )}

      {showDispute && (
        <Card>
          <CardHeader><CardTitle>Open a Dispute</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Reason (min 10 characters)</label>
                <textarea
                  className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 min-h-[80px]"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Describe the issue with this rental..."
                  maxLength={2000}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowDispute(false)}>Cancel</Button>
                <Button
                  loading={submittingDispute}
                  disabled={disputeReason.length < 10}
                  onClick={async () => {
                    setSubmittingDispute(true);
                    try {
                      await disputesAPI.create({ rental_id: rentalId, reason: disputeReason });
                      toast.success('Your dispute has been filed and will be reviewed by our team.');
                      router.push('/disputes');
                    } catch (err: any) {
                      toast.error(err.response?.data?.detail || 'Unable to file the dispute. Please try again.');
                    }
                    setSubmittingDispute(false);
                  }}
                >
                  Submit Dispute
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
