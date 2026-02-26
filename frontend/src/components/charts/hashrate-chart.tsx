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
            <stop offset="5%" stopColor="#fb923c" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" vertical={false} />
        <XAxis dataKey="time" stroke="#444444" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#444444" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#141414',
            border: '1px solid #fb923c30',
            borderRadius: '8px',
            color: '#e8e8e8',
            boxShadow: '0 0 15px rgba(251,146,60,0.12)',
          }}
        />
        <Area type="monotone" dataKey="hashrate" stroke="#fb923c" fill="url(#hashrateGradient)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
