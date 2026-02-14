'use client';
import Link from 'next/link';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const features = [
  {
    title: 'Peer-to-Peer Hashrate',
    desc: 'Rent mining power directly from rig owners. No middleman, no markup.',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    color: 'text-primary-400 bg-primary-400/10',
  },
  {
    title: '70+ Algorithms',
    desc: 'SHA-256, Scrypt, Ethash, KawPoW, RandomX, kHeavyHash, and many more.',
    icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
    color: 'text-neon-green bg-neon-green/10',
  },
  {
    title: 'USDT Payments',
    desc: 'All transactions in USDT on Binance Smart Chain. Fast, cheap, reliable.',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'text-accent-400 bg-accent-400/10',
  },
  {
    title: 'Secure Platform',
    desc: '2FA authentication, escrow payments, and admin-approved withdrawals.',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    color: 'text-neon-gold bg-neon-gold/10',
  },
  {
    title: 'Low Fees',
    desc: 'Only 3% platform fee on rentals. No hidden charges, no surprises.',
    icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    color: 'text-blue-400 bg-blue-400/10',
  },
  {
    title: 'Real-Time Monitoring',
    desc: 'Track your hashrate performance and earnings with live dashboards.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    color: 'text-purple-400 bg-purple-400/10',
  },
];

const stats = [
  { value: '70+', label: 'Algorithms' },
  { value: '3%', label: 'Platform Fee' },
  { value: 'BSC', label: 'Network' },
  { value: '24/7', label: 'Uptime' },
];

export default function AboutPage() {
  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* Hero */}
      <div className="relative overflow-hidden neon-card rounded-2xl p-8 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary-400/5 rounded-full blur-[120px]" />
        <div className="relative">
          <img src="/logo.svg" alt="HashBrotherHood" className="mx-auto w-[280px] h-auto drop-shadow-[0_0_30px_rgba(0,240,255,0.15)] mb-6" />
          <h1 className="text-3xl font-black text-white mb-3">
            The Mining <span className="neon-text">Brotherhood</span>
          </h1>
          <p className="text-dark-300 max-w-lg mx-auto leading-relaxed">
            HashBrotherHood is a peer-to-peer cryptocurrency mining hashrate marketplace.
            Rent mining power on-demand or earn passive income by listing your rigs.
            Built on Binance Smart Chain with USDT payments.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="text-center">
            <p className="text-2xl font-black text-primary-400">{stat.value}</p>
            <p className="text-xs text-dark-400 uppercase tracking-wider mt-1">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Features */}
      <div>
        <h2 className="text-lg font-black text-white mb-4">Platform Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f) => (
            <Card key={f.title} hover>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${f.color}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={f.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{f.title}</h3>
                  <p className="text-xs text-dark-400 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-400/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <CardTitle>How It Works</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: '01', title: 'Register', desc: 'Create your free account in seconds' },
              { step: '02', title: 'Deposit', desc: 'Fund your wallet with USDT (BEP-20)' },
              { step: '03', title: 'Choose Rig', desc: 'Browse and select from available rigs' },
              { step: '04', title: 'Start Mining', desc: 'Enter pool details and start hashing' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary-400/10 border border-primary-400/20 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xs font-black text-primary-400">{s.step}</span>
                </div>
                <h4 className="text-sm font-bold text-white">{s.title}</h4>
                <p className="text-xs text-dark-400 mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="text-center py-6">
        <p className="text-dark-400 mb-4">Ready to join the brotherhood?</p>
        <div className="flex gap-3 justify-center">
          <Link href="/marketplace" className="px-6 py-3 bg-gradient-to-r from-primary-400 to-primary-500 text-dark-950 font-bold text-sm rounded-xl hover:opacity-90 transition-opacity">
            Browse Marketplace
          </Link>
          <Link href="/my-rigs/new" className="px-6 py-3 border border-dark-500/50 text-dark-200 font-bold text-sm rounded-xl hover:border-primary-400/40 hover:text-primary-400 transition-all">
            List Your Rig
          </Link>
        </div>
      </div>
    </div>
  );
}
