import React from 'react';

export default function NewsAnalysis({ symbol }: { symbol: string }) {
  return (
    <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
      <h3 className="text-xl font-bold text-white mb-4">{symbol} 相關新聞</h3>
      <p className="text-gray-400">目前暫無新聞數據。</p>
    </div>
  );
}
