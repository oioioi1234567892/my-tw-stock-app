import YahooFinance from 'yahoo-finance2';

const yahooFinance = new (YahooFinance as any)();

async function test() {
  const symbol = '2330.TW';
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const queryOptions = { period1: twoYearsAgo, interval: '1d' };

  try {
    const result = await yahooFinance.chart(symbol, queryOptions);
    console.log('Last 5 quotes:');
    const last5 = (result.quotes || []).slice(-5);
    last5.forEach((q: any) => {
      console.log(`${q.date?.toISOString()}: Close=${q.close}`);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
