import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatUSDT(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toFixed(2);
}

export function formatHashrate(hashrate: number | string, unit: string = 'TH/s'): string {
  const num = typeof hashrate === 'string' ? parseFloat(hashrate) : hashrate;
  return `${num.toLocaleString()} ${unit}`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function statusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-neon-cyan/10 text-[#00f0ff] border-[#00f0ff]/20',
    inactive: 'bg-dark-600/30 text-dark-400 border-dark-500/30',
    rented: 'bg-neon-gold/10 text-[#f0b000] border-[#f0b000]/20',
    maintenance: 'bg-neon-gold/10 text-[#f0b000] border-[#f0b000]/20',
    pending: 'bg-neon-gold/10 text-[#f0b000] border-[#f0b000]/20',
    completed: 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/20',
    cancelled: 'bg-neon-red/10 text-[#ff3355] border-[#ff3355]/20',
    expired: 'bg-dark-600/30 text-dark-400 border-dark-500/30',
    failed: 'bg-neon-red/10 text-[#ff3355] border-[#ff3355]/20',
  };
  return colors[status] || 'bg-dark-600/30 text-dark-400 border-dark-500/30';
}

export function transactionTypeColor(type: string): string {
  const colors: Record<string, string> = {
    deposit: 'text-[#00ff88]',
    withdrawal: 'text-[#ff3355]',
    rental_payment: 'text-[#f0b000]',
    rental_earning: 'text-[#00f0ff]',
    refund: 'text-[#f0b000]',
    fee: 'text-dark-400',
  };
  return colors[type] || 'text-dark-400';
}

export function truncateAddress(address: string, chars: number = 6): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
