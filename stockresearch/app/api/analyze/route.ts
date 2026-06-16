import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { ticker, liveData, mockData } = await req.json();

  if (!ticker) {
    return Response.json({ error: "ticker required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured. Add it to your .env.local file." },
      { status: 503 }
    );
  }

  const hasLive = liveData && !liveData.error;

  const dataBlock = hasLive
    ? `
LIVE YAHOO FINANCE DATA:
- Company: ${liveData.live?.name}
- Price: ${liveData.live?.currency} ${liveData.live?.price}
- Today Change: ${liveData.live?.changePct?.toFixed(2)}%
- Market Cap: ${liveData.live?.marketCap ? (liveData.live.marketCap / 1e7).toFixed(0) + " Cr" : "N/A"}
- P/E (TTM): ${liveData.live?.pe ?? "N/A"}
- EPS: ${liveData.live?.eps ?? "N/A"}
- 52W High: ${liveData.live?.high52w} | 52W Low: ${liveData.live?.low52w}
- ROE: ${liveData.fundamentals?.roe?.toFixed(1)}%
- Revenue Growth (YoY): ${liveData.fundamentals?.revenueGrowth?.toFixed(1)}%
- Profit Margin: ${liveData.fundamentals?.profitMargin?.toFixed(1)}%
- Operating Margin: ${liveData.fundamentals?.operatingMargin?.toFixed(1)}%
- D/E Ratio: ${liveData.fundamentals?.debtToEquity ?? "N/A"}
- Dividend Yield: ${liveData.fundamentals?.dividendYield?.toFixed(2)}%
- Analyst Target (Mean): ${liveData.fundamentals?.targetMeanPrice ?? "N/A"}
- Analyst Recommendation: ${liveData.fundamentals?.recommendationKey ?? "N/A"} (${liveData.fundamentals?.numberOfAnalystOpinions ?? 0} analysts)
- Sector: ${liveData.profile?.sector ?? "N/A"} | Industry: ${liveData.profile?.industry ?? "N/A"}
- Business: ${liveData.profile?.description?.substring(0, 400) ?? "N/A"}
`
    : `
COMPANY: ${ticker} (Indian NSE/BSE listed company)
Mock data: P/E ${mockData?.pe}x, ROE ${mockData?.roe}%, ROCE ${mockData?.roce}%, D/E ${mockData?.debtToEquity}, MCap ${mockData?.marketCap} Cr
Sector: ${mockData?.sector}
`;

  const prompt = `You are a top Indian equity research analyst with expertise in NSE/BSE listed stocks, similar to analysts at Goldman Sachs, Morgan Stanley, and leading Indian brokerages (HDFC Securities, Motilal Oswal, Kotak).

Analyse the following stock based on the data provided. Reference how top stock market research platforms (Screener.in, Moneycontrol, ValueResearchOnline, Economic Times Markets, Bloomberg Quint) would evaluate this company.

STOCK: ${ticker}
${dataBlock}

Provide a comprehensive analysis in the following JSON structure (respond ONLY with valid JSON, no markdown):

{
  "summary": "2-3 sentence executive summary of what this company does and its current market position",
  "healthScore": { "score": 7, "label": "Good", "reasoning": "brief reason" },
  "valuation": { "verdict": "Fairly Valued", "reasoning": "2-3 sentences comparing current PE/PB to historical and sector averages", "upside": "estimated upside % to analyst target" },
  "strengths": ["point 1", "point 2", "point 3", "point 4"],
  "risks": ["risk 1", "risk 2", "risk 3"],
  "analystView": { "consensus": "Buy/Hold/Sell", "reasoning": "What major brokerages typically say about this stock and sector", "targetRange": "price range if available" },
  "suitableFor": ["long-term investors", "dividend seekers", "etc"],
  "redFlags": ["any red flags or empty array"],
  "greenFlags": ["positive signals"],
  "competitivePosition": "2 sentences on moat and competitive standing",
  "keyMetrics": { "peAssessment": "cheap/fair/expensive + why", "roeQuality": "excellent/good/average/poor", "debtLevel": "zero/low/moderate/high" },
  "recentDevelopments": "What to watch out for — recent news, upcoming catalysts, or risks",
  "screenerRating": { "value": 3, "growth": 4, "quality": 4, "momentum": 3, "dividend": 2 },
  "disclaimer": "Educational analysis only. Not investment advice. Verify with SEBI-registered advisor."
}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Could not parse AI analysis", raw: text }, { status: 500 });
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return Response.json({ analysis, model: "claude-sonnet-4-6", ticker });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
