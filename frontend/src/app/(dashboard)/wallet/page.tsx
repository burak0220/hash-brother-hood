'use client';
import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Tabs from '@/components/ui/tabs';
import Modal from '@/components/ui/modal';
import { paymentsAPI } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatUSDT, transactionTypeColor, formatDateTime, statusBadgeColor, truncateAddress } from '@/lib/utils';
import { isMetaMaskInstalled, connectWallet, transferUSDT } from '@/lib/web3';
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

  // MetaMask state
  const [walletConnected, setWalletConnected] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState('');
  const [metamaskAmount, setMetamaskAmount] = useState('');

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

  const handleConnectWallet = async () => {
    try {
      const address = await connectWallet();
      setConnectedAddress(address);
      setWalletConnected(true);
      toast.success('MetaMask wallet connected successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Unable to connect your wallet. Please make sure MetaMask is unlocked.');
    }
  };

  const handleMetaMaskDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.deposit_address) {
      toast.error('Your deposit address has not been generated yet. Please contact support.');
      return;
    }
    setSubmitting(true);
    try {
      const txHash = await transferUSDT(user.deposit_address, metamaskAmount);
      toast.success('Transaction sent successfully. Your deposit will be credited automatically within 30 seconds.');
      setShowDeposit(false);
      setMetamaskAmount('');
      // Refresh balance after a short delay
      setTimeout(async () => {
        await fetchUser();
        await loadTransactions();
      }, 5000);
    } catch (err: any) {
      toast.error(err.reason || err.message || 'The MetaMask transfer could not be completed. Please try again.');
    }
    setSubmitting(false);
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

  const withdrawFee = 1;
  const withdrawTotal = withdrawAmount ? Math.max(0, parseFloat(withdrawAmount) || 0) + withdrawFee : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Wallet</h1>
        <p className="text-dark-400">Manage your USDT balance on BSC (BEP-20)</p>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-primary-900/30 to-accent-900/30 border-primary-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-dark-300 text-sm">Available Balance</p>
            <p className="text-3xl font-bold text-white mt-1">{formatUSDT(user?.balance || 0)} <span className="text-lg text-dark-400">USDT</span></p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-xs text-dark-500">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                BSC (BEP-20)
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
      <div className="bg-dark-800/50 border border-dark-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-primary-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-dark-300">
            <p className="font-medium text-white mb-1">How it works</p>
            <ul className="space-y-1 text-dark-400">
              <li><strong className="text-dark-300">Deposits:</strong> Send USDT (BEP-20) to your unique deposit address. Your balance is credited automatically within 30 seconds.</li>
              <li><strong className="text-dark-300">Withdrawals:</strong> Submit a withdrawal request with 1 USDT network fee. After admin approval, USDT is sent to your BSC wallet.</li>
              <li><strong className="text-dark-300">Network:</strong> All transactions use BSC (Binance Smart Chain) for low fees and fast confirmations.</li>
            </ul>
          </div>
        </div>
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
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-dark-500 text-sm text-center py-8">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium capitalize ${transactionTypeColor(tx.type)}`}>
                        {tx.type.replace(/_/g, ' ')}
                      </p>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusBadgeColor(tx.status)}`}>
                        {tx.status}
                      </span>
                      {/* Verify button for pending deposits */}
                      {tx.type === 'deposit' && tx.status === 'pending' && (
                        <button
                          onClick={() => handleVerifyDeposit(tx.id)}
                          disabled={verifyingId === tx.id}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30 transition-colors disabled:opacity-50"
                        >
                          {verifyingId === tx.id ? 'Verifying...' : 'Verify on BSC'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-dark-500 mt-0.5">
                      {tx.description || formatDateTime(tx.created_at)}
                    </p>
                    {tx.tx_hash && (
                      <a
                        href={`https://bscscan.com/tx/${tx.tx_hash}`}
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
                  <div className="text-right">
                    <p className={`text-sm font-medium ${tx.type === 'deposit' || tx.type === 'rental_earning' || tx.type === 'refund' ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.type === 'deposit' || tx.type === 'rental_earning' || tx.type === 'refund' ? '+' : '-'}{formatUSDT(tx.amount)} USDT
                    </p>
                    {Number(tx.fee) > 0 && <p className="text-[10px] text-dark-500">Fee: {formatUSDT(tx.fee)} USDT</p>}
                  </div>
                </div>
              ))}
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
      <Modal isOpen={showDeposit} onClose={() => setShowDeposit(false)} title="Deposit USDT (BEP-20)">
        <div className="space-y-4">
          {user?.deposit_address ? (
            <>
              {/* Your Unique Deposit Address */}
              <div className="bg-gradient-to-r from-primary-900/30 to-accent-900/30 border border-primary-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p className="text-xs text-primary-400 font-medium">Your Unique Deposit Address</p>
                </div>
                <div className="bg-dark-900/60 rounded-lg p-3">
                  <p className="text-sm font-mono text-white break-all select-all">{user.deposit_address}</p>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
                    onClick={copyAddress}
                  >
                    📋 Copy Address
                  </button>
                  <a
                    href={`https://bscscan.com/address/${user.deposit_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
                  >
                    🔍 View on BSCScan
                  </a>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-dark-800/50 rounded-lg p-4 space-y-2">
                <p className="text-sm text-white font-medium">📤 How to Deposit:</p>
                <ol className="space-y-1 text-xs text-dark-300 list-decimal list-inside">
                  <li>Copy your unique deposit address above</li>
                  <li>Send USDT (BEP-20) from any BSC wallet or exchange</li>
                  <li>Your balance will be credited automatically within 30 seconds</li>
                  <li>No need to enter transaction hash - it's detected automatically!</li>
                </ol>
              </div>

              {/* MetaMask Quick Send */}
              <div className="border-t border-dark-700 pt-4">
                <p className="text-xs text-dark-400 mb-3">Or send directly from MetaMask:</p>
                {!walletConnected ? (
                  <div className="text-center py-2">
                    {isMetaMaskInstalled() ? (
                      <Button onClick={handleConnectWallet} variant="secondary" className="w-full">Connect MetaMask</Button>
                    ) : (
                      <div>
                        <p className="text-xs text-dark-400 mb-2">MetaMask not installed</p>
                        <a
                          href="https://metamask.io/download/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 text-xs hover:underline"
                        >
                          Install MetaMask
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleMetaMaskDeposit} className="space-y-3">
                    <div className="bg-dark-800 rounded-lg p-2">
                      <p className="text-[10px] text-dark-500">Connected:</p>
                      <p className="text-xs font-mono text-primary-400">{truncateAddress(connectedAddress, 8)}</p>
                    </div>
                    <Input label="Amount (USDT)" type="number" step="0.01" min="1" placeholder="10.00" value={metamaskAmount} onChange={(e) => setMetamaskAmount(e.target.value)} required />
                    <Button type="submit" className="w-full" loading={submitting}>Send USDT</Button>
                  </form>
                )}
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
      <Modal isOpen={showWithdraw} onClose={() => setShowWithdraw(false)} title="Withdraw USDT (BEP-20)">
        <form onSubmit={handleWithdraw} className="space-y-4">
          <Input label="BSC Wallet Address" placeholder="0x..." value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} required />
          <Input label="Amount (USDT)" type="number" step="0.01" min="10" placeholder="10.00" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} required />
          <div className="bg-dark-800 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Amount</span>
              <span className="text-white">{withdrawAmount || '0.00'} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Network Fee</span>
              <span className="text-dark-300">{formatUSDT(withdrawFee)} USDT</span>
            </div>
            <div className="border-t border-dark-600 my-1" />
            <div className="flex justify-between text-sm font-medium">
              <span className="text-white">Total Deducted</span>
              <span className="text-accent-400">{formatUSDT(withdrawTotal)} USDT</span>
            </div>
          </div>
          <div className="bg-dark-800/50 rounded-lg p-3">
            <p className="text-xs text-dark-400">
              <strong className="text-dark-300">Auto-sent:</strong> After admin approval, USDT will be automatically transferred to your BSC wallet. You&apos;ll receive a BSCScan transaction link.
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
