'use client';
import Link from 'next/link';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="particle" style={{ left: `${20 + i * 15}%`, top: `${10 + i * 18}%`, animationDelay: `${i * 0.8}s`, opacity: 0.3 }} />
        ))}
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Image src="/logo.png" alt="HashBrotherHood" width={220} height={140} className="mx-auto logo-blend drop-shadow-[0_0_40px_rgba(0,240,255,0.3)]" />
          </Link>
        </div>
        <div className="neon-card rounded-2xl p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
