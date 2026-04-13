import React, { useState, useEffect } from 'react';
import { InstitutionalData } from '../types';
import InstitutionalChart from './InstitutionalChart';
import InstitutionalTable from './InstitutionalTable';
import { Loader2, AlertCircle, Database, RefreshCcw } from 'lucide-react';

interface InstitutionalPanelProps {
  symbol: string;
}

export default function InstitutionalPanel({ symbol }: InstitutionalPanelProps) {
  const [data, setData] = useState<InstitutionalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 30 });
  const [status, setStatus] = useState<'loading' | 'completed' | 'idle'>('idle');

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/stock/${symbol}/institutional`);
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error || '獲取法人數據失敗');

      setData(result.data || []);
      setStatus(result.status);
      
      if (result.status === 'loading') {
        setProgress({ 
          current: result.progress || result.data?.length || 0, 
          total: result.total || 30 
        });
        // Poll again in 3 seconds if still loading
        setTimeout(fetchData, 3000);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchData();
  }, [symbol]);

  if (loading && status !== 'loading') {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-gray-800/30 rounded-2xl border border-gray-800">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-400 font-medium whitespace-nowrap">正在準備法人成交數據...</p>
      </div>
    );
  }

  if (status === 'loading') {
    const percent = Math.round((progress.current / progress.total) * 100);
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-gray-800/30 rounded-2xl border border-gray-800 space-y-6">
        <div className="relative">
          <RefreshCcw className="w-16 h-16 text-blue-500/20 animate-spin-reverse absolute inset-0" style={{ animationDuration: '3s' }} />
          <Database className="w-16 h-16 text-blue-500 animate-pulse relative z-10" />
        </div>
        <div className="text-center space-y-2">
          <h4 className="text-xl font-black text-white tracking-tight">正在抓取證交所歷史數據</h4>
          <p className="text-sm text-gray-500 max-w-xs">
            由於證交所 API 限制，抓取 30 天數據需要一些時間。
            此數據只需抓取一次即可存入快取。
          </p>
        </div>
        <div className="w-full max-w-md bg-gray-700 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-blue-500 h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex justify-between w-full max-w-md text-xs font-mono text-gray-500">
          <span>進度：{percent}%</span>
          <span>{progress.current} / {progress.total} 天</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-gray-800/30 rounded-2xl border border-red-900/30 text-red-400">
        <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
        <p className="font-bold">{error}</p>
        <button 
          onClick={() => { setLoading(true); fetchData(); }}
          className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-white transition-colors"
        >
          重試
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-gray-800/30 rounded-2xl border border-gray-800">
        <p className="text-gray-500">暫無該股票的法人成交數據</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <InstitutionalChart data={data} />
      <InstitutionalTable data={data} />
    </div>
  );
}
