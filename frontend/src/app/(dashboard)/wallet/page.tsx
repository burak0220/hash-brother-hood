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
  const [depositTab, setDepositTab] = useState('manual');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositTxHash, setDepositTxHash] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  // MetaMask state
  const [walletConnected, setWalletConnected] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState('');
  const [metamaskAmount, setMetamaskAmount] = useState('');
  const [platformAddress, setPlatformAddress] = useState('');

  const loadTransactions = async () => {
    try {
      const { data } = await paymentsAPI.transactions({ page, per_page: 20 });
      setTransactions(data.items);
      setPages(data.pages);
    } catch {}
    setLoading(false);
  };

  const loadPlatformAddress = async () => {
    try {
      const { data } = await paymentsAPI.platformAddress();
      setPlatformAddress(data.address);
    } catch {}
  };

  useEffect(() => {
    loadTransactions();
    loadPlatformAddress();
  }, [page]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: tx } = await paymentsAPI.deposit({ amount: parseFloat(depositAmount), tx_hash: depositTxHash });
      if (tx.status === 'pending') {
        toast.success('Deposit submitted - awaiting BSC confirmation. You can verify it from your transaction history.');
      } else {
        toast.success('Deposit verified and credited successfully!');
      }
      setShowDeposit(false);
      setDepositAmount('');
      setDepositTxHash('');
      await fetchUser();
      await loadTransactions();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Deposit failed');
    }
    setSubmitting(false);
  };

  const handleConnectWallet = async () => {
    try {
      const address = await connectWallet();
      setConnectedAddress(address);
      setWalletConnected(true);
      toast.success('Wallet connected');
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect wallet');
    }
  };

  const handleMetaMaskDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!platformAddress) {
      toast.error('Platform address not loaded');
      return;
    }
    setSubmitting(true);
    try {
      const txHash = await transferUSDT(platformAddress, metamaskAmount);
      // Small delay to let BSC confirm
      toast.loading('Transaction sent, verifying on BSC...', { id: 'metamask-verify' });
      await new Promise((r) => setTimeout(r, 5000));
      const { data: tx } = await paymentsAPI.deposit({ amount: parseFloat(metamaskAmount), tx_hash: txHash });
      toast.dismiss('metamask-verify');
      if (tx.status === 'completed') {
        toast.success('USDT deposit verified and credited!');
      } else {
        toast.success('Deposit submitted - awaiting BSC confirmation.');
      }
      setShowDeposit(false);
      setMetamaskAmount('');
      await fetchUser();
      await loadTransactions();
    } catch (err: any) {
      toast.dismiss('metamask-verify');
      toast.error(err.reason || err.message || 'MetaMask transfer failed');
    }
    setSubmitting(false);
  };

  const handleVerifyDeposit = async (txId: number) => {
    setVerifyingId(txId);
    try {
      await paymentsAPI.verifyDeposit(txId);
      toast.success('Deposit verified and credited!');
      await fetchUser();
      await loadTransactions();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Verification failed - try again later');
    }
    setVerifyingId(null);
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await paymentsAPI.withdraw({ amount: parseFloat(withdrawAmount), wallet_address: withdrawAddress });
      toast.success('Withdrawal submitted for approval');
      setShowWithdraw(false);
      setWithdrawAmount('');
      setWithdrawAddress('');
      await fetchUser();
      await loadTransactions();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Withdrawal failed');
    }
    setSubmitting(false);
  };

  const withdrawFee = 1;
  const withdrawTotal = withdrawAmount ? parseFloat(withdrawAmount) + withdrawFee : 0;

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
              <li><strong className="text-dark-300">Deposits:</strong> Send USDT (BEP-20) to the platform address. Your transaction is automatically verified on the BSC blockchain.</li>
              <li><strong className="text-dark-300">Withdrawals:</strong> Submit a withdrawal request. After admin approval, USDT is automatically sent to your BSC wallet.</li>
              <li><strong className="text-dark-300">Network:</strong> All transactions use BSC (Binance Smart Chain) for low fees and fast confirmations (~3 seconds).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
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
        <Tabs
          tabs={[
            { id: 'manual', label: 'Manual Transfer' },
            { id: 'metamask', label: 'MetaMask' },
          ]}
          activeTab={depositTab}
          onChange={setDepositTab}
        />

        {depositTab === 'manual' ? (
          <form onSubmit={handleDeposit} className="space-y-4 mt-4">
            {platformAddress && platformAddress !== '0x0000000000000000000000000000000000000000' ? (
              <div className="bg-dark-800 rounded-lg p-4">
                <p className="text-xs text-dark-400 mb-1">Send USDT (BEP-20) to this address:</p>
                <p className="text-sm font-mono text-primary-400 break-all select-all">{platformAddress}</p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    className="text-xs text-dark-500 hover:text-primary-400 transition-colors"
                    onClick={() => { navigator.clipboard.writeText(platformAddress); toast.success('Address copied'); }}
                  >
                    Copy Address
                  </button>
                  <a
                    href={`https://bscscan.com/address/${platformAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-dark-500 hover:text-primary-400 transition-colors"
                  >
                    View on BSCScan
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-xs text-yellow-400">Platform wallet not configured yet. Contact admin.</p>
              </div>
            )}
            <Input label="Amount (USDT)" type="number" step="0.01" min="1" placeholder="10.00" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} required />
            <Input label="Transaction Hash" placeholder="0x..." value={depositTxHash} onChange={(e) => setDepositTxHash(e.target.value)} required />
            <div className="bg-dark-800/50 rounded-lg p-3 space-y-1">
              <p className="text-xs text-dark-400">
                <strong className="text-dark-300">Auto-verified:</strong> Your transaction hash will be verified on the BSC blockchain automatically.
              </p>
              <p className="text-xs text-dark-500">
                If BSC hasn&apos;t confirmed your transaction yet, it will be marked as pending and you can verify it later.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setShowDeposit(false)} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1" loading={submitting}>Confirm Deposit</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 mt-4">
            {!walletConnected ? (
              <div className="text-center py-4">
                {isMetaMaskInstalled() ? (
                  <>
                    <p className="text-sm text-dark-400 mb-4">Connect your MetaMask wallet to deposit USDT directly on BSC.</p>
                    <Button onClick={handleConnectWallet}>Connect MetaMask</Button>
                  </>
                ) : (
                  <div>
                    <p className="text-sm text-dark-400 mb-2">MetaMask is not installed.</p>
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-400 text-sm hover:underline"
                    >
                      Install MetaMask
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleMetaMaskDeposit} className="space-y-4">
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-xs text-dark-400">Connected Wallet</p>
                  <p className="text-sm font-mono text-primary-400">{truncateAddress(connectedAddress, 8)}</p>
                </div>
                <Input label="Amount (USDT)" type="number" step="0.01" min="1" placeholder="10.00" value={metamaskAmount} onChange={(e) => setMetamaskAmount(e.target.value)} required />
                <p className="text-xs text-dark-500">USDT will be transferred from your wallet on BSC network and auto-verified on the blockchain.</p>
                <div className="flex gap-2">
                  <Button variant="secondary" type="button" onClick={() => setShowDeposit(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" className="flex-1" loading={submitting}>Send USDT</Button>
                </div>
              </form>
            )}
          </div>
        )}
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
