import { StockData } from '../components/StockChart';
export type { StockData };
import { SMA, ATR } from 'technicalindicators';

export type StrategyType = 'MACD_BREAKOUT' | 'DUAL_MA' | 'RSI_OVERBOUGHT_OVERSOLD';

export interface StrategyConfig {
  strategyType: StrategyType;
  maPeriod: number;
  boxPeriod: number;
  stopLoss: number;
  takeProfit: number;
  useMacdEntry: boolean;
  useMacdExit: boolean;
  exitMaPeriod: number;
  // Chandelier Exit config
  atrPeriod: number;
  atrMultiplier: number;
  trailingStop?: number;
  // Dual MA config
  fastMaPeriod?: number;
  slowMaPeriod?: number;
  // RSI config
  rsiPeriod?: number;
  rsiOverbought?: number;
  rsiOversold?: number;
}


export interface TradeResult {
  buyDate: string;
  sellDate: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  percent: number;
}

export interface DiagnosisResult {
  markers: any[];
  trades: TradeResult[];
  finalCapital: number;
  currentStatus: {
    inPosition: boolean;
    buyPrice?: number;
    buyDate?: string;
    unrealizedProfit?: number;
    unrealizedPercent?: number;
  };
  advice: {
    action: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
    reason: string;
  };
  stats: {
    totalReturn: number;
    winRate: number;
    maxDrawdown: number;
    profitFactor: number;
    totalProfit: number;
    totalTrades: number;
    sharpeRatio?: number;
    equityCurve?: { time: string; value: number }[];
  };
}


export const generateSignals = (chartData: StockData[], config: StrategyConfig): DiagnosisResult => {
  const markers: any[] = [];
  const trades: TradeResult[] = [];
  
  if (chartData.length < Math.max(config.boxPeriod, config.slowMaPeriod || 0, config.rsiPeriod || 0, 60)) return { 
    markers, 
    trades, 
    finalCapital: 100000,
    currentStatus: { inPosition: false },
    advice: { action: 'WAIT' as const, reason: '資料不足，無法進行診斷。' },
    stats: {
      totalReturn: 0,
      winRate: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      totalProfit: 0,
      totalTrades: 0
    }
  };

  const closes = chartData.map(d => d.close);
  
  // Indicators
  const ma20 = SMA.calculate({ period: config.maPeriod || 20, values: closes });
  const fastMa = SMA.calculate({ period: config.fastMaPeriod || 10, values: closes });
  const slowMa = SMA.calculate({ period: config.slowMaPeriod || 20, values: closes });
  
  const highs = chartData.map(d => d.high);

  const lows = chartData.map(d => d.low);
  const atr = ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: config.atrPeriod || 14
  });
  
  const ma20Offset = chartData.length - ma20.length;
  const atrOffset = chartData.length - atr.length;

  let inPosition = false;
  let buyPrice = 0;
  let buyDate = '';
  let initialCapital = 100000;
  let currentCapital = initialCapital;
  let shares = 0;
  let highestPriceSinceEntry = 0;

  for (let i = 60; i < chartData.length; i++) {
    const current = chartData[i];
    const prev = chartData[i - 1];
    const prevPrev = chartData[i - 2];
    
    const ma20Val = i >= ma20Offset ? ma20[i - ma20Offset] : null;


    if (!inPosition) {
      let entrySignal = false;
      
      if (config.strategyType === 'MACD_BREAKOUT') {
        // 步驟一：尋找【進場基本訊號】 (滿足 A 或 B 其中一項即可)
        
        // 【訊號 A】動能與指標共振（抓起漲點）
        const macdDifPositive = current.macd !== null && current.macd > 0;
        const macdHistogramIncreasing = current.histogram !== null && prev.histogram !== null && current.histogram > prev.histogram;
        
        // KD 指標 在過去 3 日內發生黃金交叉，且今日仍維持 K > D
        let kdGoldenCrossRecent = false;
        for (let j = 0; j < 3; j++) {
          const kData = chartData[i - j];
          const prevKData = chartData[i - j - 1];
          if (kData && prevKData && kData.k !== null && kData.d !== null && prevKData.k !== null && prevKData.d !== null) {
            if (kData.k > kData.d && prevKData.k <= prevKData.d) {
              kdGoldenCrossRecent = true;
              break;
            }
          }
        }
        const kdMaintains = current.k !== null && current.d !== null && current.k > current.d;
        
        const signalA = macdDifPositive && macdHistogramIncreasing && kdGoldenCrossRecent && kdMaintains;

        // 【訊號 B】強勢區間突破（抓直接噴發）
        // 今日收盤價 > 過去 30 個交易日的最高價
        let highest30 = 0;
        for (let j = 1; j <= 30; j++) {
          if (i - j >= 0) {
            highest30 = Math.max(highest30, chartData[i - j].high);
          }
        }
        const signalB = current.close > highest30;

        const step1Passed = signalA || signalB;

        // 步驟二：檢查【防線過濾器】 (買進前必須兩項都過關)
        
        // 【爆量確認防假過】：今日成交總張數必須 > 過去 5 日平均成交量的 1.5 倍
        let sumVol5 = 0;
        for (let j = 1; j <= 5; j++) {
          if (i - j >= 0) {
            sumVol5 += chartData[i - j].volume;
          }
        }
        const avgVol5 = sumVol5 / 5;
        const volumeSurge = current.volume > avgVol5 * 1.5;

        // 【拒買避雷針防倒貨】：上影線長度 不允許超過今日總長度 (最高價 - 最低價) 的 30%
        const candleLength = current.high - current.low;
        const upperShadow = current.high - Math.max(current.open, current.close);
        const noLongUpperShadow = candleLength > 0 ? (upperShadow / candleLength) <= 0.3 : true;

        const step2Passed = volumeSurge && noLongUpperShadow;
                              
        if (step1Passed && step2Passed) {
          entrySignal = true;
        }
      }

      if (entrySignal) {

        inPosition = true;
        buyPrice = current.close;
        buyDate = current.time;
        shares = Math.floor(currentCapital / buyPrice);
        highestPriceSinceEntry = current.close;
        
        markers.push({
          time: current.time,
          position: 'belowBar',
          color: '#ef4444',
          shape: 'arrowUp',
          text: '進場',
        });
      }
    } else {
      let exitSignal = false;
      highestPriceSinceEntry = Math.max(highestPriceSinceEntry, current.close);

      if (config.strategyType === 'MACD_BREAKOUT') {
        // 【吊燈停損法】 (Chandelier Exit)
        // 出場條件：今日收盤價 跌破 (進場後最高價 - Multiplier * ATR)。
        const currentAtr = i >= atrOffset ? atr[i - atrOffset] : null;
        if (currentAtr !== null) {
          const chandelierThreshold = highestPriceSinceEntry - (config.atrMultiplier || 2.0) * currentAtr;
          if (current.close < chandelierThreshold) {
            exitSignal = true;
          }
        }
      }


      const stopLossTriggered = config.stopLoss > 0 && current.close <= buyPrice * (1 - config.stopLoss / 100);
      const takeProfitTriggered = config.takeProfit > 0 && current.close >= buyPrice * (1 + config.takeProfit / 100);
      const trailingStopTriggered = config.trailingStop && config.trailingStop > 0 && current.close <= highestPriceSinceEntry * (1 - config.trailingStop / 100);

      if (exitSignal || stopLossTriggered || takeProfitTriggered || trailingStopTriggered) {
        const sellPrice = current.close;
        const profit = (sellPrice - buyPrice) * shares;
        trades.push({
          buyDate,
          sellDate: current.time,
          buyPrice,
          sellPrice,
          profit,
          percent: ((sellPrice - buyPrice) / buyPrice) * 100
        });
        currentCapital += profit;
        shares = 0;
        inPosition = false;
        highestPriceSinceEntry = 0;
        
        let text = '出場';
        if (trailingStopTriggered) text = '移動停損';
        else if (stopLossTriggered) text = '停損';
        else if (takeProfitTriggered) text = '停利';
        
        markers.push({
          time: current.time,
          position: 'aboveBar',
          color: '#22c55e',
          shape: 'arrowDown',
          text,
        });
      }
    }
  }
  
  const lastData = chartData[chartData.length - 1];
  const prevData = chartData[chartData.length - 2];
  const prevPrevData = chartData[chartData.length - 3];

  let currentStatus = {
    inPosition,
    buyPrice: inPosition ? buyPrice : undefined,
    buyDate: inPosition ? buyDate : undefined,
    unrealizedProfit: inPosition ? (lastData.close - buyPrice) * shares : undefined,
    unrealizedPercent: inPosition ? ((lastData.close - buyPrice) / buyPrice) * 100 : undefined,
  };

  let adviceAction: 'BUY' | 'SELL' | 'HOLD' | 'WAIT' = 'WAIT';
  let adviceReason = '';

  const strategyNames = {
    'MACD_BREAKOUT': 'MACD + 箱型突破 + 吊燈停損',
  };

  if (inPosition) {
    adviceAction = 'HOLD';
    const currentAtr = (chartData.length - 1) >= atrOffset ? atr[chartData.length - 1 - atrOffset] : null;
    const chandelierPrice = currentAtr ? highestPriceSinceEntry - (config.atrMultiplier || 2.0) * currentAtr : 0;
    adviceReason = `目前持有部位 (成本: ${buyPrice.toFixed(2)})，基於吊燈停損機制 (門檻: ${chandelierPrice.toFixed(2)})，價格尚未跌破支撐，建議續抱。`;
    
    if (lastData.close <= chandelierPrice * 1.02) {
       adviceAction = 'SELL';
       adviceReason = `目前持有部位，但價格已極度接近吊燈停損點 (${chandelierPrice.toFixed(2)})，請注意趨勢反轉風險。`;
    }

  } else {
    adviceAction = 'WAIT';
    adviceReason = `目前空手，基於 ${strategyNames[config.strategyType]} 策略，尚未出現明確進場訊號，建議持續觀望。`;
    
    // Simple logic for advice based on strategy
    if (config.strategyType === 'MACD_BREAKOUT') {
      const macdDifPositive = lastData.macd !== null && lastData.macd > 0;
      const macdHistogramIncreasing = lastData.histogram !== null && prevData.histogram !== null && lastData.histogram > prevData.histogram;
      
      let kdGoldenCrossRecent = false;
      for (let j = 0; j < 3; j++) {
        const kData = chartData[chartData.length - 1 - j];
        const prevKData = chartData[chartData.length - 2 - j];
        if (kData && prevKData && kData.k !== null && kData.d !== null && prevKData.k !== null && prevKData.d !== null) {
          if (kData.k > kData.d && prevKData.k <= prevKData.d) {
            kdGoldenCrossRecent = true;
            break;
          }
        }
      }
      const kdMaintains = lastData.k !== null && lastData.d !== null && lastData.k > lastData.d;
      
      const signalA = macdDifPositive && macdHistogramIncreasing && kdGoldenCrossRecent && kdMaintains;

      let highest30 = 0;
      for (let j = 1; j <= 30; j++) {
        const idx = chartData.length - 1 - j;
        if (idx >= 0) {
          highest30 = Math.max(highest30, chartData[idx].high);
        }
      }
      const signalB = lastData.close > highest30;

      const step1Passed = signalA || signalB;

      let sumVol5 = 0;
      for (let j = 1; j <= 5; j++) {
        const idx = chartData.length - 1 - j;
        if (idx >= 0) {
          sumVol5 += chartData[idx].volume;
        }
      }
      const avgVol5 = sumVol5 / 5;
      const volumeSurge = lastData.volume > avgVol5 * 1.5;

      const candleLength = lastData.high - lastData.low;
      const upperShadow = lastData.high - Math.max(lastData.open, lastData.close);
      const noLongUpperShadow = candleLength > 0 ? (upperShadow / candleLength) <= 0.3 : true;

      const step2Passed = volumeSurge && noLongUpperShadow;
                            
      if (step1Passed && step2Passed) {
         adviceAction = 'BUY';
         adviceReason = `訊號轉強！符合進場基本訊號 (${signalA ? '動能與指標共振' : '強勢區間突破'}) 且通過防線過濾器 (爆量且無長上影線)，建議進場。`;
      } else if (step1Passed) {
         adviceReason = `目前空手，已出現進場基本訊號 (${signalA ? '動能與指標共振' : '強勢區間突破'})，但未通過防線過濾器 (需爆量且無長上影線)，建議持續觀望。`;
      }
    }
  }


  // Calculate stats
  const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
  const wins = trades.filter(t => t.profit > 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const totalReturn = ((currentCapital - 100000) / 100000) * 100;
  
  const grossProfit = trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0);
  const grossLoss = Math.abs(trades.filter(t => t.profit < 0).reduce((sum, t) => sum + t.profit, 0));
  const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

  // Max Drawdown and Equity Curve
  let maxEquity = 100000;
  let runningEquity = 100000;
  let maxDD = 0;
  const equityCurve: { time: string; value: number }[] = [{ time: chartData[0].time, value: 100000 }];
  
  // Create a daily equity curve for better visualization
  let currentPortfolioValue = 100000;
  let activeTrade: TradeResult | null = null;
  let tradeIndex = 0;
  
  for (let i = 1; i < chartData.length; i++) {
    const day = chartData[i];
    // Check if a trade started today
    const tradeStarted = trades.find(t => t.buyDate === day.time);
    const tradeEnded = trades.find(t => t.sellDate === day.time);
    
    if (tradeStarted) activeTrade = tradeStarted;
    
    if (activeTrade) {
      // Calculate daily value based on price change if in position
      const dayReturn = (day.close - chartData[i-1].close) / chartData[i-1].close;
      currentPortfolioValue = currentPortfolioValue * (1 + dayReturn);
    }
    
    equityCurve.push({ time: day.time, value: currentPortfolioValue });
    
    if (currentPortfolioValue > maxEquity) maxEquity = currentPortfolioValue;
    const dd = (maxEquity - currentPortfolioValue) / maxEquity;
    if (dd > maxDD) maxDD = dd;

    if (tradeEnded) activeTrade = null;
  }

  // Sharpe Ratio (simplified)
  const returns = equityCurve.map((d, i) => i > 0 ? (d.value - equityCurve[i-1].value) / equityCurve[i-1].value : 0).slice(1);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(returns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length);
  const sharpeRatio = stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(252);

  return { 
    markers, 
    trades, 
    finalCapital: currentCapital,
    currentStatus,
    advice: { action: adviceAction, reason: adviceReason },
    stats: {
      totalReturn,
      winRate,
      maxDrawdown: maxDD * 100,
      profitFactor,
      totalProfit,
      totalTrades: trades.length,
      sharpeRatio,
      equityCurve
    }
  };
};

