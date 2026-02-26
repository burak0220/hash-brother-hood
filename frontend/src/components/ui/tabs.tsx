'use client';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 bg-dark-800/50 p-1 rounded-lg border border-dark-600/50 overflow-x-auto scrollbar-thin', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 whitespace-nowrap shrink-0',
            activeTab === tab.id
              ? 'bg-primary-400/15 text-primary-400 border border-primary-400/20 shadow-[0_0_8px_rgba(251,146,60,0.15)]'
              : 'text-dark-400 hover:text-white hover:bg-dark-700/50',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
