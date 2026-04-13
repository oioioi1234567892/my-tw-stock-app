import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, AlertCircle, Loader2, BarChart2, Info, Newspaper, Star, Trash2, ChevronRight, FileText } from 'lucide-react';
import StockChart, { StockData } from './components/StockChart';
import MarginChart from './components/MarginChart';
import FundamentalAnalysis, { FundamentalData } from './components/FundamentalAnalysis';
import AIStockPicker from './components/AIStockPicker';
import WatchlistItem from './components/WatchlistItem';
import { MessageSquare, Activity, Target } from 'lucide-react';
import { translateToChinese } from './utils/translate';
import { StrategyConfig } from './utils/strategy';
import InstitutionalPanel from './components/InstitutionalPanel';
import { Users2 } from 'lucide-react';

export default function App() {
  const [symbol, setSymbol] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [fundamentals, setFundamentals] = useState<FundamentalData | null>(null);
  const [support, setSupport] = useState<number | null>(null);
  const [resistance, setResistance] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'technical' | 'fundamental' | 'financial' | 'institutional' | 'advice' | 'picker'>('picker');
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('stock_watchlist');
    return saved ? JSON.parse(saved) : [];
  });
  const [strategyConfigs, setStrategyConfigs] = useState<Record<string, StrategyConfig>>(() => {
    const saved = localStorage.getItem('stock_strategy_configs');
    return saved ? JSON.parse(saved) : {};
  });
  const [watchlistStatus, setWatchlistStatus] = useState<Record<string, string>>({});
  const [isStatusLoading, setIsStatusLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('stock_watchlist', JSON.stringify(watchlist));
    localStorage.setItem('stock_strategy_configs', JSON.stringify(strategyConfigs));
    
    // Fetch status for watchlist items
    if (watchlist.length > 0) {
      setIsStatusLoading(true);
      // Clear current status for the symbols being updated to show loaders
      setWatchlistStatus(prev => {
        const next = { ...prev };
        watchlist.forEach(s => delete next[s]);
        return next;
      });

      fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbols: watchlist,
          configs: strategyConfigs 
        })
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const newStatus: Record<string, string> = {};
          data.forEach(item => {
            newStatus[item.symbol] = item.status;
          });
          setWatchlistStatus(newStatus);
        }
      })
      .catch(err => console.error('Failed to fetch watchlist status:', err))
      .finally(() => setIsStatusLoading(false));
    } else {
      setWatchlistStatus({});
      setIsStatusLoading(false);
    }
  }, [watchlist, strategyConfigs]);

  const toggleWatchlist = (s: string) => {
    setWatchlist(prev => 
      prev.includes(s) ? prev.filter(item => item !== s) : [...prev, s]
    );
  };

  const fetchStockData = async (ticker: string) => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stock/${ticker}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '獲取股票數據失敗，請檢查代碼是否正確。');
      }
      setStockData(result.data);
      setSupport(result.support);
      setResistance(result.resistance);
      setFundamentals(result.fundamentals);
    } catch (err: any) {
      setError(err.message || '發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (symbol) {
      fetchStockData(symbol);
    }
  }, [symbol]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchInput.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await fetch(`/api/search/${encodeURIComponent(searchInput)}`);
        if (response.ok) {
          const data = await response.json();
          // Translate suggestions (limit to top 5 to avoid rate limits)
          const translatedSuggestions = await Promise.all(data.slice(0, 5).map(async (s: any) => ({
            ...s,
            longname: await translateToChinese(s.longname || s.shortname || s.symbol)
          })));
          setSuggestions(translatedSuggestions);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSymbol(searchInput.trim().toUpperCase());
      setShowSuggestions(false);
      setActiveTab('technical');
    }
  };

  const selectSuggestion = (suggestion: any) => {
    setSymbol(suggestion.symbol);
    setSearchInput(suggestion.symbol);
    setShowSuggestions(false);
    setActiveTab('technical');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-1 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-2 md:space-y-6">
        
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 md:gap-4">
          <div 
            className="flex items-center gap-2 md:gap-3 cursor-pointer group"
            onClick={() => {
              setSymbol('');
              setSearchInput('');
              setActiveTab('technical');
            }}
          >
            <div className="p-1.5 md:p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20 group-hover:scale-110 transition-transform">
              <TrendingUp size={18} className="text-white md:w-6 md:h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black text-white tracking-tighter">台股 AI 選股大師</h1>
              <p className="text-[9px] md:text-sm text-gray-400">技術策略、大數據回測與 AI 投資建議</p>
            </div>
          </div>

          <div className="relative w-full lg:w-96">
            <form onSubmit={handleSearch}>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="輸入名稱或代碼 (例如：2330, AAPL)"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 md:py-2.5 pl-10 pr-4 text-sm md:text-base text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </form>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectSuggestion(s)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-700 active:bg-gray-600 border-b border-gray-700 last:border-0 flex flex-col transition-colors"
                  >
                    <span className="font-bold text-white text-sm">{s.symbol}</span>
                    <span className="text-xs text-gray-400 truncate">{s.shortname || s.longname}</span>
                  </button>
                ))}
              </div>
            )}
            
            {showSuggestions && searchInput.length >= 2 && suggestions.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl p-4 z-50 text-center text-xs text-gray-500">
                未找到匹配的股票
              </div>
            )}
          </div>
        </header>

        {/* Watchlist Quick Access Bar */}
        {symbol && watchlist.length > 0 && (
          <div className="w-full max-w-full overflow-hidden">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 w-full">
              <div className="flex-shrink-0 p-1.5 bg-gray-800 rounded-lg border border-gray-700">
                <Star size={14} className="text-yellow-500" fill="currentColor" />
              </div>
              <div className="flex gap-2 min-w-0">
                {watchlist.map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      setSymbol(s);
                      setSearchInput(s);
                      setActiveTab('technical');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-2 ${
                      symbol === s 
                        ? 'bg-blue-600 border-blue-500 text-white' 
                        : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      watchlistStatus[s] === 'entry' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                      watchlistStatus[s] === 'hold' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' :
                      watchlistStatus[s] === 'exit' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                      'bg-gray-600'
                    }`} />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px] md:h-[600px] bg-gray-800/30 rounded-2xl border border-gray-800 backdrop-blur-sm">
              <Loader2 size={40} className="text-blue-500 animate-spin mb-4" />
              <p className="text-xs md:text-sm text-gray-400 font-medium">正在加載 {symbol} 的市場數據...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-[400px] md:h-[600px] bg-gray-800/30 rounded-2xl border border-red-900/30 text-red-400 backdrop-blur-sm p-6 text-center">
              <AlertCircle size={40} className="mb-4 text-red-500" />
              <p className="text-base md:text-lg font-bold">{error}</p>
              <p className="text-xs text-gray-500 mt-2">請嘗試其他代碼，例如 2330.TW 或 AAPL</p>
            </div>
          ) : !symbol && activeTab !== 'picker' ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] md:h-[600px] bg-gray-800/30 rounded-2xl border border-gray-800 backdrop-blur-sm text-center p-6 md:p-8">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600/20 rounded-full flex items-center justify-center mb-4 md:mb-6 border border-blue-500/20">
                <TrendingUp size={30} className="text-blue-500 md:w-10 md:h-10" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white mb-3 md:mb-4 tracking-tighter">歡迎使用台股 AI 選股大師</h2>

              <div className="mt-6 md:mt-10 flex justify-center w-full max-w-sm mx-auto">
                <button 
                  onClick={() => setActiveTab('picker')}
                  className="w-full p-4 md:p-6 bg-blue-600/20 rounded-2xl border border-blue-500/30 hover:bg-blue-600/30 transition-all text-center group"
                >
                  <Target className="text-blue-400 mb-2 md:mb-3 mx-auto group-hover:scale-110 transition-transform" size={28} />
                  <h3 className="text-sm md:text-base font-bold text-white">啟動 AI 選股</h3>
                  <p className="text-xs text-gray-500 mt-1">掃描台股高勝率標的</p>
                </button>
              </div>

              {/* Watchlist Section */}
              {watchlist.length > 0 && (
                <div className="mt-8 md:mt-12 w-full max-w-2xl mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Star size={20} className="text-yellow-500" fill="currentColor" />
                      我的關注清單
                    </h3>
                    <span className="text-xs text-gray-500">{watchlist.length} 檔股票</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {watchlist.map(s => (
                      <WatchlistItem
                        key={s}
                        symbol={s}
                        status={watchlistStatus[s]}
                        hasCustomConfig={!!strategyConfigs[s]}
                        onClick={() => {
                          setSymbol(s);
                          setSearchInput(s);
                          setActiveTab('technical');
                        }}
                        onRemove={() => toggleWatchlist(s)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 md:space-y-6">
              {/* Summary Bar - Only if we have a symbol and data */}
              {symbol && stockData.length > 0 && (
                <div className="flex flex-col md:flex-row md:items-center justify-between bg-gray-800/50 p-2 md:p-6 rounded-2xl border border-gray-800 backdrop-blur-sm gap-2 md:gap-6">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-12 md:h-12 bg-blue-600/10 rounded-full flex items-center justify-center border border-blue-500/20">
                      <span className="text-blue-400 font-bold text-sm md:text-lg">{symbol[0]}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg md:text-2xl font-black text-white tracking-tighter">{symbol}</h2>
                        <button 
                          onClick={() => toggleWatchlist(symbol)}
                          className={`p-1 rounded-full transition-colors ${
                            watchlist.includes(symbol) ? 'text-yellow-500' : 'text-gray-600 hover:text-gray-400'
                          }`}
                        >
                          <Star size={20} fill={watchlist.includes(symbol) ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <p className="text-[10px] md:text-sm text-gray-400">
                        最新收盤：<span className="text-white font-mono font-bold">{stockData[stockData.length - 1].close.toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-3 md:gap-8 text-sm">
                    <div className="flex flex-col">
                      <span className="text-gray-500 text-[8px] md:text-[10px] uppercase tracking-widest mb-0.5 md:mb-1">30日壓力</span>
                      <span className="text-amber-500 font-mono text-sm md:text-lg font-bold">{resistance?.toFixed(2) || '---'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-500 text-[8px] md:text-[10px] uppercase tracking-widest mb-0.5 md:mb-1">30日支撐</span>
                      <span className="text-blue-500 font-mono text-sm md:text-lg font-bold">{support?.toFixed(2) || '---'}</span>
                    </div>
                    {fundamentals?.peRatio && (
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-[8px] md:text-[10px] uppercase tracking-widest mb-0.5 md:mb-1">本益比</span>
                        <span className="text-purple-400 font-mono text-sm md:text-lg font-bold">{fundamentals.peRatio.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex overflow-x-auto scrollbar-hide p-1.5 bg-gray-800/50 rounded-xl border border-gray-800 w-full md:w-fit gap-1 no-scrollbar">
                {symbol && stockData.length > 0 && (
                  <>
                    <button
                      onClick={() => setActiveTab('technical')}
                      className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none active:scale-95 ${
                        activeTab === 'technical' 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <BarChart2 size={14} className="md:w-4 md:h-4" />
                      技術
                    </button>
                    <button
                      onClick={() => setActiveTab('fundamental')}
                      className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none active:scale-95 ${
                        activeTab === 'fundamental' 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <Info size={14} className="md:w-4 md:h-4" />
                      基本面
                    </button>
                    <button
                      onClick={() => setActiveTab('financial')}
                      className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none active:scale-95 ${
                        activeTab === 'financial' 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <FileText size={14} className="md:w-4 md:h-4" />
                      財報
                    </button>
                    <button
                      onClick={() => setActiveTab('institutional')}
                      className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none active:scale-95 ${
                        activeTab === 'institutional' 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <Users2 size={14} className="md:w-4 md:h-4" />
                      法人
                    </button>
                  </>
                )}
                <button
                  onClick={() => setActiveTab('picker')}
                  className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none active:scale-95 ${
                    activeTab === 'picker' 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Target size={14} className="md:w-4 md:h-4" />
                  AI 選股
                </button>
              </div>
              
              {/* Tab Content */}
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'picker' ? (
                  <AIStockPicker onSelectSymbol={(s) => {
                    setSymbol(s);
                    setSearchInput(s);
                    setActiveTab('technical');
                  }} />
                ) : activeTab === 'technical' ? (
                  <StockChart 
                    data={stockData} 
                    support={support} 
                    resistance={resistance} 
                    symbol={symbol}
                    onConfigChange={(config) => {
                      setStrategyConfigs(prev => ({
                        ...prev,
                        [symbol]: config
                      }));
                    }}
                  />
                ) : activeTab === 'fundamental' ? (
                  fundamentals ? (
                    <FundamentalAnalysis data={fundamentals} />
                  ) : (
                    <div className="bg-gray-800/30 border border-gray-800 p-12 rounded-2xl text-center">
                      <AlertCircle className="mx-auto text-gray-600 mb-4" size={48} />
                      <p className="text-gray-500 font-medium">暫無該股票的基本面數據</p>
                    </div>
                  )
                ) : activeTab === 'financial' ? (
                  fundamentals?.marginHistory ? (
                    <MarginChart data={fundamentals.marginHistory} />
                  ) : (
                    <div className="bg-gray-800/30 border border-gray-800 p-12 rounded-2xl text-center">
                      <AlertCircle className="mx-auto text-gray-600 mb-4" size={48} />
                      <p className="text-gray-500 font-medium">暫無年度/季度財務三率數據</p>
                    </div>
                  )
                ) : activeTab === 'institutional' ? (
                  <InstitutionalPanel symbol={symbol} />
                ) : null}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}



