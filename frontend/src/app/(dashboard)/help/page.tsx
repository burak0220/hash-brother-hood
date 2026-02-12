'use client';
import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Link from 'next/link';

const faqs = [
  {
    q: 'How do I rent a mining rig?',
    a: 'Go to the Marketplace, browse available rigs, select one, choose your duration, enter your pool credentials, and confirm the rental. The cost will be deducted from your USDT balance.',
  },
  {
    q: 'How do I deposit USDT?',
    a: 'Navigate to the Wallet page, click "Deposit", and send USDT (BEP-20) to the displayed platform wallet address. Enter the transaction hash to confirm your deposit.',
  },
  {
    q: 'How do I list my mining rig?',
    a: 'Go to My Rigs, click "Add Rig", fill in your rig details (algorithm, hashrate, price per hour), and submit. Your rig will appear on the marketplace.',
  },
  {
    q: 'What is the platform fee?',
    a: 'HashBrotherHood charges a 3% platform fee on each rental. This is deducted from the rig owner\'s earnings automatically.',
  },
  {
    q: 'How do withdrawals work?',
    a: 'Go to Wallet, click "Withdraw", enter the amount and your BSC wallet address. Withdrawals require admin approval and are processed within 24 hours.',
  },
  {
    q: 'What happens if a rig goes offline during my rental?',
    a: 'If a rig goes offline, you can cancel the rental and receive a refund for the unused portion of your rental period.',
  },
  {
    q: 'How do I enable 2FA?',
    a: 'Go to Settings, find the Two-Factor Authentication section, and click Enable. Scan the QR code with Google Authenticator or a similar app.',
  },
  {
    q: 'Which algorithms are supported?',
    a: 'We support 70+ mining algorithms including SHA-256, Scrypt, Ethash, KawPoW, RandomX, kHeavyHash (Kaspa), Autolykos2 (Ergo), and many more. Rig owners can also add custom algorithms.',
  },
];

const guides = [
  { title: 'Getting Started', desc: 'Create account, deposit, and rent your first rig', icon: 'M13 10V3L4 14h7v7l9-11h-7z', color: 'text-primary-400 bg-primary-400/10' },
  { title: 'Listing Your Rig', desc: 'How to list and manage your mining rigs', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z', color: 'text-neon-green bg-neon-green/10' },
  { title: 'Wallet & Payments', desc: 'Deposits, withdrawals, and transaction history', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', color: 'text-accent-400 bg-accent-400/10' },
  { title: 'Security & 2FA', desc: 'Protect your account with two-factor auth', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', color: 'text-neon-gold bg-neon-gold/10' },
];

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <p className="text-xs text-primary-400 font-medium uppercase tracking-[0.3em] mb-1">Support</p>
        <h1 className="text-2xl font-black text-white">Help Center</h1>
        <p className="text-dark-400 text-sm mt-1">Everything you need to know about HashBrotherHood</p>
      </div>

      {/* Quick Guides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {guides.map((guide) => (
          <Card key={guide.title} hover className="group">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${guide.color}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={guide.icon} />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-primary-400 transition-colors">{guide.title}</h3>
                <p className="text-xs text-dark-400 mt-0.5">{guide.desc}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-400/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-dark-600/30 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-dark-800/40 transition-colors"
                >
                  <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                  <svg
                    className={`w-4 h-4 text-dark-400 flex-shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-dark-300 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-400/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <CardTitle>Need More Help?</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-dark-400 mb-4">Can&apos;t find what you&apos;re looking for? Reach out to us.</p>
          <div className="flex gap-3">
            <Link href="/messages" className="px-5 py-2.5 bg-primary-400/10 border border-primary-400/20 text-primary-400 rounded-lg text-sm font-bold hover:bg-primary-400/20 transition-all">
              Send Message
            </Link>
            <a href="mailto:support@hashbrotherhood.com" className="px-5 py-2.5 bg-dark-800 border border-dark-600 text-dark-200 rounded-lg text-sm font-medium hover:bg-dark-700 transition-all">
              Email Support
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
