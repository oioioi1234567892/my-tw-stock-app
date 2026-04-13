import YahooFinance from 'yahoo-finance2';

const yahooFinance = new (YahooFinance as any)({
  validation: { logErrors: false, logOptionsErrors: false },
  suppressNotices: ['yahooSurvey', 'ripHistorical']
});

async function test() {
  const symbol = '2330.TW';
  try {
    const result = await yahooFinance.quoteSummary(symbol, {
      modules: ['defaultKeyStatistics', 'summaryDetail']
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
