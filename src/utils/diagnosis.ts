import { StockData, DiagnosisResult, StrategyConfig } from './strategy';

export const generateLocalAdvice = (
  symbol: string,
  data: StockData[],
  result: DiagnosisResult,
  config: StrategyConfig,
  fundamentals: any | null
) => {
  if (data.length < 2) return "資料不足，無法進行診斷。";

  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const stats = result.stats;
  const currentPrice = last.close;
  const priceChange = ((currentPrice - prev.close) / prev.close) * 100;

  let advice = `### 🔍 ${symbol} 診斷報告 (由在地化引擎產出)\n\n`;

  // 1. 技術面走勢
  advice += `#### 📈 技術分析\n`;
  if (priceChange > 0) {
    advice += `- **今日走勢**：股價表現強勢，單日上漲 ${priceChange.toFixed(2)}%。\n`;
  } else {
    advice += `- **今日走勢**：股價回落，單日跌幅 ${Math.abs(priceChange).toFixed(2)}%。\n`;
  }

  const ma20 = data.slice(-20).reduce((a, b) => a + b.close, 0) / 20;
  if (currentPrice > ma20) {
    advice += `- **趨勢判斷**：目前站穩 20 日均線 (${ma20.toFixed(2)}) 之上，屬於短中期偏多格局。\n`;
  } else {
    advice += `- **趨勢判斷**：股價低於 20 日均線 (${ma20.toFixed(2)})，短期動能偏弱，需警惕回檔。\n`;
  }

  if (last.volume > (data.slice(-6, -1).reduce((a, b) => a + b.volume, 0) / 5) * 1.5) {
    advice += `- **成交量**：成交量有明顯異常放大，代表市場動能增強，可能是趨勢變換的訊號。\n`;
  }

  // 2. 回測成效
  advice += `\n#### 📊 策略成效 (MACD 突破 + 吊燈停損)\n`;
  advice += `- **勝率**：${stats.winRate.toFixed(1)}%\n`;
  advice += `- **總投報率**：${stats.totalReturn.toFixed(1)}%\n`;
  advice += `- **夏普值**：${stats.sharpeRatio?.toFixed(2) || 'N/A'}\n`;

  // 3. 操作建議
  advice += `\n#### 💡 操作建議\n`;
  if (result.advice.action === 'BUY') {
    advice += `- **核心動作**：**[進場]** 訊號成立。${result.advice.reason}\n`;
  } else if (result.advice.action === 'SELL') {
    advice += `- **核心動作**：**[出場]** 訊號成立。${result.advice.reason}\n`;
  } else if (result.advice.action === 'HOLD') {
    advice += `- **核心動作**：**[續抱]** 目前趨勢尚未被破壞，建議持股。根據 **吊燈停損法 (Multiplier: ${config.atrMultiplier})**，目前需密切觀察股價是否跌破支撐點位。\n`;
  } else {
    advice += `- **核心動作**：**[觀望]** 目前未出現 MACD 突破或箱型強勢突破訊號，建議靜待良機。\n`;
  }


  // 4. 基本面提示
  if (fundamentals) {
    advice += `\n#### 🏢 基本面提醒\n`;
    if (fundamentals.peRatio && fundamentals.peRatio > 25) {
      advice += `- **評價**：本益比為 ${fundamentals.peRatio.toFixed(1)}，高於歷史平均，注意評價修正壓力。\n`;
    } else if (fundamentals.peRatio) {
      advice += `- **評價**：本益比 ${fundamentals.peRatio.toFixed(1)}，處於合理或低估區間。\n`;
    }
  }

  advice += `\n---\n*註：本診斷由在地化規則引擎驅動，完全不產生 API 費用。建議內容僅供參考。*`;

  return advice;
};
