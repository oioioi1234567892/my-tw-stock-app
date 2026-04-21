import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, LineData, Time, IPriceLine } from 'lightweight-charts';
import { Pencil, Trash2, Activity, X, TrendingUp, TrendingDown, Target, ShieldCheck, Settings } from 'lucide-react';
import { generateSignals, StrategyConfig, TradeResult, DiagnosisResult } from '../utils/strategy';
import StrategyPanel from './StrategyPanel';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export interface StockData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
  k: number | null;
  d: number | null;
}

interface StockChartProps {
  data: StockData[];
  support?: number | null;
  resistance?: number | null;
  symbol: string;
  onConfigChange?: (config: StrategyConfig) => void;
}

export default function StockChart({ data, support, resistance, symbol, onConfigChange }: StockChartProps) {
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const macdChartContainerRef = useRef<HTMLDivElement>(null);
  const kdChartContainerRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  
  const mainChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const kdChartRef = useRef<IChartApi | null>(null);
  
  const verticalLineRef = useRef<HTMLDivElement>(null);
  const infoPanelRef = useRef<HTMLDivElement>(null);
  
  const seriesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastRealTimePointRef = React.useRef<any>(null);
  const drawnLinesRef = useRef<ISeriesApi<"Line">[]>([]);
  
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawPoints, setDrawPoints] = useState<{ time: Time; price: number }[]>([]);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [maValues, setMaValues] = useState<{ ma60: number | null; ma20: number | null }>({ ma60: null, ma20: null });
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
  });

  // Load custom config for this symbol on mount or symbol change
  useEffect(() => {
    const savedConfigs = localStorage.getItem('stock_strategy_configs');
    if (savedConfigs) {
      const configs = JSON.parse(savedConfigs);
      if (configs[symbol]) {
        setStrategyConfig(configs[symbol]);
      } else {
        // Reset to default if no custom config for this stock
        setStrategyConfig({
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
        });
      }
    }
  }, [symbol]);


  const [showStrategySettings, setShowStrategySettings] = useState(false);

  const runDiagnosis = () => {
    if (data.length < strategyConfig.boxPeriod) return;

    const result = generateSignals(data, strategyConfig);
    setDiagnosisResult(result);
    setShowDiagnosis(true);
  };


  const uniqueData = React.useMemo(() => {
    return data.filter((item, index, self) => 
      index === self.findIndex((t) => t.time === item.time)
    ).sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  }, [data]);

  const { ma60Data, ma20Data, ma10Data, boxHighData, macdData, signalData, histogramData, kData, dData } = React.useMemo(() => {
    const calculateMA = (period: number) => {
      return uniqueData.map((_, i, arr) => {
        if (i < period - 1) return { time: uniqueData[i].time as Time };
        const slice = arr.slice(i - (period - 1), i + 1);
        const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
        return { time: uniqueData[i].time as Time, value: avg };
      });
    };

    const calculateBoxHigh = (period: number) => {
      return uniqueData.map((_, i, arr) => {
        if (i < period) return { time: uniqueData[i].time as Time };
        const slice = arr.slice(i - period, i);
        const high = Math.max(...slice.map(d => d.high));
        return { time: uniqueData[i].time as Time, value: high };
      });
    };

    return {
      ma60Data: calculateMA(60).filter(d => 'value' in d),
      ma20Data: calculateMA(20).filter(d => 'value' in d),
      ma10Data: calculateMA(10).filter(d => 'value' in d),
      boxHighData: calculateBoxHigh(strategyConfig.boxPeriod).filter(d => 'value' in d),
      macdData: uniqueData.map(d => d.macd !== null ? { time: d.time as Time, value: d.macd } : { time: d.time as Time }),
      signalData: uniqueData.map(d => d.signal !== null ? { time: d.time as Time, value: d.signal } : { time: d.time as Time }),
      histogramData: uniqueData.map(d => d.histogram !== null ? {
        time: d.time as Time,
        value: d.histogram,
        color: d.histogram >= 0 ? '#ef444488' : '#22c55e88'
      } : { time: d.time as Time }),
      kData: uniqueData.map(d => d.k !== null ? { time: d.time as Time, value: d.k } : { time: d.time as Time }),
      dData: uniqueData.map(d => d.d !== null ? { time: d.time as Time, value: d.d } : { time: d.time as Time }),
    };
  }, [uniqueData]);

  useEffect(() => {
    if (!mainChartContainerRef.current || !macdChartContainerRef.current || !kdChartContainerRef.current) return;

    const commonOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#1e1e1e' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      timeScale: {
        timeVisible: true,
        borderColor: '#374151',
        borderVisible: false,
        barSpacing: 10,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 5,
      },
      leftPriceScale: {
        visible: false,
        width: 0,
      },
      rightPriceScale: {
        borderColor: '#374151',
        borderVisible: false,
        width: 90, 
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        alignLabels: true,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          visible: false,
          labelVisible: false,
        },
        horzLine: {
          color: '#9ca3af',
          labelBackgroundColor: '#374151',
        }
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: false },
        mouseWheel: true,
        pinch: true,
      },
    };

    // 1. Main Chart
    const mainChart = createChart(mainChartContainerRef.current, {
      ...commonOptions,
      width: mainChartContainerRef.current.clientWidth,
      height: window.innerWidth < 768 ? 300 : 400,
      timeScale: {
        ...commonOptions.timeScale,
        visible: false,
      },
    });
    mainChartRef.current = mainChart;

    const candlestickSeries = mainChart.addCandlestickSeries({
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderVisible: false,
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    });
    seriesRef.current = candlestickSeries;

    const ma60Series = mainChart.addLineSeries({
      color: '#ec4899',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    
    const ma20Series = mainChart.addLineSeries({
      color: '#facc15',
      lineWidth: 1,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: true,
    });

    const ma10Series = mainChart.addLineSeries({
      color: '#a855f7',
      lineWidth: 1,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: false,
    });

    const boxHighSeries = mainChart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 1,
      lineStyle: 2, 
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const volumeSeries = mainChart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    
    // Store refs for updates
    (mainChart as any).ma60Series = ma60Series;
    (mainChart as any).ma20Series = ma20Series;
    (mainChart as any).ma10Series = ma10Series;
    (mainChart as any).boxHighSeries = boxHighSeries;
    (mainChart as any).volumeSeries = volumeSeries;

    // 2. MACD Chart
    const macdChart = createChart(macdChartContainerRef.current, {
      ...commonOptions,
      width: macdChartContainerRef.current.clientWidth,
      height: window.innerWidth < 768 ? 100 : 150,
      timeScale: {
        ...commonOptions.timeScale,
        visible: false,
      },
    });
    macdChartRef.current = macdChart;

    const macdSeries = macdChart.addLineSeries({ color: '#3b82f6', lineWidth: 1 });
    const signalSeries = macdChart.addLineSeries({ color: '#f59e0b', lineWidth: 1 });
    const histogramSeries = macdChart.addHistogramSeries({ color: '#ef4444' });

    (macdChart as any).macdSeries = macdSeries;
    (macdChart as any).signalSeries = signalSeries;
    (macdChart as any).histogramSeries = histogramSeries;

    // 3. KD Chart
    const kdChart = createChart(kdChartContainerRef.current, {
      ...commonOptions,
      width: kdChartContainerRef.current.clientWidth,
      height: window.innerWidth < 768 ? 130 : 180,
      timeScale: {
        ...commonOptions.timeScale,
        visible: true,
      },
    });
    kdChartRef.current = kdChart;

    const kSeries = kdChart.addLineSeries({ color: '#3b82f6', lineWidth: 1 });
    const dSeries = kdChart.addLineSeries({ color: '#f59e0b', lineWidth: 1 });

    (kdChart as any).kSeries = kSeries;
    (kdChart as any).dSeries = dSeries;

    // Sync Time Scales and Crosshairs
    const charts = [mainChart, macdChart, kdChart];
    let isSyncing = false;
    
    const updateInfoPanel = (currentData: StockData, x: number, y: number | null) => {
      if (!infoPanelRef.current) return;
      
      const dateStr = typeof currentData.time === 'string' ? currentData.time : '';
      
      const m60 = (mainChart as any)._lastMA60;
      const m20 = (mainChart as any)._lastMA20;

      infoPanelRef.current.innerHTML = `
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] md:text-[11px]">
          <div class="text-blue-400 font-bold pr-2 border-r border-gray-700">${dateStr}</div>
          <div class="flex items-center gap-1"><span class="text-gray-500">開:</span><span class="text-white">${currentData.open.toFixed(2)}</span></div>
          <div class="flex items-center gap-1"><span class="text-gray-500">高:</span><span class="text-rose-400">${currentData.high.toFixed(2)}</span></div>
          <div class="flex items-center gap-1"><span class="text-gray-500">低:</span><span class="text-emerald-400">${currentData.low.toFixed(2)}</span></div>
          <div class="flex items-center gap-1"><span class="text-gray-500">收:</span><span class="text-white font-bold">${currentData.close.toFixed(2)}</span></div>
          <div class="flex items-center gap-1"><span class="text-gray-500">MA60:</span><span class="text-pink-400">${m60 ? m60.toFixed(2) : '-'}</span></div>
          <div class="flex items-center gap-1"><span class="text-gray-500">MA20:</span><span class="text-yellow-400">${m20 ? m20.toFixed(2) : '-'}</span></div>
        </div>
      `;
      infoPanelRef.current.style.display = 'block';
    };

    const snapToLatest = () => {
      if (!mainChartRef.current || !verticalLineRef.current || !(mainChartRef.current as any)._latestData) return;
      const latestData = (mainChartRef.current as any)._latestData;
      const x = mainChartRef.current.timeScale().timeToCoordinate(latestData.time as Time);
      if (x !== null) {
        const roundedX = Math.round(x);
        verticalLineRef.current.style.display = 'block';
        verticalLineRef.current.style.transform = `translateX(${roundedX}px)`;
        updateInfoPanel(latestData, roundedX, null);
      }
    };

    charts.forEach(chart => {
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (isSyncing || !range) return;
        isSyncing = true;
        charts.forEach(c => {
          if (c !== chart) c.timeScale().setVisibleLogicalRange(range);
        });
        isSyncing = false;
      });

      chart.subscribeCrosshairMove((param) => {
        if (isSyncing) return;
        if (!param.point || !param.time || !verticalLineRef.current || !infoPanelRef.current) {
          if (!isSyncing) snapToLatest();
          return;
        }

        isSyncing = true;
        const x = chart.timeScale().timeToCoordinate(param.time);
        if (x !== null && verticalLineRef.current) {
          const roundedX = Math.round(x);
          verticalLineRef.current.style.display = 'block';
          verticalLineRef.current.style.transform = `translateX(${roundedX}px)`;
        }

        charts.forEach(c => {
          if (c !== chart) c.setCrosshairPosition(param.point?.x ?? 0, param.time as Time, null);
        });
        
        const currentData = (mainChartRef.current as any)._uniqueData?.find((d: any) => d.time === param.time);
        if (currentData) {
          updateInfoPanel(currentData, param.point.x, param.point.y);
        }
        isSyncing = false;
      });
    });

    const handleResize = () => {
      if (!chartWrapperRef.current || !mainChartRef.current || !macdChartRef.current || !kdChartRef.current) return;
      
      const isMobile = window.innerWidth < 768;
      const width = chartWrapperRef.current.clientWidth;
      
      if (width === 0) return;

      mainChartRef.current.resize(width, isMobile ? 300 : 400);
      macdChartRef.current.resize(width, isMobile ? 100 : 150);
      kdChartRef.current.resize(width, isMobile ? 130 : 180);
    };

    const resizeObserver = new ResizeObserver(() => requestAnimationFrame(handleResize));
    if (chartWrapperRef.current) resizeObserver.observe(chartWrapperRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      mainChart.remove();
      macdChart.remove();
      kdChart.remove();
      mainChartRef.current = null;
      macdChartRef.current = null;
      kdChartRef.current = null;
    };
  }, []); // Only run once on mount

  // Data update effect
  useEffect(() => {
    if (!mainChartRef.current || !macdChartRef.current || !kdChartRef.current || uniqueData.length === 0) return;

    const mainChart = mainChartRef.current as any;
    const macdChart = macdChartRef.current as any;
    const kdChart = kdChartRef.current as any;
    
    // Check if initializing (first time setting data)
    const isInitializing = !(mainChart as any)._hasSetData;

    const candleData = uniqueData.map(d => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    // Merge persistent real-time point if it's newer or same as last uniqueData point
    if (lastRealTimePointRef.current) {
      const lastUniqueTime = candleData[candleData.length - 1].time;
      if (lastRealTimePointRef.current.time >= lastUniqueTime) {
        const existingIdx = candleData.findIndex(d => d.time === lastRealTimePointRef.current.time);
        if (existingIdx !== -1) {
          candleData[existingIdx] = lastRealTimePointRef.current;
        } else {
          candleData.push(lastRealTimePointRef.current);
        }
      }
    }
    
    seriesRef.current?.setData(candleData);
    mainChart.ma60Series.setData(ma60Data);
    mainChart.ma20Series.setData(ma20Data);
    mainChart.ma10Series.setData(ma10Data);
    mainChart.boxHighSeries.setData(boxHighData);

    const volumeData = uniqueData.map(d => ({
      time: d.time as Time,
      value: d.volume,
      color: d.close >= d.open ? '#ef444488' : '#22c55e88',
    }));

    if (lastRealTimePointRef.current) {
      const lastUniqueTime = volumeData[volumeData.length - 1].time;
      if (lastRealTimePointRef.current.time >= lastUniqueTime) {
        const payload = {
          time: lastRealTimePointRef.current.time,
          value: lastRealTimePointRef.current.volume,
          color: lastRealTimePointRef.current.close >= lastRealTimePointRef.current.open ? '#ef444488' : '#22c55e88',
        };
        const existingIdx = volumeData.findIndex(d => d.time === lastRealTimePointRef.current.time);
        if (existingIdx !== -1) {
          volumeData[existingIdx] = payload;
        } else {
          volumeData.push(payload);
        }
      }
    }

    mainChart.volumeSeries.setData(volumeData);

    macdChart.macdSeries.setData(macdData);
    macdChart.signalSeries.setData(signalData);
    macdChart.histogramSeries.setData(histogramData);

    kdChart.kSeries.setData(kData);
    kdChart.dSeries.setData(dData);

    // Save state for crosshair lookup
    mainChart._uniqueData = uniqueData;
    mainChart._latestData = uniqueData[uniqueData.length - 1];
    mainChart._lastMA60 = ma60Data[ma60Data.length - 1]?.value;
    mainChart._lastMA20 = ma20Data[ma20Data.length - 1]?.value;

    if (support && isInitializing) {
      seriesRef.current?.createPriceLine({ price: support, color: '#3b82f6', lineWidth: 2, lineStyle: 2, axisLabelVisible: true });
    }
    if (resistance && isInitializing) {
      seriesRef.current?.createPriceLine({ price: resistance, color: '#f59e0b', lineWidth: 2, lineStyle: 2, axisLabelVisible: true });
    }

    if (isInitializing) {
      const dataLength = uniqueData.length;
      if (dataLength > 0) {
        const logicalRange = {
          from: Math.max(0, dataLength - 100),
          to: dataLength - 1,
        };
        mainChart.timeScale().setVisibleLogicalRange(logicalRange);
        macdChart.timeScale().setVisibleLogicalRange(logicalRange);
        kdChart.timeScale().setVisibleLogicalRange(logicalRange);
      }
      (mainChart as any)._hasSetData = true;
    }
  }, [uniqueData, ma20Data, ma10Data, boxHighData, macdData, signalData, histogramData, kData, dData, support, resistance]);

  // Real-time polling for latest quote
  useEffect(() => {
    if (!symbol || uniqueData.length === 0 || !mainChartRef.current) return;

    let timerId: ReturnType<typeof setInterval>;

    const fetchLatest = async () => {
      try {
        const querySymbol = /^[A-Za-z0-9]{4,6}$/.test(symbol) && !symbol.includes('.') ? `${symbol}.TW` : symbol;
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?interval=1d&range=1d`);
        if (!res.ok) return;
        const json = await res.json();
        
        const result = json.chart?.result?.[0];
        if (!result || !result.timestamp || !result.indicators?.quote?.[0]) return;
        
        const timestamp = result.timestamp[result.timestamp.length - 1];
        const quote = result.indicators.quote[0];
        
        const open = quote.open?.[quote.open.length - 1];
        const high = quote.high?.[quote.high.length - 1];
        const low = quote.low?.[quote.low.length - 1];
        const close = quote.close?.[quote.close.length - 1];

        if (typeof close !== 'number' || typeof open !== 'number' || typeof high !== 'number' || typeof low !== 'number') return;
        
        const dateObj = new Date(timestamp * 1000);
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        const newTS = `${year}-${month}-${day}` as Time;

        console.log(`[RealTime] Polled: ${newTS}, Price: ${close}, LastTS: ${uniqueData[uniqueData.length - 1].time}`);

        const volume = quote.volume?.[quote.volume.length - 1] || 0;
        
        const latestPoint = {
          time: newTS,
          open,
          high,
          low,
          close,
          volume
        };

        lastRealTimePointRef.current = latestPoint;
        const lastTS = uniqueData[uniqueData.length - 1].time;

        if (seriesRef.current) {
          seriesRef.current.update(latestPoint);
          // Also update volume series
          const mainChart = mainChartRef.current as any;
          if (mainChart?.volumeSeries) {
            mainChart.volumeSeries.update({
              time: newTS,
              value: volume,
              color: close >= open ? '#ef444488' : '#22c55e88',
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch real-time data:', err);
      }
    };

    const timerId = setInterval(fetchLatest, 60000);
    fetchLatest(); // Initial call
    return () => clearInterval(timerId);
  }, [symbol, uniqueData]);

  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;
    if (showMarkers) {
      const { markers } = generateSignals(data, strategyConfig);
      seriesRef.current.setMarkers(markers);
    } else {
      seriesRef.current.setMarkers([]);
    }
  }, [data, strategyConfig, showMarkers]);

  // Handle Drawing Mode
  useEffect(() => {
    if (!mainChartRef.current || !seriesRef.current) return;

    const chart = mainChartRef.current;
    const series = seriesRef.current;

    const clickHandler = (param: any) => {
      if (!isDrawingMode || !param.point || !param.time) return;

      const price = series.coordinateToPrice(param.point.y);
      if (price === null) return;

      const newPoint = { time: param.time, price };
      
      setDrawPoints(prev => {
        const updated = [...prev, newPoint];
        if (updated.length === 2) {
          const lineSeries = chart.addLineSeries({
            color: '#eab308',
            lineWidth: 2,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          });
          
          updated.sort((a, b) => {
            if (a.time < b.time) return -1;
            if (a.time > b.time) return 1;
            return 0;
          });

          lineSeries.setData([
            { time: updated[0].time, value: updated[0].price },
            { time: updated[1].time, value: updated[1].price }
          ]);
          
          drawnLinesRef.current.push(lineSeries);
          setIsDrawingMode(false);
          return [];
        }
        return updated;
      });
    };

    chart.subscribeClick(clickHandler);

    return () => {
      chart.unsubscribeClick(clickHandler);
    };
  }, [isDrawingMode]);

  const clearLines = () => {
    if (!mainChartRef.current) return;
    drawnLinesRef.current.forEach(line => {
      mainChartRef.current?.removeSeries(line);
    });
    drawnLinesRef.current = [];
    setDrawPoints([]);
  };

  return (
    <div className="flex flex-col gap-3 md:gap-4 w-full">
      <div className="flex items-center gap-1 bg-gray-800 p-1 rounded-lg overflow-x-auto">
        <button
          onClick={() => {
            setIsDrawingMode(!isDrawingMode);
            setDrawPoints([]);
          }}
          className={`flex items-center justify-center gap-1 px-2 py-2 rounded-md text-base leading-[9px] font-normal font-['Georgia'] whitespace-nowrap transition-all active:scale-95 flex-1 ${
            isDrawingMode ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          }`}
        >
          <Pencil size={12} />
          {isDrawingMode ? (drawPoints.length === 1 ? '結束' : '畫線...') : '畫線'}
        </button>
        <button
          onClick={clearLines}
          className="flex items-center justify-center gap-1 px-2 py-2 bg-red-900/50 text-red-400 rounded-md hover:bg-red-900/70 text-base leading-[9px] font-['Georgia'] whitespace-nowrap transition-all active:scale-95 flex-1"
        >
          <Trash2 size={12} />
          清除
        </button>
        <button
          onClick={() => setShowStrategySettings(true)}
          className="flex items-center justify-center gap-1 px-2 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 text-base leading-[9px] font-['Georgia'] whitespace-nowrap transition-all active:scale-95 flex-1"
        >
          <Settings size={12} />
          設定
        </button>
        <button
          onClick={runDiagnosis}
          className="flex items-center justify-center gap-1 px-2 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 text-base leading-[9px] font-['Georgia'] whitespace-nowrap transition-all active:scale-95 shadow-lg shadow-blue-900/20 flex-1"
        >
          <Activity size={12} />
          診斷
        </button>
      </div>
      
      {/* Strategy Settings Modal */}
      {showStrategySettings && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings size={20} className="text-blue-400" />
                策略參數設定
              </h3>
              <button onClick={() => setShowStrategySettings(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <StrategyPanel config={strategyConfig} onChange={setStrategyConfig} />
            </div>
            <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex justify-end">
              <button 
                onClick={() => {
                  setShowStrategySettings(false);
                  if (onConfigChange) {
                    onConfigChange(strategyConfig);
                  }
                }}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
              >
                儲存並關閉
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Diagnosis Results Modal */}
      {showDiagnosis && diagnosisResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <ShieldCheck size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">策略診斷報告 (MACD + 箱型突破 + 吊燈停損)</h3>

                  <p className="text-xs text-gray-500">基於過去一年的歷史數據回測</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDiagnosis(false)}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8">
              {/* Current Status & Advice */}
              <div className={`p-4 rounded-xl border ${
                diagnosisResult.currentStatus.inPosition 
                  ? 'bg-emerald-900/20 border-emerald-500/30' 
                  : 'bg-gray-800/50 border-gray-700'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    diagnosisResult.currentStatus.inPosition ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {diagnosisResult.currentStatus.inPosition ? <TrendingUp size={24} /> : <Activity size={24} />}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-white mb-1">
                      目前狀態：{diagnosisResult.currentStatus.inPosition ? '持有部位中' : '空手觀望中'}
                    </h4>
                    {diagnosisResult.currentStatus.inPosition && (
                      <div className="flex flex-wrap gap-4 text-xs text-gray-400 mb-3">
                        <span>進場日期：<span className="text-white font-mono">{diagnosisResult.currentStatus.buyDate}</span></span>
                        <span>進場成本：<span className="text-white font-mono">{diagnosisResult.currentStatus.buyPrice?.toFixed(2)}</span></span>
                        <span>未實現損益：
                          <span className={`font-mono font-bold ${
                            (diagnosisResult.currentStatus.unrealizedPercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {(diagnosisResult.currentStatus.unrealizedPercent || 0) >= 0 ? '+' : ''}
                            {diagnosisResult.currentStatus.unrealizedPercent?.toFixed(2)}%
                          </span>
                        </span>
                      </div>
                    )}
                    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800 mt-2">
                      <div className="text-xs text-gray-500 mb-1 uppercase tracking-widest">系統建議</div>
                      <p className="text-sm text-gray-200 leading-relaxed">
                        {diagnosisResult.advice.reason}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                <div className="bg-gray-800/50 p-3 md:p-4 rounded-xl border border-gray-700">
                  <span className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest block mb-1">投資勝率</span>
                  <div className="flex items-end gap-2">
                    <span className={`text-xl md:text-3xl font-black ${diagnosisResult.stats.winRate >= 50 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {diagnosisResult.stats.winRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="bg-gray-800/50 p-3 md:p-4 rounded-xl border border-gray-700">
                  <span className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest block mb-1">累積損益</span>
                  <div className="flex items-end gap-2">
                    <span className={`text-xl md:text-3xl font-black ${diagnosisResult.stats.totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {diagnosisResult.stats.totalProfit >= 0 ? '+' : ''}{diagnosisResult.stats.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
                <div className="bg-gray-800/50 p-3 md:p-4 rounded-xl border border-gray-700">
                  <span className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest block mb-1">夏普比率</span>
                  <div className="flex items-end gap-2">
                    <span className="text-xl md:text-3xl font-black text-blue-400">
                      {diagnosisResult.stats.sharpeRatio?.toFixed(2) || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="bg-gray-800/50 p-3 md:p-4 rounded-xl border border-gray-700">
                  <span className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest block mb-1">最大回撤</span>
                  <div className="flex items-end gap-2">
                    <span className="text-xl md:text-3xl font-black text-rose-400">
                      -{diagnosisResult.stats.maxDrawdown.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="bg-gray-800/50 p-3 md:p-4 rounded-xl border border-gray-700">
                  <span className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest block mb-1">交易次數</span>
                  <div className="flex items-end gap-2">
                    <span className="text-xl md:text-3xl font-black text-white">{diagnosisResult.stats.totalTrades}</span>
                  </div>
                </div>
              </div>

              {/* Equity Curve Chart */}
              {diagnosisResult.stats.equityCurve && (
                <div className="bg-gray-800/30 rounded-2xl border border-gray-800 p-6">
                  <h4 className="text-sm font-bold text-gray-400 mb-6 flex items-center gap-2">
                    <Activity size={16} className="text-blue-500" />
                    策略權益曲線 (Equity Curve)
                  </h4>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={diagnosisResult.stats.equityCurve}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis 
                          dataKey="time" 
                          stroke="#6b7280" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          minTickGap={50}
                        />
                        <YAxis 
                          stroke="#6b7280" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
                          domain={['dataMin - 10000', 'dataMax + 10000']}
                        />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                          labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                          itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                          formatter={(value: any) => [`$${value.toLocaleString()}`, '資產淨值']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorValue)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}


              {/* Trade History */}
              <div>
                <h4 className="text-xs md:text-sm font-bold text-gray-400 mb-3 md:mb-4 flex items-center gap-2">
                  <Activity size={14} />
                  交易明細 (最近 12 個月)
                </h4>
                <div className="bg-gray-800/30 rounded-xl border border-gray-800 overflow-x-auto">
                  <table className="w-full text-left text-xs md:text-sm min-w-[500px]">
                    <thead className="bg-gray-900/50 text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest">
                      <tr>
                        <th className="px-3 md:px-4 py-2 md:py-3">進場日期</th>
                        <th className="px-3 md:px-4 py-2 md:py-3">出場日期</th>
                        <th className="px-3 md:px-4 py-2 md:py-3">進場價</th>
                        <th className="px-3 md:px-4 py-2 md:py-3">出場價</th>
                        <th className="px-3 md:px-4 py-2 md:py-3 text-right">損益 (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {diagnosisResult.trades.length > 0 ? (
                        diagnosisResult.trades.map((trade, idx) => (
                          <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-3 md:px-4 py-2 md:py-3 font-mono text-gray-300">{trade.buyDate}</td>
                            <td className="px-3 md:px-4 py-2 md:py-3 font-mono text-gray-300">{trade.sellDate}</td>
                            <td className="px-3 md:px-4 py-2 md:py-3 font-mono text-white">{trade.buyPrice.toFixed(2)}</td>
                            <td className="px-3 md:px-4 py-2 md:py-3 font-mono text-white">{trade.sellPrice.toFixed(2)}</td>
                            <td className={`px-3 md:px-4 py-2 md:py-3 font-mono text-right font-bold ${trade.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {trade.profit >= 0 ? <TrendingUp size={10} className="inline mr-1" /> : <TrendingDown size={10} className="inline mr-1" />}
                              {trade.percent.toFixed(2)}%
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 md:py-10 text-center text-gray-500 italic">
                            過去一年內未偵測到符合策略的交易訊號
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Strategy Logic Reminder */}
              <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-xl">
                <h5 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-2">
                  <ShieldCheck size={14} />
                  當前策略邏輯說明
                </h5>
                  <ul className="text-[11px] text-gray-400 space-y-1 list-disc list-inside">
                    {strategyConfig.strategyType === 'MACD_BREAKOUT' && (
                      <>
                        <li>進場：MACD 轉強 (Histogram 今日 &gt; 昨日)、DIF &gt; 0、股價 &gt; {strategyConfig.maPeriod}MA 且突破 {strategyConfig.boxPeriod} 日箱型高點。</li>
                        <li>出場：MACD 轉弱 (Histogram 今日 &lt; 昨日) 且 K &lt; D，或觸發 {strategyConfig.stopLoss}% 停損。</li>
                      </>
                    )}
                    {strategyConfig.strategyType === 'DUAL_MA' && (
                      <>
                        <li>進場：短均線 ({strategyConfig.fastMaPeriod}MA) 向上突破長均線 ({strategyConfig.slowMaPeriod}MA)。</li>
                        <li>出場：短均線 ({strategyConfig.fastMaPeriod}MA) 向下跌破長均線 ({strategyConfig.slowMaPeriod}MA)，或觸發 {strategyConfig.stopLoss}% 停損。</li>
                      </>
                    )}
                    {strategyConfig.strategyType === 'RSI_OVERBOUGHT_OVERSOLD' && (
                      <>
                        <li>進場：RSI ({strategyConfig.rsiPeriod}) 從超賣區 ({strategyConfig.rsiOversold}) 向上突破。</li>
                        <li>出場：RSI ({strategyConfig.rsiPeriod}) 從超買區 ({strategyConfig.rsiOverbought}) 向下跌破，或觸發 {strategyConfig.stopLoss}% 停損。</li>
                      </>
                    )}
                    <li>本回測以 10 萬初始資金為基準，每次訊號出現時全倉進出（不計手續費）。</li>
                  </ul>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex justify-end">
              <button 
                onClick={() => setShowDiagnosis(false)}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-bold text-sm"
              >
                關閉報告
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div ref={chartWrapperRef} className="relative flex flex-col w-full rounded-lg overflow-hidden border border-gray-700 shadow-xl bg-[#1e1e1e]">
        {/* Fixed Info Panel at Top */}
        <div 
          ref={infoPanelRef} 
          className="absolute top-0 left-0 right-0 z-50 hidden bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 px-4 py-1.5 pointer-events-none font-mono"
        />
        
        {/* 同步垂直游標線 */}
        <div 
          ref={verticalLineRef} 
          className="absolute top-0 bottom-0 w-[1px] bg-blue-400/40 z-20 pointer-events-none hidden"
          style={{ left: 0 }}
        />
        
        <div className="relative w-full">
          <div className="absolute top-10 left-2 md:left-4 z-10 flex flex-col md:flex-row md:items-center gap-x-4 gap-y-1">
            <span className="text-gray-400 text-[10px] md:text-sm font-semibold">價格與成交量</span>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 text-[9px] md:text-[11px] font-mono">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#ec4899]"></span>
                <span className="text-gray-300">MA60: {maValues.ma60 ? maValues.ma60.toFixed(2) : '---'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#facc15]"></span>
                <span className="text-gray-300">MA20: {maValues.ma20 ? maValues.ma20.toFixed(2) : '---'}</span>
              </div>
              {support && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#3b82f6]"></span>
                  <span className="text-gray-300">支撐: {support.toFixed(2)}</span>
                </div>
              )}
              {resistance && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#f59e0b]"></span>
                  <span className="text-gray-300">壓力: {resistance.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
          <div ref={mainChartContainerRef} className="w-full overflow-hidden" />
        </div>
        <div className="relative w-full border-t border-gray-700">
          <div className="absolute top-2 left-2 md:left-4 z-10 text-gray-400 text-[10px] md:text-sm font-semibold">MACD</div>
          <div ref={macdChartContainerRef} className="w-full overflow-hidden" />
        </div>
        <div className="relative w-full border-t border-gray-700">
          <div className="absolute top-2 left-2 md:left-4 z-10 text-gray-400 text-[10px] md:text-sm font-semibold">KD</div>
          <div ref={kdChartContainerRef} className="w-full overflow-hidden" />
        </div>
      </div>
    </div>
  );
}
