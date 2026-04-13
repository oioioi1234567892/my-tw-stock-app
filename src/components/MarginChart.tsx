import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { MarginData } from '../types';

interface MarginChartProps {
  data: MarginData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-2xl backdrop-blur-md">
        <p className="text-gray-400 text-xs mb-2 font-bold">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="text-sm" style={{ color: entry.color }}>{entry.name}:</span>
              <span className="text-sm font-mono font-bold text-white">
                {entry.value.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function MarginChart({ data }: MarginChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-800/30 rounded-2xl border border-gray-800">
        <p className="text-gray-500 font-medium">暫無年度/季度三率數據</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 p-4 md:p-8 rounded-2xl border border-gray-700 backdrop-blur-sm space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl md:text-2xl font-black text-white tracking-tighter">三率共振圖</h3>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">盈利能力趨勢分析 (毛利率 / 營業利益率 / 淨利率)</p>
        </div>
        <div className="hidden md:flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            <span className="text-xs text-gray-400">毛利率</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-xs text-gray-400">營業利益率</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
            <span className="text-xs text-gray-400">淨利率</span>
          </div>
        </div>
      </div>

      <div className="h-[300px] md:h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              dy={10}
            />
            <YAxis 
              stroke="#6b7280" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="top" 
              align="right" 
              height={36} 
              iconType="circle"
              wrapperStyle={{ fontSize: '10px', paddingTop: '0px' }}
            />
            <Line
              name="毛利率"
              type="monotone"
              dataKey="grossMargin"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: '#111827' }}
              activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }}
              animationDuration={1500}
            />
            <Line
              name="營業利益率"
              type="monotone"
              dataKey="operatingMargin"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: '#111827' }}
              activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
              animationDuration={1500}
            />
            <Line
              name="淨利率"
              type="monotone"
              dataKey="netMargin"
              stroke="#a855f7"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: '#111827' }}
              activeDot={{ r: 6, strokeWidth: 0, fill: '#a855f7' }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-800">
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/50">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">最新毛利率</p>
          <p className="text-xl font-black text-blue-400">{data[data.length-1].grossMargin.toFixed(2)}%</p>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/50">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">最新營業利益率</p>
          <p className="text-xl font-black text-emerald-400">{data[data.length-1].operatingMargin.toFixed(2)}%</p>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/50">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">最新淨利率</p>
          <p className="text-xl font-black text-purple-400">{data[data.length-1].netMargin.toFixed(2)}%</p>
        </div>
      </div>
    </div>
  );
}
