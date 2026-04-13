export interface MarginData {
  date: string;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
}

export interface InstitutionalData {
  date: string;
  foreignNet: number;
  trustNet: number;
  dealerNet: number;
  close: number;
}

export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

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

declare global {
  interface Window {
    aistudio?: AIStudio;
  }
}
