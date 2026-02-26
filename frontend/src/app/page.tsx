'use client';
import Link from 'next/link';

import { useEffect, useRef, useState } from 'react';

function AnimatedCounter({ target, suffix = '' }: { target: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const num = parseInt(target.replace(/[^0-9]/g, ''));
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(num / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= num) { setCount(num); clearInterval(timer); }
      else setCount(start);
    }, 30);
    return () => clearInterval(timer);
  }, [num]);
  return <>{count.toLocaleString()}{suffix}</>;
}

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = '01アイウエオカキクケコハッシュブラザー₿⛏';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(9, 9, 9, 0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fb923c0a';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.98) drops[i] = 0;
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50);
    const handleResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', handleResize);
    return () => { clearInterval(interval); window.removeEventListener('resize', handleResize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="bg-dark-950 text-white selection:bg-primary-400/30">
      <MatrixRain />

      {/* === FIXED TOP BAR - minimal === */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrollY > 50 ? 'bg-dark-950/90 backdrop-blur-xl border-b border-primary-400/10' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <img src="/logo.svg" alt="HashBrotherHood" className="w-[32px] h-[32px] object-contain" />
            <span className="text-sm font-black tracking-tight hidden sm:block"><span className="text-white">Hash</span><span className="text-primary-400">Brother</span><span className="text-white">Hood</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-4 py-1.5 text-sm text-dark-300 hover:text-white transition-colors">
              Login
            </Link>
            <Link href="/register" className="px-4 py-1.5 text-sm bg-primary-400/10 border border-primary-400/30 text-primary-400 rounded hover:bg-primary-400/20 transition-all">
              Register
            </Link>
          </div>
        </div>
      </nav>

      {/* === SCREEN 1: CINEMATIC HERO === */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Radial glow behind logo */}
        <div className="absolute w-[600px] h-[600px] bg-primary-400/5 rounded-full blur-[120px]" />
        <div className="absolute w-[400px] h-[400px] bg-accent-400/5 rounded-full blur-[100px] translate-y-20" />

        {/* Animated rings */}
        <div className="absolute w-[500px] h-[500px] border border-primary-400/5 rounded-full animate-[spin_30s_linear_infinite]" />
        <div className="absolute w-[700px] h-[700px] border border-primary-400/[0.03] rounded-full animate-[spin_45s_linear_infinite_reverse]" />

        {/* Logo */}
        <div className={`relative z-10 transition-all duration-1000 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <img
            src="/logo.svg"
            alt="HashBrotherHood"
            className="w-full max-w-[520px] h-auto drop-shadow-[0_0_60px_rgba(251,146,60,0.25)]"
          />
        </div>

        {/* Tagline */}
        <div className={`relative z-10 text-center mt-6 transition-all duration-1000 delay-300 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <p className="text-lg md:text-2xl text-dark-200 font-light tracking-[0.15em]">
            HASHRATE MARKETPLACE
          </p>
        </div>

        {/* CTA Buttons */}
        <div className={`relative z-10 flex gap-4 mt-10 transition-all duration-1000 delay-500 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <Link href="/register" className="group relative px-8 py-3.5 rounded-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-accent-500 opacity-90 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-accent-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />
            <span className="relative z-10 text-dark-950 font-black text-sm tracking-wider uppercase">Rent Hashpower</span>
          </Link>
          <Link href="/marketplace" className="group px-8 py-3.5 border border-dark-500/50 hover:border-primary-400/40 rounded-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(251,146,60,0.15)]">
            <span className="text-dark-200 group-hover:text-primary-400 font-semibold text-sm tracking-wider uppercase transition-colors">Browse Market</span>
          </Link>
        </div>

        {/* Scroll indicator */}
        <div className={`absolute bottom-8 z-10 flex flex-col items-center gap-2 transition-all duration-1000 delay-700 ${loaded ? 'opacity-60' : 'opacity-0'}`}>
          <span className="text-[10px] text-dark-400 uppercase tracking-[0.3em]">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-primary-400/50 to-transparent animate-pulse" />
        </div>
      </section>

      {/* === SCREEN 2: STATS - FLOATING HOLOGRAPHIC === */}
      <section className="relative py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { value: '2500', suffix: '+', label: 'ACTIVE RIGS', glow: 'from-primary-400/20' },
              { value: '15000', suffix: '+', label: 'MINERS', glow: 'from-neon-green/20' },
              { value: '10', suffix: '+', label: 'ALGORITHMS', glow: 'from-accent-400/20' },
              { value: '99', suffix: '.9%', label: 'UPTIME', glow: 'from-primary-400/20' },
            ].map((s, i) => (
              <div key={s.label} className="group relative" style={{ animationDelay: `${i * 150}ms` }}>
                <div className={`absolute inset-0 bg-gradient-to-b ${s.glow} to-transparent opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-700`} />
                <div className="relative bg-dark-900/60 backdrop-blur border border-dark-600/30 rounded-xl p-6 text-center hover:border-primary-400/20 transition-all duration-500">
                  <p className="text-3xl md:text-4xl font-black text-white mb-1">
                    <AnimatedCounter target={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-[10px] text-dark-400 tracking-[0.25em] uppercase">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === SCREEN 3: WHAT WE DO - HORIZONTAL SCROLL FEEL === */}
      <section className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-xs text-primary-400 tracking-[0.4em] uppercase mb-4">// PROTOCOL</h2>
            <p className="text-3xl md:text-5xl font-black">
              How It <span className="text-primary-400">Works</span>
            </p>
          </div>

          <div className="relative">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-400/20 to-transparent" />

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { n: '01', title: 'REGISTER', desc: 'Create your account. Takes 10 seconds.', color: 'border-primary-400/30' },
                { n: '02', title: 'DEPOSIT', desc: 'Fund your wallet with LTC.', color: 'border-neon-green/30' },
                { n: '03', title: 'SELECT RIG', desc: 'Browse marketplace. Pick your rig.', color: 'border-accent-400/30' },
                { n: '04', title: 'HASH', desc: 'Point to your pool. Start hashing.', color: 'border-primary-400/30' },
              ].map((step, i) => (
                <div key={step.n} className={`relative bg-dark-900/40 backdrop-blur-sm border ${step.color} rounded-xl p-6 hover:bg-dark-800/40 transition-all duration-500 group`}>
                  <div className="absolute -top-3 left-6 px-2 bg-dark-950 text-primary-400 text-xs font-mono tracking-widest">{step.n}</div>
                  <div className="pt-2">
                    <h3 className="text-lg font-black text-white mb-2 tracking-wide">{step.title}</h3>
                    <p className="text-sm text-dark-400 leading-relaxed">{step.desc}</p>
                  </div>
                  {/* Dot on the line */}
                  <div className="hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-primary-400 rounded-full shadow-[0_0_10px_rgba(251,146,60,0.5)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* === SCREEN 4: FEATURES - BENTO GRID === */}
      <section className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-xs text-accent-400 tracking-[0.4em] uppercase mb-4">// FEATURES</h2>
            <p className="text-3xl md:text-5xl font-black">
              Built for <span className="text-accent-400">Power</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Big card */}
            <div className="md:col-span-2 md:row-span-2 relative overflow-hidden bg-dark-900/40 border border-dark-600/20 rounded-2xl p-8 group hover:border-primary-400/20 transition-all duration-500">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-400/5 rounded-full blur-[80px] group-hover:bg-primary-400/10 transition-all" />
              <div className="relative z-10">
                <div className="text-primary-400 mb-4">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-2xl font-black text-white mb-3">Instant Hashpower Access</h3>
                <p className="text-dark-300 leading-relaxed max-w-md">
                  No hardware purchases. No electricity bills. No maintenance headaches.
                  Rent hashpower within minutes and start earning immediately.
                  Pay only for what you use.
                </p>
                <div className="mt-6 flex gap-3">
                  <span className="px-3 py-1 bg-primary-400/10 border border-primary-400/20 rounded text-xs text-primary-400 font-mono">SHA-256</span>
                  <span className="px-3 py-1 bg-primary-400/10 border border-primary-400/20 rounded text-xs text-primary-400 font-mono">ETHASH</span>
                  <span className="px-3 py-1 bg-primary-400/10 border border-primary-400/20 rounded text-xs text-primary-400 font-mono">SCRYPT</span>
                  <span className="px-3 py-1 bg-primary-400/10 border border-primary-400/20 rounded text-xs text-primary-400 font-mono">+7</span>
                </div>
              </div>
            </div>

            {/* Small cards */}
            <div className="bg-dark-900/40 border border-dark-600/20 rounded-2xl p-6 hover:border-neon-green/20 transition-all duration-500 group">
              <div className="text-neon-green mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <h3 className="font-bold text-white mb-1">Secure Escrow</h3>
              <p className="text-sm text-dark-400">Funds protected. Pay for verified hashrate only.</p>
            </div>

            <div className="bg-dark-900/40 border border-dark-600/20 rounded-2xl p-6 hover:border-accent-400/20 transition-all duration-500 group">
              <div className="text-accent-400 mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h3 className="font-bold text-white mb-1">Live Monitoring</h3>
              <p className="text-sm text-dark-400">Real-time hashrate charts and earnings.</p>
            </div>

            <div className="md:col-span-3 bg-dark-900/40 border border-dark-600/20 rounded-2xl p-6 hover:border-primary-400/20 transition-all duration-500">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <h3 className="text-lg font-black text-white mb-2">Earn Passive Income as a Rig Owner</h3>
                  <p className="text-sm text-dark-400">List your rigs on the marketplace. Set your own prices. Earn LTC while you sleep. The brotherhood takes care of the rest.</p>
                </div>
                <Link href="/register" className="shrink-0 px-6 py-3 bg-accent-400/10 border border-accent-400/30 text-accent-400 rounded-lg font-bold text-sm hover:bg-accent-400/20 transition-all">
                  List Your Rig
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === INTO THE WILD - BUS 142 === */}
      <section className="relative py-32 px-6 overflow-hidden">
        {/* Background atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-b from-dark-950 via-[#0a1a0f] to-dark-950 opacity-60" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-green-800/30 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-green-800/30 to-transparent" />

        <div className="relative max-w-5xl mx-auto">
          {/* Bus 142 ASCII Art */}
          <div className="flex justify-center mb-12">
            <div className="relative">
              {/* Glow behind bus */}
              <div className="absolute inset-0 bg-green-400/5 blur-[80px] rounded-full" />
              <pre className="relative text-[10px] sm:text-xs md:text-sm font-mono leading-tight text-green-600/60 select-none whitespace-pre">
{`         ___________________________
        |  _________________________ |
        | |     FAIRBANKS CITY      | |
        | |     TRANSIT SYSTEM      | |
        | |_________________________| |
        |  ___ ___ ___ ___ ___ ___    |
   ___  | |   |   |   |   |   |  |   |
  | 1 | | |   |   |   |   |   |  |   |
  | 4 | | |___|___|___|___|___|__|   |
  | 2 | |                            |
  |___| |   B  U  S    1  4  2       |
        |____________________________|
        |  ()                    ()  |
        |____________________________| `}
              </pre>
            </div>
          </div>

          {/* Quote */}
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-block px-4 py-1.5 bg-green-900/20 border border-green-700/20 rounded-full mb-6">
              <span className="text-[10px] text-green-500/80 uppercase tracking-[0.4em] font-medium">Bus 142 — Stampede Trail, Alaska</span>
            </div>

            <blockquote className="text-xl md:text-2xl font-light text-dark-200 italic leading-relaxed mb-6">
              &ldquo;Happiness is only real when shared.&rdquo;
            </blockquote>
            <p className="text-sm text-dark-400 mb-2">
              — Christopher Johnson McCandless
            </p>
            <p className="text-xs text-dark-500/60 max-w-md mx-auto mt-6 leading-relaxed">
              Just as McCandless sought freedom in the Alaskan wilderness, we believe in the freedom of decentralized mining.
              No borders. No limits. The brotherhood mines together.
            </p>

            {/* Decorative line */}
            <div className="flex items-center justify-center gap-3 mt-10">
              <div className="w-12 h-px bg-gradient-to-r from-transparent to-green-700/40" />
              <span className="text-green-600/40 text-xs font-mono">142</span>
              <div className="w-12 h-px bg-gradient-to-l from-transparent to-green-700/40" />
            </div>
          </div>
        </div>
      </section>

      {/* === SCREEN 5: CTA - MINIMAL === */}
      <section className="relative py-32 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <img src="/logo.svg" alt="HBH" className="mx-auto mb-8 w-[180px] h-auto opacity-50" />
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            Join the <span className="neon-text">Brotherhood</span>
          </h2>
          <p className="text-dark-400 mb-10 text-lg">
            Mine together. Earn together. Grow together.
          </p>
          <Link href="/register" className="group relative inline-block px-10 py-4 rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-accent-500 opacity-90 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-accent-500 blur-2xl opacity-30 group-hover:opacity-50 transition-opacity" />
            <span className="relative z-10 text-dark-950 font-black tracking-wider uppercase">Create Account</span>
          </Link>
        </div>
      </section>

      {/* === FOOTER - ULTRA MINIMAL === */}
      <footer className="border-t border-dark-700/30 py-6 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-dark-500">
          <span>HBH &copy; 2024</span>
          <div className="flex gap-4">
            <Link href="/marketplace" className="hover:text-primary-400 transition-colors">Marketplace</Link>
            <Link href="/login" className="hover:text-primary-400 transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
