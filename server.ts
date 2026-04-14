import express from 'express';
import { createServer as createViteServer } from 'vite';
import YahooFinance from 'yahoo-finance2';
import { MACD, Stochastic, SMA } from 'technicalindicators';
import { generateSignals, StrategyConfig } from './src/utils/strategy.js';
import path from 'path';
import fs from 'fs/promises';

const CACHE_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(CACHE_DIR, 't86_cache.json');

interface T86Cache {
  [date: string]: any[]; // stores the filtered rows for that date
}

let t86Cache: T86Cache = {};

async function loadCache() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    t86Cache = JSON.parse(data);
  } catch (e) {
    t86Cache = {};
  }
}

async function saveCache() {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(t86Cache, null, 2));
  } catch (e) {
    console.error('Failed to save cache:', e);
  }
}

loadCache();

// Background job queue to avoid rate limiting
const fetchQueue: string[] = [];
let isFetching = false;

async function processQueue() {
  if (isFetching || fetchQueue.length === 0) return;
  isFetching = true;
  
  while (fetchQueue.length > 0) {
    const date = fetchQueue.shift()!;
    if (t86Cache[date]) continue;

    try {
      console.log(`Fetching TWSE T86 for ${date}...`);
      const response = await fetch(`https://www.twse.com.tw/rwd/zh/fund/T86?response=json&date=${date.replace(/-/g, '')}&selectType=ALLBUT0999`);
      const data: any = await response.json();
      
      if (data && data.data) {
        // Only store relevant columns to save space
        // [0] Code, [4] Foreign Net, [7] Trust Net, [14] Dealer Net (Total)
        t86Cache[date] = data.data.map((row: any) => [
          row[0].trim(), // Symbol
          row[4], // Foreign
          row[7], // Trust
          row[14] // Dealer (Total)
        ]);
        await saveCache();
      } else {
        // If data is empty (holiday), store empty array
        t86Cache[date] = [];
        await saveCache();
      }
    } catch (err) {
      console.error(`Error fetching T86 for ${date}:`, err);
    }
    
    // Wait 5 seconds to respect TWSE rate limit
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  isFetching = false;
}

const yahooFinance = new (YahooFinance as any)({
  validation: { logErrors: false, logOptionsErrors: false },
  suppressNotices: ['yahooSurvey', 'ripHistorical']
});

// Helper to safely call yahooFinance methods and bypass validation errors
async function safeYFCall(method: string, ...args: any[]) {
  try {
    return await (yahooFinance as any)[method](...args);
  } catch (error: any) {
    if ((error.name === 'FailedYahooValidationError' || (error.errors && Array.isArray(error.errors))) && error.result) {
      return error.result;
    }
    throw error;
  }
}

// Helper to fetch data with fallback for Taiwan stocks
async function fetchStockDataWithFallback(symbol: string, queryOptions: any) {
  const fetchWithSymbol = async (targetSymbol: string) => {
    try {
      const result = await safeYFCall('chart', targetSymbol, queryOptions);
      if (!result || !result.quotes || result.quotes.length === 0) throw new Error('No chart data');
      return { result, targetSymbol };
    } catch (chartError: any) {
      throw chartError; 
    }
  };

  try {
    return await fetchWithSymbol(symbol);
  } catch (e: any) {
    // Fallback for Taiwan stocks: if it's 4-6 alphanumeric characters, try adding .TW then .TWO
    if (/^[a-zA-Z0-9]{4,6}$/.test(symbol) && !symbol.includes('.')) {
      const suffixes = ['.TW', '.TWO'];
      for (const suffix of suffixes) {
        try {
          return await fetchWithSymbol(`${symbol}${suffix}`);
        } catch (err) {
          continue;
        }
      }
    }
    
    // If fallbacks fail, try searching
    try {
      const searchResults = await safeYFCall('search', symbol);
      if (searchResults && searchResults.quotes && searchResults.quotes.length > 0) {
        const firstQuote = searchResults.quotes.find((q: any) => 
          q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
        );
        if (firstQuote && firstQuote.symbol !== symbol) {
          return await fetchWithSymbol(firstQuote.symbol);
        }
      }
    } catch (searchErr) {
      // Ignore search errors and throw original error
    }
    throw e;
  }
}

// Disable validation to avoid ChartResultObject validation errors

// Helper to format data and calculate indicators
function formatStockData(quotes: any[]) {
  const formattedData = quotes
    .filter((item: any) => 
      item.date && 
      item.open !== null && item.open !== undefined &&
      item.high !== null && item.high !== undefined &&
      item.low !== null && item.low !== undefined &&
      item.close !== null && item.close !== undefined
    )
    .map((item: any) => ({
      time: item.date.toISOString().split('T')[0],
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume || 0,
    }));

  if (formattedData.length === 0) return [];

  const closePrices = formattedData.map(d => d.close);
  const macdResult = MACD.calculate({
    values: closePrices,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  
  const kdResult = Stochastic.calculate({
    high: formattedData.map(d => d.high),
    low: formattedData.map(d => d.low),
    close: closePrices,
    period: 9,
    signalPeriod: 3
  });

  const macdOffset = formattedData.length - macdResult.length;
  const kdOffset = formattedData.length - kdResult.length;

  return formattedData.map((d, i) => {
    const macd = i >= macdOffset ? macdResult[i - macdOffset] : null;
    const kd = i >= kdOffset ? kdResult[i - kdOffset] : null;
    return {
      ...d,
      macd: macd ? macd.MACD : null,
      signal: macd ? macd.signal : null,
      histogram: macd ? macd.histogram : null,
      k: kd ? kd.k : null,
      d: kd ? kd.d : null,
    };
  });
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Search endpoint to resolve names to symbols
  app.get('/api/search/:query', async (req, res) => {
    try {
      const { query } = req.params;
      
      if (!query || query.trim().length < 2) {
        return res.json([]);
      }

      const searchResults = await safeYFCall('search', query);
      
      if (!searchResults || !searchResults.quotes) {
        return res.json([]);
      }

      // Filter for stocks and ETFs
      const stocks = searchResults.quotes.filter((q: any) => 
        q.quoteType === 'EQUITY' || q.quoteType === 'ETF'
      );

      res.json(stocks);
    } catch (error: any) {
      const isValidationError = error.name === 'FailedYahooValidationError' || 
                              (error.errors && Array.isArray(error.errors));
      if (!isValidationError) {
        console.error('Search error:', error.message || error);
      }
      // Handle specific Yahoo Finance errors
      if (error.name === 'BadRequestError') {
        return res.json([]);
      }
      res.status(500).json({ error: '搜尋失敗' });
    }
  });

  // API routes
  app.post('/api/backtest', async (req, res) => {
    const { symbols, config, configs } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: '請提供股票代碼列表' });
    }

    // Default general config if not provided
    const defaultStrategyConfig: StrategyConfig = {
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
    };

    const results = [];
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const queryOptions: any = { period1: twoYearsAgo, interval: '1d' };

    for (const symbol of symbols) {
      try {
        const { result } = await fetchStockDataWithFallback(symbol, queryOptions);
        if (!result || !result.quotes || result.quotes.length < 60) continue;

        const chartData = formatStockData(result.quotes);
        if (chartData.length < 60) continue;

        // Use specific config for this symbol if it exists, otherwise use provided general config or default
        const symbolConfig = (configs && configs[symbol]) || config || defaultStrategyConfig;
        const diagnosis = generateSignals(chartData, symbolConfig);
        
        let currentStatus: 'entry' | 'hold' | 'exit' | 'wait' = 'wait';
        if (diagnosis.currentStatus.inPosition) {
          // Check if entry was today
          const lastTrade = diagnosis.trades.length > 0 ? diagnosis.trades[diagnosis.trades.length - 1] : null;
          const isNewEntry = diagnosis.currentStatus.buyDate === chartData[chartData.length - 1].time;
          currentStatus = isNewEntry ? 'entry' : 'hold';
        } else {
          const lastTrade = diagnosis.trades.length > 0 ? diagnosis.trades[diagnosis.trades.length - 1] : null;
          const isRecentExit = lastTrade && lastTrade.sellDate === chartData[chartData.length - 1].time;
          currentStatus = isRecentExit ? 'exit' : 'wait';
        }

        results.push({
          symbol,
          totalReturn: diagnosis.stats.totalReturn,
          winRate: diagnosis.stats.winRate,
          tradeCount: diagnosis.stats.totalTrades,
          lastPrice: chartData[chartData.length - 1].close,
          status: currentStatus,
          trades: diagnosis.trades.slice(-5).map(t => ({
            entryDate: t.buyDate,
            exitDate: t.sellDate,
            entryPrice: t.buyPrice,
            exitPrice: t.sellPrice,
            profit: t.percent,
            reason: 'Signal' // Simplified
          }))
        });
      } catch (err) {
        console.error(`Backtest error for ${symbol}:`, err);
      }
    }

    // Sort by status priority: entry -> hold -> exit -> wait
    const statusPriority = { entry: 0, hold: 1, exit: 2, wait: 3 };
    results.sort((a, b) => {
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return b.totalReturn - a.totalReturn;
    });
    res.json(results);
  });

  app.get('/api/stock/:symbol', async (req, res) => {
    let { symbol } = req.params;
    
    if (!symbol || symbol.trim() === '') {
      return res.status(400).json({ error: '請提供股票代碼' });
    }

    try {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const queryOptions: any = { period1: twoYearsAgo, interval: '1d' };

      let result;
      let targetSymbol = symbol;

      try {
        const fetchResult = await fetchStockDataWithFallback(symbol, queryOptions);
        result = fetchResult.result;
        targetSymbol = fetchResult.targetSymbol;
      } catch (e: any) {
        throw e;
      }

      const quotes = result.quotes;
      symbol = targetSymbol; // Update symbol to the one that worked

      if (!quotes || quotes.length === 0) {
        return res.status(404).json({ error: '找不到該代碼的數據' });
      }

      // Format data for lightweight-charts and filter out invalid entries
      const formattedData = quotes
        .filter((item: any) => 
          item.date && 
          item.open !== null && item.open !== undefined &&
          item.high !== null && item.high !== undefined &&
          item.low !== null && item.low !== undefined &&
          item.close !== null && item.close !== undefined
        )
        .map((item: any) => ({
          time: item.date.toISOString().split('T')[0],
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume || 0,
        }));

      if (formattedData.length === 0) {
        return res.status(404).json({ error: '找不到該代碼的有效交易數據' });
      }

      // Calculate MACD
      const closePrices = formattedData.map(d => d.close);
      const macdInput = {
        values: closePrices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      };
      const macdResult = MACD.calculate(macdInput);
      
      // Calculate KD (Stochastic Oscillator)
      const kdInput = {
        high: formattedData.map(d => d.high),
        low: formattedData.map(d => d.low),
        close: closePrices,
        period: 9,
        signalPeriod: 3
      };
      const kdResult = Stochastic.calculate(kdInput);

      // Align indicators with data (technicalindicators returns shorter arrays due to periods)
      const macdOffset = formattedData.length - macdResult.length;
      const kdOffset = formattedData.length - kdResult.length;

      const chartData = formattedData.map((d, i) => {
        const macd = i >= macdOffset ? macdResult[i - macdOffset] : null;
        const kd = i >= kdOffset ? kdResult[i - kdOffset] : null;
        return {
          ...d,
          macd: macd ? macd.MACD : null,
          signal: macd ? macd.signal : null,
          histogram: macd ? macd.histogram : null,
          k: kd ? kd.k : null,
          d: kd ? kd.d : null,
        };
      });

      // Calculate Support and Resistance based on last 30 days volume profile
      const last30Days = formattedData.slice(-30);
      let support = null;
      let resistance = null;

      if (last30Days.length > 0) {
        const minPrice = Math.min(...last30Days.map(d => d.low));
        const maxPrice = Math.max(...last30Days.map(d => d.high));
        const currentPrice = last30Days[last30Days.length - 1].close;

        // Create 20 price bins
        const numBins = 20;
        const binSize = (maxPrice - minPrice) / numBins;
        const bins = Array(numBins).fill(0).map((_, i) => ({
          price: minPrice + (i + 0.5) * binSize,
          volume: 0
        }));

        last30Days.forEach(day => {
          const typicalPrice = (day.high + day.low + day.close) / 3;
          const binIndex = Math.min(
            Math.floor((typicalPrice - minPrice) / binSize),
            numBins - 1
          );
          if (binIndex >= 0) {
            bins[binIndex].volume += day.volume;
          }
        });

        // Find max volume bin above current price (Resistance)
        const aboveBins = bins.filter(b => b.price > currentPrice);
        if (aboveBins.length > 0) {
          resistance = aboveBins.reduce((max, b) => b.volume > max.volume ? b : max, aboveBins[0]).price;
        } else {
          resistance = maxPrice;
        }

        // Find max volume bin below current price (Support)
        const belowBins = bins.filter(b => b.price < currentPrice);
        if (belowBins.length > 0) {
          support = belowBins.reduce((max, b) => b.volume > max.volume ? b : max, belowBins[0]).price;
        } else {
          support = minPrice;
        }
      }

      // Fetch fundamental data
      let fundamentals = null;
      try {
        const summary = await safeYFCall('quoteSummary', symbol, {
          modules: [
            'summaryDetail', 
            'financialData', 
            'defaultKeyStatistics', 
            'price',
            'majorHoldersBreakdown',
            'insiderTransactions',
            'quoteType',
          ]
        });
        
        // Fetch quarterly margin history using fundamentalsTimeSeries (more reliable)
        let marginHistory: any[] = [];
        try {
          const threeYearsAgo = new Date();
          threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
          
          const financialSeries = await safeYFCall('fundamentalsTimeSeries', symbol, {
            period1: threeYearsAgo,
            type: 'quarterly',
            module: 'financials'
          });

          if (Array.isArray(financialSeries)) {
            marginHistory = financialSeries.map((item: any) => {
              const revenue = item.totalRevenue || 0;
              if (revenue === 0) return null;
              
              return {
                date: item.date ? new Date(item.date).toISOString().split('T')[0] : '---',
                grossMargin: (item.grossProfit / revenue) * 100,
                operatingMargin: (item.operatingIncome / revenue) * 100,
                netMargin: (item.netIncome / revenue) * 100,
              };
            }).filter(Boolean);
          }
        } catch (fsError) {
          console.warn('Could not fetch fundamentalsTimeSeries for', symbol, (fsError as any).message);
        }

        fundamentals = {
          name: summary.quoteType?.longName,
          shortName: summary.quoteType?.shortName,
          price: summary.price?.regularMarketPrice,
          change: summary.price?.regularMarketChange,
          changePercent: summary.price?.regularMarketChangePercent,
          marketCap: summary.summaryDetail?.marketCap,
          peRatio: summary.summaryDetail?.trailingPE,
          pbRatio: summary.defaultKeyStatistics?.priceToBook,
          dividendYield: summary.summaryDetail?.dividendYield,
          eps: summary.defaultKeyStatistics?.trailingEps,
          revenue: summary.financialData?.totalRevenue,
          profitMargin: summary.financialData?.profitMargins,
          roe: summary.financialData?.returnOnEquity,
          debtToEquity: summary.financialData?.debtToEquity,
          currentRatio: summary.financialData?.currentRatio,
          targetPrice: summary.financialData?.targetMeanPrice,
          recommendation: summary.financialData?.recommendationKey,
          insiderPercent: summary.majorHoldersBreakdown?.insidersPercentHeld,
          institutionPercent: summary.majorHoldersBreakdown?.institutionsPercentHeld,
          marginHistory,
        };
      } catch (fError: any) {
        const isValidationError = fError.name === 'FailedYahooValidationError' || 
                                (fError.errors && Array.isArray(fError.errors));
        if (!isValidationError) {
          console.warn('Could not fetch fundamentals for', symbol, fError.message || fError);
        }
      }

      res.json({
        symbol,
        data: chartData,
        support,
        resistance,
        fundamentals
      });

    } catch (error: any) {
      const isValidationError = error.name === 'FailedYahooValidationError' || 
                              (error.errors && Array.isArray(error.errors));
      
      if (isValidationError) {
        console.error(`Error fetching stock data for ${symbol}: 數據驗證失敗 (Validation Error)`);
      } else {
        console.error('Error fetching stock data:', error.message || error);
      }

      const errorMessage = error.message || '';
      if (
        errorMessage.includes('No data found') || 
        errorMessage.includes('delisted') || 
        errorMessage.includes('Not Found') ||
        error.name === 'NotFoundError'
      ) {
        return res.status(404).json({ error: `找不到代碼 "${symbol}" 的數據，可能已下市或代碼錯誤。` });
      }
      res.status(500).json({ error: '獲取股票數據失敗，請稍後再試。' });
    }
  });

  app.get('/api/stock/:symbol/institutional', async (req, res) => {
    const { symbol } = req.params;
    const cleanSymbol = symbol.split('.')[0]; // 2330.TW -> 2330

    try {
      // 1. Get last 30 trading dates from Yahoo Finance
      const queryOptions = { period1: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), interval: '1d' };
      const { result } = await fetchStockDataWithFallback(symbol, queryOptions);
      if (!result || !result.quotes) return res.status(404).json({ error: '找不到數據' });

      // Take last 30 quotes
      const recentQuotes = result.quotes.filter((q: any) => q.close !== null).slice(-30);
      const dates = recentQuotes.map((q: any) => q.date.toISOString().split('T')[0]);

      // 2. Check cache for these dates
      const institutionalData = [];
      const missingDates = [];

      for (const q of recentQuotes) {
        const dateStr = q.date.toISOString().split('T')[0];
        if (t86Cache[dateStr]) {
          const row = t86Cache[dateStr].find((r: any) => r[0] === cleanSymbol);
          institutionalData.push({
            date: dateStr,
            foreignNet: row ? parseInt(row[1].replace(/,/g, '')) || 0 : 0,
            trustNet: row ? parseInt(row[2].replace(/,/g, '')) || 0 : 0,
            dealerNet: row ? parseInt(row[3].replace(/,/g, '')) || 0 : 0,
            close: q.close
          });
        } else {
          missingDates.push(dateStr);
        }
      }

      // 3. If dates missing, add to queue and trigger process
      if (missingDates.length > 0) {
        missingDates.forEach(d => {
          if (!fetchQueue.includes(d)) fetchQueue.push(d);
        });
        processQueue();
        
        return res.json({
          status: 'loading',
          progress: institutionalData.length,
          total: dates.length,
          data: institutionalData
        });
      }

      res.json({
        status: 'completed',
        data: institutionalData
      });

    } catch (err: any) {
      console.error('Institutional data error:', err);
      res.status(500).json({ error: '獲取法人數據失敗' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Do not serve index.html as a catch-all in the API handler
    // Vercel will handle static files routing
  }

  // Only listen on a port if not running in a Vercel serverless environment
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

// Ensure the server starts for local dev or normal node environments
const appPromise = startServer();

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  app(req, res);
}
