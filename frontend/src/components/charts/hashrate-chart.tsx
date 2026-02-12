'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface HashrateChartProps {
  data: { time: string; hashrate: number }[];
}

export default function HashrateChart({ data }: HashrateChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="hashrateGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#0d2a2a" vertical={false} />
        <XAxis dataKey="time" stroke="#406868" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#406868" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0a1418',
            border: '1px solid #00f0ff30',
            borderRadius: '8px',
            color: '#e0f0f0',
            boxShadow: '0 0 15px rgba(0,240,255,0.1)',
          }}
        />
        <Area type="monotone" dataKey="hashrate" stroke="#00f0ff" fill="url(#hashrateGradient)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
