"use client";
import { useState, useEffect } from "react";
import {
  Zap, RefreshCw, TrendingUp, TrendingDown, Brain,
  AlertTriangle, CheckCircle, Target, BarChart2,
  ExternalLink, Star, Shield, Activity, Award, Loader
} from "lucide-react";

type LiveQuote = {
  ticker: string;
  symbol: string;
  live: {
    price: number | null;
    change: number | null;
    changePct: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    prevClose: number | null;
    volume: number | null;
    avgVolume: number | null;
    marketCap: number | null;
    high52w: number | null;
    low52w: number | null;
    currency: string;
    exchange: string | null;
    name: string;
    pe: number | null;
    eps: number | null;
  };
  fundamentals: {
    forwardPE: number | null;
    pb: number | null;
    dividendYield: number | null;
    roe: number | null;
    roa: number | null;
    revenueGrowth: number | null;
    earningsGrowth: number | null;
    grossMargin: number | null;
    operatingMargin: number | null;
    profitMargin: number | null;
    debtToEquity: number | null;
    currentRatio: number | null;
    freeCashflow: number | null;
    targetMeanPrice: number | null;
    recommendationKey: string | null;
    numberOfAnalystOpinions: number | null;
  };
  profile: {
    sector: string | null;
    industry: string | null;
    description: string | null;
    country: string | null;
    website: string | null;
    employees: number | null;
  };
  error?: string;
  fetchedAt: string;
};

type AIAnalysis = {
  summary: string;
  healthScore: { score: number; label: string; reasoning: string };
  valuation: { verdict: string; reasoning: string; upside: string };
  strengths: string[];
  risks: string[];
  analystView: { consensus: string; reasoning: string; targetRange: string };
  suitableFor: string[];
  redFlags: string[];
  greenFlags: string[];
  competitivePosition: string;
  keyMetrics: { peAssessment: string; roeQuality: string; debtLevel: string };
  recentDevelopments: string;
  screenerRating: { value: number; growth: number; quality: number; momentum: number; dividend: number };
  disclaimer: string;
};

type MockStock = {
  pe?: number;
  roe?: number;
  roce?: number;
  debtToEquity?: number;
  marketCap?: number;
  sector?: string;
};

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)" }}>
      <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: 13 }}>Loading...</span>
    </div>
  );
}

function ScoreBar({ label, value, max = 5, color }: { label: string; value: number; max?: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}/{max}</span>
      </div>
      <div style={{ height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

export default function LiveDataPanel({ ticker, mockStock }: { ticker: string; mockStock?: MockStock }) {
  const [liveData, setLiveData] = useState<LiveQuote | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"live" | "ai">("live");

  async function fetchLiveData() {
    setLoadingLive(true);
    setLiveError(null);
    try {
      const res = await fetch(`/api/quote/${ticker}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setLiveError(data.error || "Failed to fetch live data");
      } else {
        setLiveData(data);
      }
    } catch {
      setLiveError("Network error fetching live data");
    } finally {
      setLoadingLive(false);
    }
  }

  async function fetchAIAnalysis() {
    setLoadingAI(true);
    setAiError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, liveData, mockData: mockStock }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAiError(data.error || "AI analysis failed");
      } else {
        setAiAnalysis(data.analysis);
      }
    } catch {
      setAiError("Network error during AI analysis");
    } finally {
      setLoadingAI(false);
    }
  }

  useEffect(() => {
    fetchLiveData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  const live = liveData?.live;
  const isUp = live ? (live.changePct ?? 0) >= 0 : true;

  const consensusColor = (key: string | null) => {
    if (!key) return "var(--muted)";
    const k = key.toLowerCase();
    if (k.includes("buy") || k.includes("strong")) return "var(--accent-green)";
    if (k.includes("sell")) return "var(--accent-red)";
    return "var(--accent-yellow)";
  };

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
      {/* Header */}
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(135deg, rgba(88,166,255,.06), rgba(188,140,255,.04))",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setActiveSection("live")}
              style={{
                padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
                background: activeSection === "live" ? "var(--accent-blue)" : "var(--background)",
                color: activeSection === "live" ? "white" : "var(--muted)",
              }}
            >
              <Zap size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Live Data
            </button>
            <button
              onClick={() => setActiveSection("ai")}
              style={{
                padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
                background: activeSection === "ai" ? "var(--accent-purple)" : "var(--background)",
                color: activeSection === "ai" ? "white" : "var(--muted)",
              }}
            >
              <Brain size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
              AI Deep Dive
            </button>
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px" }}>
            Source: Yahoo Finance + Claude AI
          </span>
        </div>
        <button
          onClick={activeSection === "live" ? fetchLiveData : fetchAIAnalysis}
          disabled={activeSection === "live" ? loadingLive : loadingAI}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
            background: "var(--background)", border: "1px solid var(--border)", borderRadius: 7,
            fontSize: 12, color: "var(--muted)", cursor: "pointer",
          }}
        >
          <RefreshCw size={12} style={{ animation: (loadingLive || loadingAI) ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      <div style={{ padding: 20 }}>
        {/* LIVE DATA SECTION */}
        {activeSection === "live" && (
          <>
            {loadingLive && (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <Spinner />
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>Fetching live data from Yahoo Finance for {ticker}.NS...</p>
              </div>
            )}

            {liveError && !loadingLive && (
              <div style={{ padding: "16px", background: "rgba(248,81,73,.06)", border: "1px solid rgba(248,81,73,.2)", borderRadius: 10, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertTriangle size={14} color="var(--accent-red)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-red)", marginBottom: 4 }}>Yahoo Finance Error</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{liveError}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                      Note: Indian stocks need suffix — try searching as "{ticker}.NS" (NSE) or "{ticker}.BO" (BSE).
                      Yahoo Finance may not cover all NSE/BSE tickers by company abbreviation.
                      The mock data below reflects research-grade estimates.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {liveData && !liveError && live && (
              <div>
                {/* Live price block */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                      {liveData.live.exchange} · {liveData.symbol} · Live
                      <span style={{ display: "inline-block", width: 6, height: 6, background: "var(--accent-green)", borderRadius: "50%", marginLeft: 6, animation: "pulse 2s infinite" }} />
                      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace" }}>
                      {live.currency} {live.price?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      {isUp ? <TrendingUp size={14} color="var(--accent-green)" /> : <TrendingDown size={14} color="var(--accent-red)" />}
                      <span style={{ fontSize: 14, fontWeight: 700, color: isUp ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {isUp ? "+" : ""}{live.change?.toFixed(2)} ({isUp ? "+" : ""}{live.changePct?.toFixed(2)}%)
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>today</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Last updated</div>
                    <div style={{ fontSize: 12, color: "var(--foreground)" }}>{new Date(liveData.fetchedAt).toLocaleTimeString("en-IN")}</div>
                    {liveData.fundamentals.recommendationKey && (
                      <div style={{
                        marginTop: 8, padding: "4px 12px", borderRadius: 20,
                        fontSize: 12, fontWeight: 700,
                        color: consensusColor(liveData.fundamentals.recommendationKey),
                        background: `${consensusColor(liveData.fundamentals.recommendationKey)}15`,
                        border: `1px solid ${consensusColor(liveData.fundamentals.recommendationKey)}40`,
                        display: "inline-block",
                      }}>
                        {liveData.fundamentals.recommendationKey?.toUpperCase()}
                        {liveData.fundamentals.numberOfAnalystOpinions ? ` (${liveData.fundamentals.numberOfAnalystOpinions} analysts)` : ""}
                      </div>
                    )}
                  </div>
                </div>

                {/* Intraday metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
                  {[
                    { label: "Open", value: live.open ? `${live.currency} ${live.open.toFixed(2)}` : "—" },
                    { label: "Day High", value: live.high ? `${live.currency} ${live.high.toFixed(2)}` : "—" },
                    { label: "Day Low", value: live.low ? `${live.currency} ${live.low.toFixed(2)}` : "—" },
                    { label: "Prev Close", value: live.prevClose ? `${live.currency} ${live.prevClose.toFixed(2)}` : "—" },
                    { label: "Volume", value: live.volume ? (live.volume / 1e5).toFixed(1) + "L" : "—" },
                    { label: "52W High", value: live.high52w ? `${live.currency} ${live.high52w.toFixed(0)}` : "—" },
                    { label: "52W Low", value: live.low52w ? `${live.currency} ${live.low52w.toFixed(0)}` : "—" },
                    { label: "Market Cap", value: live.marketCap ? `₹${(live.marketCap / 1e7).toFixed(0)} Cr` : "—" },
                  ].map((m) => (
                    <div key={m.label} style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>{m.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Fundamental ratios */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Fundamental Ratios (Yahoo Finance)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                    {[
                      { label: "P/E (TTM)", value: live.pe != null ? live.pe.toFixed(1) + "x" : "—", good: live.pe != null && live.pe < 30 },
                      { label: "Forward P/E", value: liveData.fundamentals.forwardPE != null ? liveData.fundamentals.forwardPE.toFixed(1) + "x" : "—", good: true },
                      { label: "P/B Ratio", value: liveData.fundamentals.pb != null ? liveData.fundamentals.pb.toFixed(1) + "x" : "—", good: true },
                      { label: "ROE", value: liveData.fundamentals.roe != null ? liveData.fundamentals.roe.toFixed(1) + "%" : "—", good: (liveData.fundamentals.roe ?? 0) > 15 },
                      { label: "Profit Margin", value: liveData.fundamentals.profitMargin != null ? liveData.fundamentals.profitMargin.toFixed(1) + "%" : "—", good: (liveData.fundamentals.profitMargin ?? 0) > 10 },
                      { label: "Revenue Growth", value: liveData.fundamentals.revenueGrowth != null ? liveData.fundamentals.revenueGrowth.toFixed(1) + "%" : "—", good: (liveData.fundamentals.revenueGrowth ?? 0) > 5 },
                      { label: "D/E Ratio", value: liveData.fundamentals.debtToEquity?.toFixed(2) ?? "—", good: (liveData.fundamentals.debtToEquity ?? 999) < 1 },
                      { label: "Dividend Yield", value: liveData.fundamentals.dividendYield != null ? liveData.fundamentals.dividendYield.toFixed(2) + "%" : "—", good: (liveData.fundamentals.dividendYield ?? 0) > 1 },
                      { label: "Analyst Target", value: liveData.fundamentals.targetMeanPrice ? `₹${liveData.fundamentals.targetMeanPrice.toFixed(0)}` : "—", good: true },
                      { label: "Employees", value: liveData.profile.employees ? liveData.profile.employees.toLocaleString("en-IN") : "—", good: true },
                    ].map((m) => (
                      <div key={m.label} style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px" }}>
                        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>{m.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: m.good ? "var(--accent-green)" : "var(--accent-red)" }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {liveData.profile.description && (
                  <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                    <strong style={{ color: "var(--foreground)", fontWeight: 600 }}>About (Yahoo Finance): </strong>
                    {liveData.profile.description.substring(0, 600)}{liveData.profile.description.length > 600 ? "…" : ""}
                    {liveData.profile.website && (
                      <a href={liveData.profile.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-blue)", marginLeft: 8, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        Website <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* AI ANALYSIS SECTION */}
        {activeSection === "ai" && (
          <>
            {!aiAnalysis && !loadingAI && !aiError && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Brain size={36} style={{ color: "var(--accent-purple)", marginBottom: 12 }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>AI Deep Dive Analysis</h3>
                <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 400, margin: "0 auto 20px", lineHeight: 1.7 }}>
                  Get a comprehensive analysis of {ticker} from Claude AI — synthesizing financial data,
                  valuation, competitive position, risks, and analyst consensus.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 20 }}>
                  {["Financial Health Score", "Valuation Assessment", "Bull/Bear Analysis", "Analyst Consensus", "Risk Factors", "Investment Suitability"].map((f) => (
                    <span key={f} style={{ fontSize: 11, background: "rgba(188,140,255,.1)", color: "var(--accent-purple)", border: "1px solid rgba(188,140,255,.2)", borderRadius: 20, padding: "3px 10px" }}>{f}</span>
                  ))}
                </div>
                <button
                  onClick={fetchAIAnalysis}
                  style={{
                    padding: "10px 24px", background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))",
                    border: "none", borderRadius: 9, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 8,
                  }}
                >
                  <Brain size={16} /> Run AI Analysis
                </button>
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--muted)" }}>
                  Requires ANTHROPIC_API_KEY in .env.local
                </div>
              </div>
            )}

            {loadingAI && (
              <div style={{ padding: "32px 0", textAlign: "center" }}>
                <Spinner />
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>Claude AI is analyzing {ticker} — synthesizing data from multiple sources...</p>
              </div>
            )}

            {aiError && !loadingAI && (
              <div style={{ padding: "16px", background: "rgba(248,81,73,.06)", border: "1px solid rgba(248,81,73,.2)", borderRadius: 10, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertTriangle size={14} color="var(--accent-red)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-red)", marginBottom: 4 }}>AI Analysis Error</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{aiError}</div>
                    {aiError.includes("ANTHROPIC_API_KEY") && (
                      <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--background)", borderRadius: 6, fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
                        Add to stockresearch/.env.local:<br />
                        ANTHROPIC_API_KEY=sk-ant-...
                      </div>
                    )}
                    <button onClick={fetchAIAnalysis} style={{ marginTop: 10, padding: "6px 14px", background: "var(--accent-purple)", border: "none", borderRadius: 6, color: "white", fontSize: 12, cursor: "pointer" }}>
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            )}

            {aiAnalysis && !loadingAI && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Executive Summary */}
                <div style={{ padding: "16px", background: "linear-gradient(135deg, rgba(88,166,255,.06), rgba(188,140,255,.04))", border: "1px solid rgba(88,166,255,.2)", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-blue)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    AI Executive Summary
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--foreground)" }}>{aiAnalysis.summary}</p>
                </div>

                {/* Health Score + Screener Ratings */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Health Score</div>
                      <div style={{
                        fontSize: 24, fontWeight: 900,
                        color: aiAnalysis.healthScore.score >= 7 ? "var(--accent-green)" : aiAnalysis.healthScore.score >= 5 ? "var(--accent-yellow)" : "var(--accent-red)",
                      }}>
                        {aiAnalysis.healthScore.score}<span style={{ fontSize: 14, fontWeight: 400, color: "var(--muted)" }}>/10</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: aiAnalysis.healthScore.score >= 7 ? "var(--accent-green)" : "var(--accent-yellow)", marginBottom: 6 }}>
                      {aiAnalysis.healthScore.label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{aiAnalysis.healthScore.reasoning}</div>
                  </div>

                  <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Screener Ratings</div>
                    <ScoreBar label="Value" value={aiAnalysis.screenerRating.value} color="var(--accent-blue)" />
                    <ScoreBar label="Growth" value={aiAnalysis.screenerRating.growth} color="var(--accent-green)" />
                    <ScoreBar label="Quality" value={aiAnalysis.screenerRating.quality} color="var(--accent-purple)" />
                    <ScoreBar label="Momentum" value={aiAnalysis.screenerRating.momentum} color="var(--accent-yellow)" />
                    <ScoreBar label="Dividend" value={aiAnalysis.screenerRating.dividend} color="var(--accent-gold)" />
                  </div>
                </div>

                {/* Valuation */}
                <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Target size={14} color="var(--accent-blue)" />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Valuation Assessment</span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                      background: aiAnalysis.valuation.verdict.includes("Under") ? "rgba(63,185,80,.1)" :
                        aiAnalysis.valuation.verdict.includes("Over") ? "rgba(248,81,73,.1)" : "rgba(88,166,255,.1)",
                      color: aiAnalysis.valuation.verdict.includes("Under") ? "var(--accent-green)" :
                        aiAnalysis.valuation.verdict.includes("Over") ? "var(--accent-red)" : "var(--accent-blue)",
                    }}>
                      {aiAnalysis.valuation.verdict}
                    </span>
                    {aiAnalysis.valuation.upside && (
                      <span style={{ fontSize: 12, color: "var(--accent-green)", marginLeft: "auto" }}>
                        Upside: {aiAnalysis.valuation.upside}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{aiAnalysis.valuation.reasoning}</p>
                </div>

                {/* Strengths + Risks */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ background: "rgba(63,185,80,.04)", border: "1px solid rgba(63,185,80,.2)", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-green)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle size={14} /> Key Strengths
                    </div>
                    {aiAnalysis.strengths.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <span style={{ color: "var(--accent-green)", flexShrink: 0, marginTop: 2 }}>✓</span>
                        <span style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.5 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "rgba(248,81,73,.04)", border: "1px solid rgba(248,81,73,.2)", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-red)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertTriangle size={14} /> Key Risks
                    </div>
                    {aiAnalysis.risks.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <span style={{ color: "var(--accent-red)", flexShrink: 0, marginTop: 2 }}>⚠</span>
                        <span style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.5 }}>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Analyst View */}
                <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <BarChart2 size={14} color="var(--accent-blue)" />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Analyst Consensus</span>
                    <span style={{ fontSize: 13, fontWeight: 800, padding: "2px 12px", borderRadius: 20, background: `${consensusColor(aiAnalysis.analystView.consensus)}15`, color: consensusColor(aiAnalysis.analystView.consensus), border: `1px solid ${consensusColor(aiAnalysis.analystView.consensus)}40` }}>
                      {aiAnalysis.analystView.consensus}
                    </span>
                    {aiAnalysis.analystView.targetRange && (
                      <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>Target: {aiAnalysis.analystView.targetRange}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65, marginBottom: 12 }}>{aiAnalysis.analystView.reasoning}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>Suitable for:</span>
                    {aiAnalysis.suitableFor.map((s, i) => (
                      <span key={i} style={{ fontSize: 11, background: "rgba(88,166,255,.08)", color: "var(--accent-blue)", border: "1px solid rgba(88,166,255,.2)", borderRadius: 20, padding: "1px 8px" }}>{s}</span>
                    ))}
                  </div>
                </div>

                {/* Green Flags + Red Flags */}
                {(aiAnalysis.greenFlags.length > 0 || aiAnalysis.redFlags.length > 0) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {aiAnalysis.greenFlags.length > 0 && (
                      <div style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-green)", marginBottom: 8 }}>🟢 Green Flags</div>
                        {aiAnalysis.greenFlags.map((f, i) => (
                          <div key={i} style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5, lineHeight: 1.5 }}>• {f}</div>
                        ))}
                      </div>
                    )}
                    {aiAnalysis.redFlags.length > 0 && (
                      <div style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-red)", marginBottom: 8 }}>🔴 Red Flags</div>
                        {aiAnalysis.redFlags.map((f, i) => (
                          <div key={i} style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5, lineHeight: 1.5 }}>• {f}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recent Developments */}
                <div style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-yellow)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Activity size={13} /> Recent Developments & Catalysts
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{aiAnalysis.recentDevelopments}</p>
                </div>

                {/* Competitive Position */}
                <div style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-purple)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Shield size={13} /> Competitive Position & Moat
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{aiAnalysis.competitivePosition}</p>
                </div>

                {/* Disclaimer */}
                <div style={{ padding: "10px 14px", background: "rgba(210,153,34,.05)", border: "1px solid rgba(210,153,34,.15)", borderRadius: 8, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
                  ⚠️ <strong>AI Disclaimer:</strong> {aiAnalysis.disclaimer}
                </div>

                <button onClick={fetchAIAnalysis} style={{ alignSelf: "flex-start", padding: "7px 16px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <RefreshCw size={12} /> Regenerate Analysis
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
