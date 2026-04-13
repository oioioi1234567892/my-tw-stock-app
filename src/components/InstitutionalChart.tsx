import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { InstitutionalData } from '../types';

interface InstitutionalChartProps {
  data: InstitutionalData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-2xl backdrop-blur-md">
        <p className="text-gray-400 text-xs mb-2 font-bold">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <span className="text-sm" style={{ color: entry.color }}>{entry.name}:</span>
              <span className="text-sm font-mono font-bold text-white">
                {entry.name === '收盤價' 
                  ? entry.value.toFixed(2) 
                  : `${(entry.value / 1000).toLocaleString()} 張`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function InstitutionalChart({ data }: InstitutionalChartProps) {
  return (
    <div className="bg-gray-800/50 p-4 md:p-8 rounded-2xl border border-gray-700 backdrop-blur-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl md:text-2xl font-black text-white tracking-tighter">三大法人買賣超趨勢</h3>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">外資(藍) / 投信(紅) / 自營商(紫) 與 收盤價對照</p>
        </div>
        <div className="flex gap-3 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
            <span className="text-gray-400">外資</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
            <span className="text-gray-400">投信</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
            <span className="text-gray-400">自營商</span>
          </div>
        </div>
      </div>

      <div className="h-[300px] md:h-[450px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              dy={10}
              tickFormatter={(val) => val.slice(5)} // Show only MM-DD
            />
            <YAxis 
              yAxisId="left"
              stroke="#6b7280" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#6b7280" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(value) => value.toFixed(1)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="top" 
              align="right" 
              height={36} 
              iconType="circle"
              wrapperStyle={{ fontSize: '10px' }}
            />
            
            <Bar 
              yAxisId="left"
              name="外資" 
              dataKey="foreignNet" 
              stackId="a"
              fill="#00b4ff" 
              animationDuration={1000}
            />
            <Bar 
              yAxisId="left"
              name="投信" 
              dataKey="trustNet" 
              stackId="a"
              fill="#ff3b30" 
              animationDuration={1200}
            />
            <Bar 
              yAxisId="left"
              name="自營商" 
              dataKey="dealerNet" 
              stackId="a"
              fill="#af52de" 
              animationDuration={1400}
            />

            <Line
              yAxisId="right"
              name="收盤價"
              type="monotone"
              dataKey="close"
              stroke="#ff9f0a"
              strokeWidth={2}
              dot={{ r: 3, fill: '#ff9f0a', strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0, fill: '#ffffff' }}
              animationDuration={2000}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
