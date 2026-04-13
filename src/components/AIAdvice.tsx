import React, { useState, useEffect } from 'react';
import { FundamentalData } from './FundamentalAnalysis';
import { StockData, DiagnosisResult, generateSignals, StrategyConfig } from '../utils/strategy';
import { generateLocalAdvice } from '../utils/diagnosis';
import { Sparkles, BrainCircuit, AlertCircle, Info, Calculator } from 'lucide-react';
import Markdown from 'react-markdown';

interface AIAdviceProps {
  symbol: string;
  technicalData: StockData[];
  fundamentals: FundamentalData | null;
  support: number | null;
  resistance: number | null;
}

const AIAdvice: React.FC<AIAdviceProps> = ({ symbol, technicalData, fundamentals, support, resistance }) => {
  const [advice, setAdvice] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchAdvice = async () => {
      if (!symbol || technicalData.length < 60) return;
      setLoading(true);
      try {
        // Default strategy config for general advice
        const config: StrategyConfig = {
          strategyType: 'MACD_BREAKOUT',
          maPeriod: 20,
          boxPeriod: 30,
          stopLoss: 5,
          takeProfit: 0,
          useMacdEntry: true,
          useMacdExit: true,
          exitMaPeriod: 20,
          atrPeriod: 14,
          atrMultiplier: 2.0,
        };


        const result = generateSignals(technicalData, config);
        const localAdvice = generateLocalAdvice(symbol, technicalData, result, config, fundamentals);
        
        setAdvice(localAdvice);
      } catch (error) {
        console.error('Local Advice error:', error);
        setAdvice('診斷引擎發生錯誤，請稍後再試。');
      } finally {
        setLoading(false);
      }
    };

    fetchAdvice();
  }, [symbol, technicalData, fundamentals]);


  return (
    <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-stone-800 flex items-center space-x-2">
          <BrainCircuit className="w-5 h-5 text-purple-500" />
          <span>Gemini AI 策略深度診斷</span>
        </h3>
        <div className="flex items-center space-x-2 px-3 py-1 bg-purple-50 rounded-full">
          <Sparkles className="w-3 h-3 text-purple-600" />
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-widest">AI Powered</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-stone-500 font-medium animate-pulse">AI 正在分析市場數據與策略成效...</p>
        </div>
      ) : (
        <div className="prose prose-stone max-w-none">
          <div className="bg-stone-50 p-6 rounded-xl border border-stone-100 leading-relaxed text-stone-700 text-sm">
            <Markdown>{advice}</Markdown>
          </div>
        </div>
      )}

      <div className="flex items-center space-x-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <p className="text-[11px] text-amber-700 font-medium">
          免責聲明：AI 建議僅供參考，不構成投資建議。投資有風險，入市需謹慎。
        </p>
      </div>
    </div>
  );
};

export default AIAdvice;
