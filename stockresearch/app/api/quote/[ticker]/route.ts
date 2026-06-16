import yahooFinance from "yahoo-finance2";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  // Indian stocks: try NSE (.NS) first, then BSE (.BO)
  const suffixes = [".NS", ".BO", ""];
  let quoteData = null;
  let summaryData = null;
  let usedSymbol = "";

  for (const suffix of suffixes) {
    const symbol = upper + suffix;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await yahooFinance.quote(symbol, {}, { validateResult: false }) as any;
      if (result && result.regularMarketPrice) {
        quoteData = result;
        usedSymbol = symbol;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!quoteData) {
    return Response.json({ error: `No data found for ${upper} on Yahoo Finance` }, { status: 404 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    summaryData = await yahooFinance.quoteSummary(
      usedSymbol,
      {
        modules: [
          "summaryDetail",
          "financialData",
          "defaultKeyStatistics",
          "assetProfile",
          "earningsTrend",
        ],
      },
      { validateResult: false }
    );
  } catch {
    // summary optional
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = quoteData as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sd = (summaryData as any)?.summaryDetail;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fd = (summaryData as any)?.financialData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ks = (summaryData as any)?.defaultKeyStatistics;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ap = (summaryData as any)?.assetProfile;

  return Response.json({
    ticker: upper,
    symbol: usedSymbol,
    source: "Yahoo Finance",
    live: {
      price: q.regularMarketPrice ?? null,
      change: q.regularMarketChange ?? null,
      changePct: q.regularMarketChangePercent ?? null,
      open: q.regularMarketOpen ?? null,
      high: q.regularMarketDayHigh ?? null,
      low: q.regularMarketDayLow ?? null,
      prevClose: q.regularMarketPreviousClose ?? null,
      volume: q.regularMarketVolume ?? null,
      avgVolume: q.averageDailyVolume10Day ?? null,
      marketCap: q.marketCap ?? null,
      high52w: q.fiftyTwoWeekHigh ?? null,
      low52w: q.fiftyTwoWeekLow ?? null,
      currency: q.currency ?? "INR",
      exchange: q.fullExchangeName ?? null,
      name: q.longName ?? q.shortName ?? upper,
      pe: q.trailingPE ?? null,
      eps: q.epsTrailingTwelveMonths ?? null,
    },
    fundamentals: {
      forwardPE: sd?.forwardPE ?? null,
      trailingPE: sd?.trailingPE ?? null,
      pb: ks?.priceToBook ?? null,
      beta: ks?.beta ?? null,
      dividendYield: (sd?.dividendYield ?? 0) * 100,
      payoutRatio: (sd?.payoutRatio ?? 0) * 100,
      roe: (fd?.returnOnEquity ?? 0) * 100,
      roa: (fd?.returnOnAssets ?? 0) * 100,
      revenueGrowth: (fd?.revenueGrowth ?? 0) * 100,
      earningsGrowth: (fd?.earningsGrowth ?? 0) * 100,
      grossMargin: (fd?.grossMargins ?? 0) * 100,
      operatingMargin: (fd?.operatingMargins ?? 0) * 100,
      profitMargin: (fd?.profitMargins ?? 0) * 100,
      debtToEquity: fd?.debtToEquity ?? null,
      currentRatio: fd?.currentRatio ?? null,
      totalCash: fd?.totalCash ?? null,
      totalDebt: fd?.totalDebt ?? null,
      freeCashflow: fd?.freeCashflow ?? null,
      revenue: fd?.totalRevenue ?? null,
      targetMeanPrice: fd?.targetMeanPrice ?? null,
      targetHighPrice: fd?.targetHighPrice ?? null,
      targetLowPrice: fd?.targetLowPrice ?? null,
      recommendationMean: fd?.recommendationMean ?? null,
      recommendationKey: fd?.recommendationKey ?? null,
      numberOfAnalystOpinions: fd?.numberOfAnalystOpinions ?? null,
    },
    profile: {
      sector: ap?.sector ?? null,
      industry: ap?.industry ?? null,
      description: ap?.longBusinessSummary ?? null,
      country: ap?.country ?? null,
      website: ap?.website ?? null,
      employees: ap?.fullTimeEmployees ?? null,
    },
    fetchedAt: new Date().toISOString(),
  });
}
