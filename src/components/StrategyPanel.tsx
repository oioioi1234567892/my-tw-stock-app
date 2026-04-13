import React from 'react';
import { StrategyConfig, StrategyType } from '../utils/strategy';
import { Settings, Sliders, Target, ShieldCheck } from 'lucide-react';

interface StrategyPanelProps {
  config: StrategyConfig;
  onChange: (config: StrategyConfig) => void;
}

const StrategyPanel: React.FC<StrategyPanelProps> = ({ config, onChange }) => {
  const handleChange = (key: keyof StrategyConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const strategies: { value: StrategyType; label: string }[] = [
    { value: 'MACD_BREAKOUT', label: 'MACD 強勢突破' },
    { value: 'DUAL_MA', label: '雙均線黃金交叉' },
    { value: 'RSI_OVERBOUGHT_OVERSOLD', label: 'RSI 超買超賣' }
  ];

  return (
    <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-6 backdrop-blur-md shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Settings size={20} className="text-blue-400" />
        </div>
        <h3 className="text-lg font-bold text-white">策略配置與回測參數</h3>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Main Parameters */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-400 uppercase">移動平均週期 (MA)</label>
                <span className="text-blue-400 font-mono font-bold text-xs">{config.maPeriod} 日</span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={config.maPeriod}
                onChange={(e) => handleChange('maPeriod', parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-400 uppercase">區間突破週期</label>
                <span className="text-blue-400 font-mono font-bold text-xs">{config.boxPeriod} 日</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={config.boxPeriod}
                onChange={(e) => handleChange('boxPeriod', parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          {/* ATR / Chandelier Exit Parameters */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-400 uppercase">ATR 週期 (吊燈停損)</label>
                <span className="text-purple-400 font-mono font-bold text-xs">{config.atrPeriod} 日</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="1"
                value={config.atrPeriod}
                onChange={(e) => handleChange('atrPeriod', parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-400 uppercase">ATR 乘數 (Chandelier Factor)</label>
                <span className="text-purple-400 font-mono font-bold text-xs">{config.atrMultiplier?.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.1"
                value={config.atrMultiplier}
                onChange={(e) => handleChange('atrMultiplier', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Risk Management & Entry confirmation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-700">
           <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-400 uppercase">基礎停損比例 (%)</label>
                <span className="text-red-400 font-mono font-bold text-xs">{config.stopLoss}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="0.5"
                value={config.stopLoss}
                onChange={(e) => handleChange('stopLoss', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
          </div>

          <div className="flex items-center">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-10 h-6 flex items-center rounded-full transition-colors ${config.useMacdEntry ? 'bg-blue-600' : 'bg-gray-700'}`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${config.useMacdEntry ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={config.useMacdEntry} 
                onChange={(e) => handleChange('useMacdEntry', e.target.checked)} 
              />
              <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">使用 MACD 訊號過濾進場</span>
            </label>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StrategyPanel;
