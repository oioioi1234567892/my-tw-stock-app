import { MarginData } from '../types';

export interface FundamentalData {
  peRatio?: number;
  pbRatio?: number;
  dividendYield?: number;
  marketCap?: number;
  revenue?: number;
  netIncome?: number;
  eps?: number;
  roe?: number;
  roa?: number;
  debtToEquity?: number;
  grossMargin?: number;
  operatingMargin?: number;
  profitMargin?: number;
  marginHistory?: MarginData[];
}

const keyTranslations: Record<string, string> = {
  name: '公司名稱',
  shortName: '公司簡稱',
  price: '股價',
  change: '漲跌',
  changePercent: '漲跌幅 (%)',
  peRatio: '本益比 (P/E)',
  pbRatio: '股價淨值比 (P/B)',
  dividendYield: '殖利率 (%)',
  marketCap: '市值',
  revenue: '營收',
  netIncome: '淨利',
  eps: '每股盈餘 (EPS)',
  roe: '股東權益報酬率 (ROE)',
  roa: '資產報酬率 (ROA)',
  debtToEquity: '負債權益比',
  grossMargin: '毛利率',
  operatingMargin: '營業利益率',
  profitMargin: '淨利率',
  currentRatio: '流動比率',
  targetPrice: '目標價',
  recommendation: '分析師評級',
  insiderPercent: '內部人持股 (%)',
  institutionPercent: '機構持股 (%)',
};

export default function FundamentalAnalysis({ data }: { data: FundamentalData }) {
  return (
    <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
      <h3 className="text-xl font-bold text-white mb-4">基本面分析</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(data)
          .filter(([key, value]) => typeof value !== 'object' || value === null)
          .map(([key, value]) => (
          <div key={key} className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">{keyTranslations[key] || key}</div>
            <div className="text-lg font-bold text-white">
              {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value || '---'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
