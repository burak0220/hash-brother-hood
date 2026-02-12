'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EarningsChartProps {
  data: { date: string; earnings: number }[];
}

export default function EarningsChart({ data }: EarningsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0b000" stopOpacity={1} />
            <stop offset="100%" stopColor="#f0b000" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#0d2a2a" vertical={false} />
        <XAxis dataKey="date" stroke="#406868" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#406868" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0a1418',
            border: '1px solid #f0b00030',
            borderRadius: '8px',
            color: '#e0f0f0',
            boxShadow: '0 0 15px rgba(240,176,0,0.1)',
          }}
          cursor={{ fill: 'rgba(240,176,0,0.05)' }}
        />
        <Bar dataKey="earnings" fill="url(#earningsGradient)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
