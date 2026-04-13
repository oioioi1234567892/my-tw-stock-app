import React from 'react';
import { InstitutionalData } from '../types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface InstitutionalTableProps {
  data: InstitutionalData[];
}

export default function InstitutionalTable({ data }: InstitutionalTableProps) {
  // We need at least some data
  if (!data || data.length === 0) return null;

  // Calculate 10-day cumulative for the last 20 records
  const displayData = data
    .slice(-20)
    .reverse()
    .map((item, idx) => {
      const actualIdxInFullData = data.length - 1 - idx;
      
      // Get the last 10 days for cumulative calculation
      const window = data.slice(Math.max(0, actualIdxInFullData - 9), actualIdxInFullData + 1);
      const total10DayNet = window.reduce((sum, d) => 
        sum + (d.foreignNet + d.trustNet + d.dealerNet), 0);

      return {
        ...item,
        total10DayNet
      };
    });

  const formatVolume = (val: number) => {
    const k = Math.round(val / 1000);
    return k === 0 ? '---' : `${k > 0 ? '+' : ''}${k.toLocaleString()}K`;
  };

  return (
    <div className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden backdrop-blur-sm">
      <div className="p-4 border-b border-gray-700 bg-gray-900/40">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider">法人買賣超明細 (近 20 日)</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs md:text-sm text-left border-collapse">
          <thead>
            <tr className="bg-gray-900/60 text-gray-400 font-bold">
              <th className="px-4 py-3 border-b border-gray-700">日期</th>
              <th className="px-4 py-3 border-b border-gray-700 text-blue-400">外資</th>
              <th className="px-4 py-3 border-b border-gray-700 text-red-400">投信</th>
              <th className="px-4 py-3 border-b border-gray-700 text-purple-400">自營商</th>
              <th className="px-4 py-3 border-b border-gray-700 text-gray-200">單日合計</th>
              <th className="px-4 py-3 border-b border-gray-700 text-amber-500">10日累計</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {displayData.map((row, i) => {
              const dailyTotal = row.foreignNet + row.trustNet + row.dealerNet;
              return (
                <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono">{row.date.slice(5)}</td>
                  <td className={`px-4 py-3 font-mono font-bold ${row.foreignNet > 0 ? 'text-red-400' : row.foreignNet < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {Math.round(row.foreignNet / 1000).toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 font-mono font-bold ${row.trustNet > 0 ? 'text-red-400' : row.trustNet < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {Math.round(row.trustNet / 1000).toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 font-mono font-bold ${row.dealerNet > 0 ? 'text-red-400' : row.dealerNet < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {Math.round(row.dealerNet / 1000).toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 font-mono font-bold ${dailyTotal > 0 ? 'text-red-400' : dailyTotal < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {Math.round(dailyTotal / 1000).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className={`flex items-center gap-1 font-mono font-black ${
                      row.total10DayNet > 0 ? 'text-red-500' : row.total10DayNet < 0 ? 'text-emerald-500' : 'text-gray-500'
                    }`}>
                      {formatVolume(row.total10DayNet)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
