import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatLTC(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.max(0, isNaN(num) ? 0 : num).toFixed(8);
}

// Hashrate unit prefixes and multipliers
const HASH_PREFIXES = [
  { prefix: '', multiplier: 1 },
  { prefix: 'K', multiplier: 1e3 },
  { prefix: 'M', multiplier: 1e6 },
  { prefix: 'G', multiplier: 1e9 },
  { prefix: 'T', multiplier: 1e12 },
  { prefix: 'P', multiplier: 1e15 },
  { prefix: 'E', multiplier: 1e18 },
];

// Extract base type from unit (e.g., "TH/s" → "H/s", "KSol/s" → "Sol/s")
export function getUnitBaseType(unit: string): string {
  for (const { prefix } of [...HASH_PREFIXES].reverse()) {
    if (prefix && unit.startsWith(prefix)) {
      return unit.slice(prefix.length);
    }
  }
  return unit;
}

// Get prefix multiplier (e.g., "TH/s" → 1e12, "KH/s" → 1e3, "H/s" → 1)
export function getUnitMultiplier(unit: string): number {
  for (const { prefix, multiplier } of [...HASH_PREFIXES].reverse()) {
    if (prefix && unit.startsWith(prefix)) {
      return multiplier;
    }
  }
  return 1;
}

// Get available unit options for a given base type
export function getUnitOptions(baseUnit: string): { value: string; label: string }[] {
  const baseType = getUnitBaseType(baseUnit);
  return HASH_PREFIXES.map(({ prefix }) => {
    const unit = `${prefix}${baseType}`;
    const labels: Record<string, string> = {
      '': '', 'K': 'Kilo', 'M': 'Mega', 'G': 'Giga', 'T': 'Tera', 'P': 'Peta', 'E': 'Exa',
    };
    return {
      value: unit,
      label: `${unit} (${labels[prefix] || ''}${baseType.replace('/', ' per ')})`.replace('( ', '('),
    };
  });
}

// Convert value from one unit to another (same base type)
export function convertHashrate(value: number, fromUnit: string, toUnit: string): number {
  const fromMul = getUnitMultiplier(fromUnit);
  const toMul = getUnitMultiplier(toUnit);
  return value * (fromMul / toMul);
}

export function formatHashrate(hashrate: number | string, unit: string = 'TH/s'): string {
  let num = typeof hashrate === 'string' ? parseFloat(hashrate) : hashrate;
  num = Math.max(0, isNaN(num) ? 0 : num);

  // Auto-scale: find the best unit for display
  const baseType = getUnitBaseType(unit);
  const absValue = num * getUnitMultiplier(unit); // convert to base

  let bestPrefix = '';
  let bestValue = absValue;
  for (const { prefix, multiplier } of HASH_PREFIXES) {
    const scaled = absValue / multiplier;
    if (scaled >= 1 || multiplier === 1) {
      bestPrefix = prefix;
      bestValue = scaled;
    }
  }

  const displayUnit = `${bestPrefix}${baseType}`;
  const formatted = bestValue >= 1000
    ? bestValue.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : bestValue % 1 === 0
      ? bestValue.toString()
      : bestValue.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');

  return `${formatted} ${displayUnit}`;
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
    active: 'bg-green-500/10 text-green-400 border-green-500/20',
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
    rental_earning: 'text-primary-400',
    refund: 'text-[#f0b000]',
    fee: 'text-dark-400',
  };
  return colors[type] || 'text-dark-400';
}

export const REGIONS: Record<string, { flag: string; label: string; short: string }> = {
  'auto':       { flag: '🌐', label: 'Auto (No preference)', short: 'Auto' },
  'us-east':    { flag: '🇺🇸', label: 'US East (NY / VA)',   short: 'US East' },
  'us-west':    { flag: '🇺🇸', label: 'US West (CA / OR)',   short: 'US West' },
  'us-central': { flag: '🇺🇸', label: 'US Central (TX / IL)', short: 'US Central' },
  'eu-west':    { flag: '🇪🇺', label: 'EU West (UK / NL)',   short: 'EU West' },
  'eu-de':      { flag: '🇩🇪', label: 'EU Germany (Frankfurt)', short: 'Germany' },
  'eu-fi':      { flag: '🇫🇮', label: 'EU Finland (Helsinki)', short: 'Finland' },
  'eu-fr':      { flag: '🇫🇷', label: 'EU France (Paris)',   short: 'France' },
  'eu-nl':      { flag: '🇳🇱', label: 'EU Netherlands (Amsterdam)', short: 'Netherlands' },
  'eu-se':      { flag: '🇸🇪', label: 'EU Sweden (Stockholm)', short: 'Sweden' },
  'ca':         { flag: '🇨🇦', label: 'Canada',              short: 'Canada' },
  'asia':       { flag: '🌏', label: 'Asia Pacific',          short: 'Asia' },
  'asia-sg':    { flag: '🇸🇬', label: 'Asia Pacific (Singapore)', short: 'Singapore' },
  'asia-jp':    { flag: '🇯🇵', label: 'Asia Pacific (Tokyo)', short: 'Japan' },
  'asia-hk':    { flag: '🇭🇰', label: 'Asia Pacific (Hong Kong)', short: 'Hong Kong' },
  'asia-kr':    { flag: '🇰🇷', label: 'Asia Pacific (Seoul)', short: 'Korea' },
  'au':         { flag: '🇦🇺', label: 'Australia (Sydney)',   short: 'Australia' },
  'sa':         { flag: '🌎', label: 'South America (São Paulo)', short: 'S. America' },
  'ru':         { flag: '🇷🇺', label: 'Russia (Moscow)',      short: 'Russia' },
};

export function regionInfo(region: string | null | undefined): { flag: string; label: string; short: string } {
  if (!region || region === 'auto') return REGIONS['auto'];
  return REGIONS[region] || { flag: '🌐', label: region, short: region };
}

export function truncateAddress(address: string, chars: number = 6): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
