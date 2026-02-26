'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { notificationsAPI } from '@/lib/api';
import { formatLTC } from '@/lib/utils';

const headerNav = [
  {
    href: '/messages',
    label: 'Messages',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
  {
    href: '/help',
    label: 'Help',
    icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    href: '/about',
    label: 'About',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

export default function Header() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      notificationsAPI.list(10).then(({ data }) => {
        setUnreadCount(data.unread_count);
      }).catch(() => {});
    }
  }, [user]);

  return (
    <header className="sticky top-0 z-30 bg-dark-900/60 backdrop-blur-xl border-b border-primary-400/10">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left Nav */}
        <nav className="flex items-center gap-1">
          {headerNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-primary-400/10 text-primary-400 border border-primary-400/20'
                    : 'text-dark-400 hover:text-dark-100 hover:bg-dark-700/50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-4">
          {/* Balance */}
          {user && (
            <Link href="/wallet" className="group flex items-center gap-2.5 pl-2 pr-4 py-1.5 bg-dark-800/60 border border-neon-gold/15 rounded-xl hover:border-neon-gold/40 hover:bg-dark-800/80 hover:shadow-[0_0_20px_rgba(240,176,0,0.1)] transition-all duration-300">
              {/* LTC Icon */}
              <div className="w-7 h-7 rounded-full bg-[#345D9D] flex items-center justify-center shadow-[0_0_8px_rgba(52,93,157,0.3)] group-hover:shadow-[0_0_12px_rgba(52,93,157,0.5)] transition-shadow">
                <svg className="w-4 h-4" viewBox="0 0 32 32" fill="none">
                  <path d="M16 4C9.37 4 4 9.37 4 16s5.37 12 12 12 12-5.37 12-12S22.63 4 16 4zm-1.5 17.5l.9-3.4-1.1.3.3-1.2 1.1-.3 1.5-5.7h2l-1.5 5.7 1.1-.3-.3 1.2-1.1.3-.9 3.4h-2zm4.5 0l.4-1.5h-1.5l.4-1.5h1.5l1.1-4.2h1.5l-1.1 4.2h1.5l-.4 1.5h-1.5l-.4 1.5h-1.5z" fill="white"/>
                </svg>
              </div>
              <div className="flex flex-col -space-y-0.5">
                <span className="text-sm font-black text-white group-hover:text-neon-gold transition-colors">{formatLTC(user.balance)}</span>
                <span className="text-[9px] text-dark-400 font-medium tracking-wider">LTC</span>
              </div>
            </Link>
          )}

          {/* Notifications */}
          <Link href="/notifications" className="relative p-2 text-dark-400 hover:text-primary-400 transition-colors duration-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-neon-red text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(255,51,85,0.4)]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          {/* User */}
          {user && (
            <Link href="/settings" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center shadow-neon">
                <span className="text-white text-sm font-black">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              </div>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
