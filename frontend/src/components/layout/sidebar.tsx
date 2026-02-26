'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const navSections = [
    {
      title: 'TRADE',
      items: [
        {
          href: '/dashboard',
          label: 'Overview',
          // Bar chart / dashboard icon
          icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
        },
        {
          href: '/marketplace',
          label: 'Rent Hashpower',
          // Lightning / rent icon
          icon: 'M13 10V3L4 14h7v7l9-11h-7z',
        },
        {
          href: '/my-rigs',
          label: 'Sell Hashpower',
          // CPU / rig icon
          icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
        },
        {
          href: '/rentals',
          label: 'My Rentals',
          // Clipboard / list icon
          icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
        },
        {
          href: '/messages',
          label: 'Messages',
          // Chat bubble icon
          icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
        },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        {
          href: '/wallet',
          label: 'Wallet & Deposits',
          // Wallet icon
          icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
        },
        {
          href: '/disputes',
          label: 'Disputes & Escrow',
          // Scales / balance icon
          icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
        },
      ],
    },
    {
      title: 'ACCOUNT',
      items: [
        {
          href: '/notifications',
          label: 'Alerts',
          // Bell icon
          icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
        },
        {
          href: '/support',
          label: 'Support',
          // Lifesaver / support icon
          icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z',
        },
        {
          href: '/settings',
          label: 'Settings',
          // Gear icon
          icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
        },
      ],
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-dark-950 border-r border-dark-800 flex flex-col z-40">

      {/* ─── Logo ─── */}
      <div className="px-4 pt-5 pb-3">
        <Link href="/dashboard" className="group block">
          <div className="flex items-center gap-3">

            {/* Pickaxe icon in hexagonal frame */}
            <div className="relative w-10 h-10 shrink-0">
              <div className="absolute inset-0 bg-primary-400/10 rounded-xl group-hover:bg-primary-400/20 transition-colors" />
              <svg viewBox="0 0 36 36" className="w-10 h-10" fill="none">
                <defs>
                  <linearGradient id="sbgr" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fb923c" />
                    <stop offset="100%" stopColor="#c2410c" />
                  </linearGradient>
                </defs>
                {/* Hexagon frame */}
                <polygon
                  points="18,2 32,10 32,26 18,34 4,26 4,10"
                  fill="url(#sbgr)" fillOpacity="0.08"
                  stroke="url(#sbgr)" strokeWidth="1.5"
                />
                {/* Pickaxe HEAD — solid polygon (spike left, adze right) */}
                <polygon
                  points="5,11 13,7 18,6 28,9 29,14 20,17 17,15 13,19 7,16 5,13"
                  fill="url(#sbgr)"
                />
                {/* Pickaxe HANDLE — diagonal parallelogram */}
                <polygon
                  points="13,19 17,15 27,26 24,30"
                  fill="url(#sbgr)"
                />
              </svg>
            </div>

            {/* Wordmark — single line */}
            <div className="leading-none">
              <div className="text-[13px] font-black tracking-tight whitespace-nowrap">
                <span className="text-white">HASH</span>
                <span className="text-primary-400">BROTHER</span>
                <span className="text-white">HOOD</span>
              </div>
              <p className="text-[7px] text-dark-500 tracking-[2.5px] uppercase mt-0.5">
                HASHRATE MARKET
              </p>
            </div>

          </div>
        </Link>
      </div>

      {/* ─── Live Status ─── */}
      <div className="mx-4 mb-3 px-3 py-2 bg-dark-900/80 rounded-lg border border-primary-400/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wider">Live</span>
          </div>
          <span className="text-[9px] text-dark-500">LTC Mainnet</span>
        </div>
      </div>

      {/* ─── Navigation ─── */}
      <nav className="flex-1 px-3 overflow-y-auto space-y-4">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="text-[9px] text-dark-600 uppercase tracking-[0.2em] font-bold px-3 mb-1.5">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary-400/10 text-primary-400 border border-primary-400/15'
                        : 'text-dark-400 hover:text-white hover:bg-dark-800/60',
                    )}
                  >
                    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                    {item.label}
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-400" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Admin panel link */}
        {user?.role === 'admin' && (
          <div className="border-t border-dark-800 pt-2">
            <p className="text-[9px] text-dark-600 uppercase tracking-[0.2em] font-bold px-3 mb-1.5">ADMIN</p>
            <Link
              href="/admin"
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200',
                pathname.startsWith('/admin')
                  ? 'bg-amber-400/10 text-amber-400 border border-amber-400/15'
                  : 'text-dark-400 hover:text-amber-400 hover:bg-dark-800/60',
              )}
            >
              <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin Panel
            </Link>
          </div>
        )}
      </nav>

      {/* ─── User Card ─── */}
      {user && (
        <div className="p-3 border-t border-dark-800">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-[0_0_10px_rgba(251,146,60,0.2)]">
              <span className="text-white text-xs font-black">{user.username.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.username}</p>
              <p className="text-[10px] text-dark-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] text-dark-500 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all border border-transparent hover:border-red-400/10"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      )}
    </aside>
  );
}
