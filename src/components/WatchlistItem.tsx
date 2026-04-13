import React from 'react';
import { Star, Trash2, Loader2 } from 'lucide-react';

export default function WatchlistItem({ 
  symbol, 
  status, 
  hasCustomConfig,
  onClick, 
  onRemove 
}: { 
  symbol: string, 
  status?: string, 
  hasCustomConfig?: boolean,
  onClick: () => void, 
  onRemove: () => void 
}) {
  return (
    <div className="flex items-center justify-between bg-gray-800/50 p-4 rounded-xl border border-gray-700 hover:bg-gray-800 transition-colors group">
      <button onClick={onClick} className="flex-1 flex items-center gap-3 text-left">
        <div className="flex flex-col">
          <span className="font-bold text-white">{symbol}</span>
          {hasCustomConfig && (
            <span className="text-[9px] text-blue-400 font-bold uppercase tracking-tighter">自訂策略</span>
          )}
        </div>
        {status ? (
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            status === 'entry' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
            status === 'hold' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
            status === 'exit' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
            'bg-gray-700/30 text-gray-500 border border-gray-700/30'
          }`}>
            {status === 'entry' ? '進場' : 
             status === 'hold' ? '持有' : 
             status === 'exit' ? '出場' : '觀望'}
          </div>
        ) : (
          <Loader2 size={14} className="text-gray-500 animate-spin" />
        )}
      </button>
      <button onClick={onRemove} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
        <Trash2 size={18} />
      </button>
    </div>
  );
}
