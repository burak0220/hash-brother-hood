'use client';
import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Tabs from '@/components/ui/tabs';
import Modal from '@/components/ui/modal';
import { paymentsAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatLTC, transactionTypeColor, formatDateTime, statusBadgeColor, truncateAddress } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Transaction } from '@/types';

export default function WalletPage() {
  const { user, fetchUser } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const loadTransactions = async () => {
    try {
      const { data } = await paymentsAPI.transactions({ page, per_page: 20 });
      setTransactions(data.items);
      setPages(data.pages);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadTransactions();
  }, [page]);

  const copyAddress = () => {
    if (user?.deposit_address) {
      navigator.clipboard.writeText(user.deposit_address);
      toast.success('Deposit address copied to clipboard.');
    }
  };

  const handleVerifyDeposit = async (txId: number) => {
    setVerifyingId(txId);
    try {
      await paymentsAPI.verifyDeposit(txId);
      toast.success('Deposit verified and credited to your account.');
      await fetchUser();
      await loadTransactions();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Deposit verification failed. The transaction may still be processing on the blockchain.');
    }
    setVerifyingId(null);
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await paymentsAPI.withdraw({ amount: parseFloat(withdrawAmount), wallet_address: withdrawAddress });
      toast.success('Your withdrawal request has been submitted and is pending admin approval.');
      setShowWithdraw(false);
      setWithdrawAmount('');
      setWithdrawAddress('');
      await fetchUser();
      await loadTransactions();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Unable to process your withdrawal. Please check your balance and try again.');
    }
    setSubmitting(false);
  };

  const withdrawFee = 0.0001;
  const withdrawTotal = withdrawAmount ? Math.max(0, parseFloat(withdrawAmount) || 0) + withdrawFee : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Wallet</h1>
        <p className="text-dark-400">Manage your Litecoin (LTC) balance</p>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-primary-900/30 to-accent-900/30 border-primary-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-dark-300 text-sm">Available Balance</p>
            <p className="text-3xl font-bold text-white mt-1">{formatLTC(user?.balance || 0)} <span className="text-lg text-dark-400">LTC</span></p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-xs text-dark-500">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Litecoin
              </span>
              <span className="text-xs text-dark-600">|</span>
              <span className="text-xs text-dark-500">Blockchain-verified deposits</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowDeposit(true)}>Deposit</Button>
            <Button variant="secondary" onClick={() => setShowWithdraw(true)}>Withdraw</Button>
          </div>
        </div>
      </Card>

      {/* Info Banner */}
      <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4">
        <p className="text-sm font-semibold text-white mb-4">How it works</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              step: '1',
              title: 'Get your address',
              desc: 'Click Deposit to reveal your unique LTC deposit address',
              icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
            },
            {
              step: '2',
              title: 'Send LTC',
              desc: 'Transfer from any Litecoin wallet or exchange',
              icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
            },
            {
              step: '3',
              title: 'Funds appear',
              desc: 'Balance credited automatically after 3 confirmations (~7.5 min)',
              icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-500/15 border border-primary-500/25 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary-400">{item.step}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200">{item.title}</p>
                <p className="text-xs text-dark-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-dark-600 mt-4 pt-3 border-t border-dark-700">Withdrawals require a small LTC network fee and admin approval. Deposits are swept to hot wallet automatically.</p>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transaction History</CardTitle>
            <button
              onClick={async () => {
                try {
                  const { default: api } = await import('@/lib/api');
                  const res = await api.get('/payments/transactions/export', { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'transactions.csv';
                  a.click();
                  window.URL.revokeObjectURL(url);
                } catch { toast.error('Unable to export transactions. Please try again.'); }
              }}
              className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-dark-800/60 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              </div>
              <p className="text-dark-500 text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const isCredit = tx.type === 'deposit' || tx.type === 'rental_earning' || tx.type === 'refund';
                return (
                <div key={tx.id} className="flex items-center gap-3 p-3 bg-dark-800 rounded-lg hover:bg-dark-700/60 transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isCredit ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                    <svg className={`w-4 h-4 ${isCredit ? 'text-green-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isCredit ? 'M7 11l5-5m0 0l5 5m-5-5v12' : 'M17 13l-5 5m0 0l-5-5m5 5V6'}/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium capitalize ${transactionTypeColor(tx.type)}`}>
                        {tx.type.replace(/_/g, ' ')}
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadgeColor(tx.status)}`}>
                        {tx.status}
                      </span>
                      {tx.type === 'deposit' && tx.status === 'pending' && (
                        <button
                          onClick={() => handleVerifyDeposit(tx.id)}
                          disabled={verifyingId === tx.id}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30 transition-colors disabled:opacity-50"
                        >
                          {verifyingId === tx.id ? 'Verifying...' : 'Verify on LTC'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-dark-500 mt-0.5">
                      {tx.description || formatDateTime(tx.created_at)}
                    </p>
                    {tx.tx_hash && (
                      <a
                        href={`https://blockchair.com/litecoin/transaction/${tx.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary-500 hover:text-primary-400 mt-0.5 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {truncateAddress(tx.tx_hash, 10)}
                      </a>
                    )}
                    {tx.wallet_address && tx.type === 'withdrawal' && (
                      <p className="text-[11px] text-dark-600 mt-0.5">
                        To: {truncateAddress(tx.wallet_address, 6)}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                      {isCredit ? '+' : '-'}{formatLTC(tx.amount)} <span className="text-xs font-normal text-dark-500">LTC</span>
                    </p>
                    {Number(tx.fee) > 0 && <p className="text-[10px] text-dark-500">Fee: {formatLTC(tx.fee)} LTC</p>}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-dark-400">Page {page} of {pages}</span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deposit Modal */}
      <Modal isOpen={showDeposit} onClose={() => setShowDeposit(false)} title="Deposit LTC">
        <div className="space-y-4">
          {user?.deposit_address ? (
            <>
              {/* Your Unique Deposit Address */}
              <div className="bg-gradient-to-r from-primary-900/30 to-accent-900/30 border border-primary-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p className="text-xs text-primary-400 font-medium">LTC Deposit Address</p>
                </div>
                <div className="bg-dark-900/60 rounded-lg p-3">
                  <p className="text-sm font-mono text-white break-all select-all">{user.deposit_address}</p>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
                    onClick={copyAddress}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    Copy Address
                  </button>
                  <a
                    href={`https://blockchair.com/litecoin/address/${user.deposit_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                    View on Explorer
                  </a>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-dark-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                  <p className="text-sm text-white font-medium">How to Deposit</p>
                </div>
                <ol className="space-y-1.5 text-xs text-dark-300 list-decimal list-inside">
                  <li>Copy your LTC deposit address above</li>
                  <li>Send LTC from any wallet or exchange</li>
                  <li>Balance credited automatically after 3 confirmations (~7.5 min)</li>
                </ol>
              </div>
            </>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-sm text-yellow-400">Deposit address not generated yet. Please contact support.</p>
            </div>
          )}

          <Button variant="secondary" type="button" onClick={() => setShowDeposit(false)} className="w-full">Close</Button>
        </div>
      </Modal>

      {/* Withdraw Modal */}
      <Modal isOpen={showWithdraw} onClose={() => setShowWithdraw(false)} title="Withdraw LTC">
        <form onSubmit={handleWithdraw} className="space-y-4">
          <Input label="Litecoin Wallet Address" placeholder="ltc1... or L..." value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} required />
          <Input label="Amount (LTC)" type="number" step="0.00000001" min="0.001" placeholder="0.10000000" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} required />
          <div className="bg-dark-800 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Amount</span>
              <span className="text-white">{withdrawAmount || '0.00000000'} LTC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Network Fee</span>
              <span className="text-dark-300">{formatLTC(withdrawFee)} LTC</span>
            </div>
            <div className="border-t border-dark-600 my-1" />
            <div className="flex justify-between text-sm font-medium">
              <span className="text-white">Total Deducted</span>
              <span className="text-accent-400">{formatLTC(withdrawTotal)} LTC</span>
            </div>
          </div>
          <div className="bg-dark-800/50 rounded-lg p-3">
            <p className="text-xs text-dark-400">
              <strong className="text-dark-300">Auto-sent:</strong> After admin approval, LTC will be automatically transferred to your wallet.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowWithdraw(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" loading={submitting}>Submit Withdrawal</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
