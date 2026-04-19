import React, { useState } from 'react';
import { Play, TrendingUp, TrendingDown, Target, Activity, Loader2, ChevronRight, AlertCircle, Info, Settings, X } from 'lucide-react';
import { StrategyConfig } from '../utils/strategy';

interface BacktestResult {
  symbol: string;
  totalReturn: number;
  winRate: number;
  tradeCount: number;
  lastPrice: number;
  status: 'entry' | 'hold' | 'exit' | 'wait';
  trades: {
    entryDate: string;
    exitDate: string;
    entryPrice: number;
    exitPrice: number;
    profit: number;
    reason: string;
  }[];
}

const TAIWAN_STOCKS = [
  // 核心權值股 & 熱門半導體/電子
  '2330.TW', '2317.TW', '2454.TW', '2308.TW', '2382.TW', '3711.TW', '2303.TW', '2412.TW', 
  '2345.TW', '3037.TW', '3017.TW', '2360.TW', '7769.TW', '6669.TW', '2408.TW', '2327.TW', 
  '3231.TW', '2357.TW', '2379.TW', '3034.TW', '2301.TW', '2395.TW', '3008.TW', '2376.TW', 
  '3661.TW', '3443.TW', '5269.TW', '3533.TW', '6415.TW', '4938.TW', '2356.TW', '2385.TW', 
  '3702.TW', '2324.TW', '3036.TW', '2474.TW', '2377.TW', '2353.TW', '2383.TW', '2449.TW', 
  '8046.TW', '3653.TW', '2368.TW', '2059.TW', '4958.TW', '2344.TW', '3044.TW', '6239.TW',
  '3532.TW', '6409.TW', '8210.TW', '6206.TW', '2313.TW', '3013.TW', '3324.TW',

  // 金融股 (含金控與銀行)
  '2881.TW', '2882.TW', '2891.TW', '2886.TW', '2884.TW', '2885.TW', '5880.TW', '2892.TW', 
  '2880.TW', '2883.TW', '2887.TW', '2890.TW', '5871.TW', '5876.TW', '2801.TW', '2834.TW', 
  '2812.TW', '2845.TW', '2855.TW', '6005.TW', '5878.TW',

  // 傳產、能源與航運 (含台塑四寶、重電、鋼鐵)
  '1301.TW', '1303.TW', '1326.TW', '6505.TW', '1216.TW', '2002.TW', '2603.TW', '2609.TW', 
  '2615.TW', '2618.TW', '2610.TW', '1101.TW', '1102.TW', '2105.TW', '1513.TW', '1519.TW', 
  '1503.TW', '1605.TW', '1504.TW', '2027.TW', '1402.TW', '1476.TW', '9910.TW', '2207.TW', 
  '2912.TW', '3045.TW', '4904.TW', '9904.TW', '9921.TW', '9945.TW', '2707.TW', '1795.TW', 
  '6472.TW', '1707.TW', '6508.TW', '5522.TW', '2542.TW', '1802.TW', '1229.TW', '1210.TW',

  // 補足至 150 檔之其他重要標的 (中大型成長與觀察股)
  '6770.TW', '6719.TW', '6805.TW', '6874.TW', '8996.TW', '3583.TW', '3131.TW', '3588.TW',
  '2480.TW', '3023.TW', '2451.TW', '6213.TW', '2354.TW', '4961.TW', '5274.TW', '6414.TW',
  '3406.TW', '3596.TW', '4919.TW', '6176.TW', '2458.TW', '3211.TW', '8299.TW', '6223.TW',
  '3014.TW', '3035.TW', '3105.TW', '6147.TW', '6182.TW', '6282.TW', '8069.TW',

  // 熱門 ETF (資產配置與避風港)
  '0050.TW', '0056.TW', '00878.TW', '00919.TW', '00929.TW', '00713.TW', '0052.TW', '006208.TW'
];

export default function AIStockPicker({ onSelectSymbol }: { onSelectSymbol: (s: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showStrategySettings, setShowStrategySettings] = useState(false);
  const [strategyConfig, setStrategyConfig] = useState<StrategyConfig>({
    strategyType: 'MACD_BREAKOUT',
    maPeriod: 20,
    boxPeriod: 30,
    stopLoss: 5,
    takeProfit: 0,
    useMacdEntry: true,
    useMacdExit: true,
    exitMaPeriod: 10,
    atrPeriod: 14,
    atrMultiplier: 2.0,
    fastMaPeriod: 10,
    slowMaPeriod: 20,
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    trailingStop: 0,
  });

  const runBacktest = async (symbols: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/backtest?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols, config: strategyConfig })
      });
      
      if (!response.ok) throw new Error('掃描失敗');
      
      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || '發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const runScan = () => runBacktest(TAIWAN_STOCKS);

  return (
    <div className="space-y-6">
      {/* Strategy Card */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
              <Target className="text-blue-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">AI 技術策略選股</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-400">
                  {strategyConfig.strategyType === 'MACD_BREAKOUT' && 'MACD 轉強 + MA + 箱型突破'}
                  {strategyConfig.strategyType === 'DUAL_MA' && '雙均線黃金交叉'}
                  {strategyConfig.strategyType === 'RSI_OVERBOUGHT_OVERSOLD' && 'RSI 超買超賣'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowStrategySettings(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition-all active:scale-95"
            >
              <Settings size={18} />
              策略設定
            </button>
            <button
              onClick={runScan}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
              {loading ? '正在掃描台股...' : '開始全台股掃描'}
            </button>
          </div>
        </div>
      </div>

      {/* Strategy Settings Modal */}
      {showStrategySettings && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings size={20} className="text-blue-400" />
                選股策略參數設定
              </h3>
              <button onClick={() => setShowStrategySettings(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">選擇策略</label>
                <select 
                  value={strategyConfig.strategyType}
                  onChange={(e) => setStrategyConfig({...strategyConfig, strategyType: e.target.value as any})}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MACD_BREAKOUT">MACD + MA + 箱型突破</option>
                  <option value="DUAL_MA">雙均線黃金交叉</option>
                  <option value="RSI_OVERBOUGHT_OVERSOLD">RSI 超買超賣</option>
                </select>
              </div>

              {strategyConfig.strategyType === 'MACD_BREAKOUT' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">MA 週期</label>
                      <input 
                        type="number" 
                        value={Number.isNaN(strategyConfig.maPeriod) ? '' : strategyConfig.maPeriod}
                        onChange={(e) => setStrategyConfig({...strategyConfig, maPeriod: parseInt(e.target.value)})}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">箱型週期</label>
                      <input 
                        type="number" 
                        value={Number.isNaN(strategyConfig.boxPeriod) ? '' : strategyConfig.boxPeriod}
                        onChange={(e) => setStrategyConfig({...strategyConfig, boxPeriod: parseInt(e.target.value)})}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input 
                        type="checkbox" 
                        checked={strategyConfig.useMacdEntry}
                        onChange={(e) => setStrategyConfig({...strategyConfig, useMacdEntry: e.target.checked})}
                        className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
                      />
                      使用 MACD 進場濾網
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input 
                        type="checkbox" 
                        checked={strategyConfig.useMacdExit}
                        onChange={(e) => setStrategyConfig({...strategyConfig, useMacdExit: e.target.checked})}
                        className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
                      />
                      使用 MACD/KD 出場
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">出場 MA 週期 (跌破出場)</label>
                    <input 
                      type="number" 
                      value={Number.isNaN(strategyConfig.exitMaPeriod) ? '' : strategyConfig.exitMaPeriod}
                      onChange={(e) => setStrategyConfig({...strategyConfig, exitMaPeriod: parseInt(e.target.value)})}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
              )}

              {strategyConfig.strategyType === 'DUAL_MA' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">短均線週期</label>
                    <input 
                      type="number" 
                      value={Number.isNaN(strategyConfig.fastMaPeriod) ? '' : strategyConfig.fastMaPeriod}
                      onChange={(e) => setStrategyConfig({...strategyConfig, fastMaPeriod: parseInt(e.target.value)})}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">長均線週期</label>
                    <input 
                      type="number" 
                      value={Number.isNaN(strategyConfig.slowMaPeriod) ? '' : strategyConfig.slowMaPeriod}
                      onChange={(e) => setStrategyConfig({...strategyConfig, slowMaPeriod: parseInt(e.target.value)})}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
              )}

              {strategyConfig.strategyType === 'RSI_OVERBOUGHT_OVERSOLD' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">RSI 週期</label>
                    <input 
                      type="number" 
                      value={Number.isNaN(strategyConfig.rsiPeriod) ? '' : strategyConfig.rsiPeriod}
                      onChange={(e) => setStrategyConfig({...strategyConfig, rsiPeriod: parseInt(e.target.value)})}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">超買基準</label>
                      <input 
                        type="number" 
                        value={Number.isNaN(strategyConfig.rsiOverbought) ? '' : strategyConfig.rsiOverbought}
                        onChange={(e) => setStrategyConfig({...strategyConfig, rsiOverbought: parseInt(e.target.value)})}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">超賣基準</label>
                      <input 
                        type="number" 
                        value={Number.isNaN(strategyConfig.rsiOversold) ? '' : strategyConfig.rsiOversold}
                        onChange={(e) => setStrategyConfig({...strategyConfig, rsiOversold: parseInt(e.target.value)})}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-800 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">停損 (%)</label>
                    <input 
                      type="number" 
                      value={Number.isNaN(strategyConfig.stopLoss) ? '' : strategyConfig.stopLoss}
                      onChange={(e) => setStrategyConfig({...strategyConfig, stopLoss: parseFloat(e.target.value)})}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">停利 (%)</label>
                    <input 
                      type="number" 
                      value={Number.isNaN(strategyConfig.takeProfit) ? '' : strategyConfig.takeProfit}
                      onChange={(e) => setStrategyConfig({...strategyConfig, takeProfit: parseFloat(e.target.value)})}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">移動停損 (%)</label>
                    <input 
                      type="number" 
                      value={Number.isNaN(strategyConfig.trailingStop) ? '' : (strategyConfig.trailingStop || 0)}
                      onChange={(e) => setStrategyConfig({...strategyConfig, trailingStop: parseFloat(e.target.value)})}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowStrategySettings(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
              >
                確認並套用
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-800/20 rounded-2xl border border-gray-800">
            <Loader2 size={48} className="text-blue-500 animate-spin mb-4" />
            <p className="text-gray-400 font-medium">正在分析 50+ 檔台股權值股與 ETF...</p>
            <p className="text-xs text-gray-600 mt-2">這可能需要 10-20 秒，請稍候</p>
          </div>
        ) : error ? (
          <div className="p-8 bg-red-500/5 border border-red-500/20 rounded-2xl text-center">
            <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
            <p className="text-red-400 font-bold">{error}</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity size={20} className="text-blue-400" />
                掃描結果 (依總報酬率排序)
              </h3>
              <span className="text-xs text-gray-500">共發現 {results.length} 檔符合條件</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {results.map((res, idx) => (
                <div
                  key={res.symbol}
                  onClick={() => onSelectSymbol(res.symbol)}
                  className="group bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 hover:border-blue-500/50 rounded-2xl p-4 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center border border-gray-700 group-hover:border-blue-500/30 transition-colors">
                      <span className="text-blue-400 font-black">{res.symbol.split('.')[0]}</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{res.symbol}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          res.status === 'entry' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          res.status === 'hold' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          res.status === 'exit' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          'bg-gray-700/30 text-gray-500 border border-gray-700/30'
                        }`}>
                          {res.status === 'entry' ? '進場' : 
                           res.status === 'hold' ? '持有' : 
                           res.status === 'exit' ? '退場' : '觀望'}
                        </div>
                        <span className="text-xs text-gray-500">交易次數: <span className="text-gray-300">{res.tradeCount}</span></span>
                        <span className="text-xs text-gray-500">勝率: <span className={res.winRate >= 50 ? 'text-green-400' : 'text-red-400'}>{res.winRate.toFixed(1)}%</span></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">總報酬率</p>
                      <p className={`text-xl font-black font-mono ${res.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {res.totalReturn >= 0 ? '+' : ''}{res.totalReturn.toFixed(2)}%
                      </p>
                    </div>
                    <ChevronRight className="text-gray-600 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-800/20 rounded-2xl border border-gray-800 text-center px-6">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 border border-gray-700">
              <Info className="text-gray-500" size={32} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">尚未開始掃描</h3>
            <p className="text-sm text-gray-500 max-w-xs">點擊上方按鈕，利用 AI 策略在台灣上市櫃股票及 ETF 中尋找高勝率標的。</p>
          </div>
        )}
      </div>
    </div>
  );
}
