"use client";
import { useState, use } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Star, StarOff, FileText, BookOpen,
  BarChart2, Globe, AlertTriangle, ChevronDown, ChevronUp,
  CheckSquare, Square, PenLine, ExternalLink, Activity
} from "lucide-react";
import {
  getStockByTicker, getNewsByTicker, getFilingsByTicker,
  getPeersByTicker, FINANCIAL_DATA, formatPrice, formatCrore, STOCKS
} from "@/lib/mock-data";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis
} from "recharts";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart2 },
  { id: "news", label: "News", icon: Activity },
  { id: "fundamentals", label: "Fundamentals", icon: TrendingUp },
  { id: "filings", label: "Filings", icon: FileText },
  { id: "peers", label: "Peer Comparison", icon: Globe },
  { id: "checklist", label: "Research Checklist", icon: CheckSquare },
  { id: "notes", label: "My Notes", icon: PenLine },
];

const RESEARCH_CHECKLIST = [
  { section: "Business Understanding", items: ["What does the company do (business model)?", "What are its revenue streams?", "What is its competitive moat?", "Who are the key customers?", "What is the addressable market size?"] },
  { section: "Financial Health", items: ["Revenue growth trend (3-5 years)?", "Profit growth trend (3-5 years)?", "Is ROCE > Cost of Capital?", "Is Debt/Equity acceptable for the industry?", "Free Cash Flow positive and growing?"] },
  { section: "Management Quality", items: ["Promoter holding trend (stable/increasing)?", "Management track record (past promises kept)?", "Any pledging of shares by promoters?", "Corporate governance score?", "Insider trades (buying = bullish signal)?"] },
  { section: "Valuation", items: ["Current P/E vs. historical P/E?", "Current P/E vs. sector P/E?", "PEG Ratio < 1 (fair value)?", "DCF value vs. current price?", "P/B ratio reasonable?"] },
  { section: "Risks", items: ["Regulatory/policy risks identified?", "Competition threats mapped?", "Commodity/input cost exposure?", "Currency risk (export/import mix)?", "Key-person risk?"] },
];

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || "var(--foreground)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ShareholdingBar({ promoter, fii, dii, pub }: { promoter: number; fii: number; dii: number; pub: number }) {
  const segments = [
    { label: "Promoter", value: promoter, color: "var(--accent-blue)" },
    { label: "FII", value: fii, color: "var(--accent-purple)" },
    { label: "DII", value: dii, color: "var(--accent-green)" },
    { label: "Public", value: pub, color: "var(--muted)" },
  ];
  return (
    <div>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
        {segments.map((seg) => (
          <div key={seg.label} style={{ width: `${seg.value}%`, background: seg.color }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {segments.map((seg) => (
          <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }} />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{seg.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>{seg.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CompanyPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const stock = getStockByTicker(ticker.toUpperCase());
  const [activeTab, setActiveTab] = useState("overview");
  const [watchlisted, setWatchlisted] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [noteText, setNoteText] = useState("");
  const [bullCase, setBullCase] = useState("");
  const [bearCase, setBearCase] = useState("");

  if (!stock) {
    return (
      <div style={{ maxWidth: 900, margin: "80px auto", textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Company not found</h2>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          "{ticker}" is not in our database. Try searching for a different company.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Available companies:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 600 }}>
            {STOCKS.map((s) => (
              <Link key={s.ticker} href={`/company/${s.ticker}`} style={{
                padding: "4px 12px", background: "var(--card-bg)", border: "1px solid var(--border)",
                borderRadius: 6, fontSize: 12, color: "var(--accent-blue)", textDecoration: "none", fontFamily: "monospace"
              }}>
                {s.ticker}
              </Link>
            ))}
          </div>
        </div>
        <Link href="/" style={{ display: "inline-block", marginTop: 24, color: "var(--accent-blue)", textDecoration: "none" }}>← Back to Dashboard</Link>
      </div>
    );
  }

  const news = getNewsByTicker(stock.ticker);
  const filings = getFilingsByTicker(stock.ticker);
  const peers = getPeersByTicker(stock.ticker);
  const financials = FINANCIAL_DATA[stock.ticker];
  const isUp = stock.changePct >= 0;

  const toggleCheck = (item: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const totalItems = RESEARCH_CHECKLIST.reduce((sum, s) => sum + s.items.length, 0);
  const completedItems = checkedItems.size;
  const progressPct = Math.round((completedItems / totalItems) * 100);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 13, color: "var(--muted)" }}>
        <Link href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>Dashboard</Link>
        <span>/</span>
        <span style={{ color: "var(--foreground)" }}>{stock.name}</span>
      </div>

      {/* Stock Header */}
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 800, color: "var(--accent-blue)", background: "rgba(88,166,255,.1)", border: "1px solid rgba(88,166,255,.25)", borderRadius: 6, padding: "3px 10px", letterSpacing: "0.05em" }}>
                {stock.ticker}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 8px" }}>{stock.exchange}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 8px" }}>{stock.sector}</div>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--foreground)", marginBottom: 4 }}>{stock.name}</h1>
            <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 600, lineHeight: 1.6 }}>{stock.description}</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "monospace" }}>{formatPrice(stock.price)}</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 16, fontWeight: 700,
              color: isUp ? "var(--accent-green)" : "var(--accent-red)",
              background: isUp ? "rgba(63,185,80,.1)" : "rgba(248,81,73,.1)",
              border: `1px solid ${isUp ? "rgba(63,185,80,.3)" : "rgba(248,81,73,.3)"}`,
              borderRadius: 8, padding: "4px 12px",
            }}>
              {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {isUp ? "+" : ""}{stock.change.toFixed(2)} ({isUp ? "+" : ""}{stock.changePct.toFixed(2)}%)
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              52W: ₹{stock.low52w.toLocaleString("en-IN")} – ₹{stock.high52w.toLocaleString("en-IN")}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setWatchlisted(!watchlisted)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: watchlisted ? "rgba(227,179,65,.1)" : "var(--background)",
                  border: `1px solid ${watchlisted ? "rgba(227,179,65,.4)" : "var(--border)"}`,
                  borderRadius: 8, padding: "8px 14px",
                  fontSize: 13, color: watchlisted ? "var(--accent-gold)" : "var(--muted)",
                  cursor: "pointer", fontWeight: 600,
                }}>
                {watchlisted ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
                {watchlisted ? "Watchlisted" : "Add to Watchlist"}
              </button>
            </div>
          </div>
        </div>

        {/* Quick metrics row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginTop: 20 }}>
          <MetricCard label="Market Cap" value={formatCrore(stock.marketCap)} sub={`${stock.exchange}`} />
          <MetricCard label="P/E Ratio" value={stock.pe.toFixed(1) + "x"} sub="Price / Earnings" />
          <MetricCard label="P/B Ratio" value={stock.pb.toFixed(1) + "x"} sub="Price / Book" />
          <MetricCard label="ROE" value={stock.roe.toFixed(1) + "%"} color={stock.roe > 15 ? "var(--accent-green)" : stock.roe > 10 ? "var(--accent-yellow)" : "var(--accent-red)"} sub="Return on Equity" />
          <MetricCard label="ROCE" value={stock.roce.toFixed(1) + "%"} color={stock.roce > 15 ? "var(--accent-green)" : "var(--accent-yellow)"} sub="Return on Capital" />
          <MetricCard label="Debt / Equity" value={stock.debtToEquity.toFixed(2)} color={stock.debtToEquity < 0.5 ? "var(--accent-green)" : stock.debtToEquity < 1 ? "var(--accent-yellow)" : "var(--accent-red)"} sub="Leverage ratio" />
          <MetricCard label="EPS" value={`₹${stock.eps.toFixed(2)}`} sub="Earnings Per Share" />
          <MetricCard label="Dividend Yield" value={`${stock.dividendYield.toFixed(2)}%`} sub="Annual yield" />
          <MetricCard label="Volume" value={(stock.volume / 1e5).toFixed(1) + "L"} sub={`Avg: ${(stock.avgVolume / 1e5).toFixed(1)}L`} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0, overflowX: "auto" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === id ? "2px solid var(--accent-blue)" : "2px solid transparent",
              color: activeTab === id ? "var(--accent-blue)" : "var(--muted)",
              fontSize: 13, fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap" as const,
              marginBottom: -1,
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && financials && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Price Chart */}
          <div style={{ gridColumn: "1 / -1", background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Price History (6 months)</h3>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>NSE · INR</div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={financials.priceHistory}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={isUp ? "#3fb950" : "#f85149"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} interval={29} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} tickFormatter={(v) => `₹${v.toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(value) => [`₹${Number(value).toFixed(2)}`, "Price"]}
                />
                <Area type="monotone" dataKey="price" stroke={isUp ? "#3fb950" : "#f85149"} strokeWidth={2} fill="url(#priceGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quarterly Revenue */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Quarterly Revenue & Profit (₹ Cr)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={financials.quarterlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => `₹${Number(v).toLocaleString("en-IN")} Cr`} />
                <Bar dataKey="revenue" fill="#58a6ff" radius={[3, 3, 0, 0]} name="Revenue" />
                <Bar dataKey="profit" fill="#3fb950" radius={[3, 3, 0, 0]} name="Net Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Annual Revenue */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Annual Revenue Trend (₹ Cr)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={financials.annualRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => `₹${Number(v).toLocaleString("en-IN")} Cr`} />
                <Line type="monotone" dataKey="revenue" stroke="#58a6ff" strokeWidth={2} dot={{ r: 4, fill: "#58a6ff" }} name="Revenue" />
                <Line type="monotone" dataKey="profit" stroke="#3fb950" strokeWidth={2} dot={{ r: 4, fill: "#3fb950" }} name="Profit" />
                <Line type="monotone" dataKey="ebitda" stroke="#bc8cff" strokeWidth={2} dot={{ r: 4, fill: "#bc8cff" }} name="EBITDA" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Shareholding */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Shareholding Pattern</h3>
            <ShareholdingBar
              promoter={stock.promoterHolding}
              fii={stock.fiiHolding}
              dii={stock.diiHolding}
              pub={stock.publicHolding}
            />
            <div style={{ marginTop: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Category", "Dec 2025", "Sep 2025", "Change"].map((h) => (
                      <th key={h} style={{ textAlign: "left", fontSize: 11, color: "var(--muted)", padding: "4px 0", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cat: "Promoter", current: stock.promoterHolding, prev: stock.promoterHolding - 0.2 },
                    { cat: "FII / FPI", current: stock.fiiHolding, prev: stock.fiiHolding + 0.5 },
                    { cat: "DII", current: stock.diiHolding, prev: stock.diiHolding - 0.3 },
                    { cat: "Public", current: stock.publicHolding, prev: stock.publicHolding + 0.1 },
                  ].map((row) => (
                    <tr key={row.cat} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ fontSize: 12, padding: "8px 0", color: "var(--foreground)" }}>{row.cat}</td>
                      <td style={{ fontSize: 12, fontWeight: 700, padding: "8px 0" }}>{row.current.toFixed(2)}%</td>
                      <td style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>{row.prev.toFixed(2)}%</td>
                      <td style={{ fontSize: 12, padding: "8px 0", color: row.current > row.prev ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 600 }}>
                        {row.current > row.prev ? "▲" : "▼"} {Math.abs(row.current - row.prev).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Risks */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
              <AlertTriangle size={14} color="var(--accent-yellow)" /> Key Risk Factors
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {getRisks(stock).map((risk, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", background: "rgba(210,153,34,.05)", border: "1px solid rgba(210,153,34,.2)", borderRadius: 8 }}>
                  <AlertTriangle size={13} color="var(--accent-yellow)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>{risk.title}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{risk.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NEWS TAB */}
      {activeTab === "news" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>
            Showing {news.length} articles related to {stock.ticker} and its sector
          </div>
          {news.map((article) => (
            <div key={article.id} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
                      color: article.sentiment === "positive" ? "var(--accent-green)" : article.sentiment === "negative" ? "var(--accent-red)" : "var(--muted)",
                      background: article.sentiment === "positive" ? "rgba(63,185,80,.1)" : article.sentiment === "negative" ? "rgba(248,81,73,.1)" : "rgba(139,148,158,.1)",
                      border: `1px solid ${article.sentiment === "positive" ? "rgba(63,185,80,.3)" : article.sentiment === "negative" ? "rgba(248,81,73,.3)" : "rgba(139,148,158,.2)"}`,
                      borderRadius: 4, padding: "2px 7px",
                    }}>
                      {article.sentiment}
                    </span>
                    <span style={{ fontSize: 11, background: "var(--background)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 7px", color: "var(--muted)" }}>{article.topic}</span>
                    {article.tickers.map((t) => (
                      <span key={t} style={{ fontSize: 10, background: "rgba(88,166,255,.1)", color: "var(--accent-blue)", borderRadius: 4, padding: "1px 6px", fontFamily: "monospace", fontWeight: 700 }}>{t}</span>
                    ))}
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, lineHeight: 1.45 }}>{article.title}</h3>
                  <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{article.summary}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{article.source}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>· {formatRelativeTime(article.publishedAt)}</span>
                    <span style={{ fontSize: 11, color: article.credibility === "high" ? "var(--accent-green)" : "var(--accent-yellow)", marginLeft: "auto" }}>
                      {article.credibility === "high" ? "✓ High Credibility" : "⚡ Medium Credibility"}
                    </span>
                    <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-blue)", textDecoration: "none" }}>
                      Read <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FUNDAMENTALS TAB */}
      {activeTab === "fundamentals" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Valuation */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--accent-blue)" }}>Valuation Metrics</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  { label: "Market Cap", value: formatCrore(stock.marketCap) },
                  { label: "Current Price", value: formatPrice(stock.price) },
                  { label: "P/E Ratio", value: `${stock.pe.toFixed(1)}x`, note: stock.pe < 20 ? "Cheap" : stock.pe < 30 ? "Fair" : "Expensive" },
                  { label: "P/B Ratio", value: `${stock.pb.toFixed(1)}x` },
                  { label: "EV/EBITDA", value: `${(stock.pe * 0.8).toFixed(1)}x` },
                  { label: "EPS (TTM)", value: `₹${stock.eps.toFixed(2)}` },
                  { label: "Dividend Yield", value: `${stock.dividendYield.toFixed(2)}%` },
                  { label: "Face Value", value: "₹2" },
                ].map((row) => (
                  <tr key={row.label} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "9px 0", fontSize: 12, color: "var(--muted)" }}>{row.label}</td>
                    <td style={{ padding: "9px 0", fontSize: 12, fontWeight: 700, textAlign: "right" as const }}>{row.value}</td>
                    {row.note && <td style={{ padding: "9px 0 9px 8px", fontSize: 11, color: row.note === "Cheap" ? "var(--accent-green)" : row.note === "Fair" ? "var(--accent-yellow)" : "var(--accent-red)" }}>{row.note}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Profitability */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--accent-green)" }}>Profitability Metrics</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  { label: "ROE", value: `${stock.roe.toFixed(1)}%`, good: stock.roe > 15 },
                  { label: "ROCE", value: `${stock.roce.toFixed(1)}%`, good: stock.roce > 15 },
                  { label: "Net Profit Margin", value: `${(stock.eps / (stock.price / stock.pe) * 100 / 100 * 18).toFixed(1)}%`, good: true },
                  { label: "Asset Turnover", value: "0.82x", good: true },
                  { label: "Inventory Turnover", value: "8.4x", good: true },
                  { label: "Interest Coverage", value: "12.3x", good: true },
                ].map((row) => (
                  <tr key={row.label} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "9px 0", fontSize: 12, color: "var(--muted)" }}>{row.label}</td>
                    <td style={{ padding: "9px 0", fontSize: 12, fontWeight: 700, textAlign: "right" as const, color: row.good ? "var(--accent-green)" : "var(--accent-red)" }}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Balance Sheet */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--accent-purple)" }}>Balance Sheet Snapshot</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Item", "FY24 (₹ Cr)", "FY25 (₹ Cr)"].map((h) => (
                    <th key={h} style={{ fontSize: 11, color: "var(--muted)", textAlign: h === "Item" ? "left" as const : "right" as const, padding: "0 0 8px", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { item: "Total Assets", fy24: stock.marketCap * 0.8, fy25: stock.marketCap * 0.9 },
                  { item: "Total Equity", fy24: stock.marketCap * 0.35, fy25: stock.marketCap * 0.38 },
                  { item: "Long-term Debt", fy24: stock.marketCap * 0.2, fy25: stock.marketCap * 0.18 },
                  { item: "Cash & Equiv.", fy24: stock.marketCap * 0.08, fy25: stock.marketCap * 0.1 },
                  { item: "Current Ratio", fy24: 1.42, fy25: 1.58 },
                ].map((row) => (
                  <tr key={row.item} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 0", fontSize: 12, color: "var(--muted)" }}>{row.item}</td>
                    <td style={{ padding: "8px 0", fontSize: 12, textAlign: "right" as const }}>{typeof row.fy24 === "number" && row.fy24 > 10 ? formatCrore(row.fy24) : row.fy24.toFixed(2)}</td>
                    <td style={{ padding: "8px 0", fontSize: 12, fontWeight: 700, textAlign: "right" as const }}>{typeof row.fy25 === "number" && row.fy25 > 10 ? formatCrore(row.fy25) : row.fy25.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 52W Range */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>52-Week Range & Valuation Band</h3>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                <span>52W Low: ₹{stock.low52w.toLocaleString("en-IN")}</span>
                <span>CMP: {formatPrice(stock.price)}</span>
                <span>52W High: ₹{stock.high52w.toLocaleString("en-IN")}</span>
              </div>
              <div style={{ position: "relative", height: 8, background: "var(--border)", borderRadius: 4 }}>
                <div style={{
                  position: "absolute",
                  left: `${((stock.price - stock.low52w) / (stock.high52w - stock.low52w)) * 100}%`,
                  transform: "translateX(-50%)",
                  width: 16, height: 16,
                  background: isUp ? "var(--accent-green)" : "var(--accent-red)",
                  borderRadius: "50%",
                  top: -4,
                  border: "2px solid var(--card-bg)",
                }} />
                <div style={{
                  position: "absolute",
                  left: 0,
                  width: `${((stock.price - stock.low52w) / (stock.high52w - stock.low52w)) * 100}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, var(--accent-red), var(--accent-green))`,
                  borderRadius: 4,
                }} />
              </div>
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                {(((stock.price - stock.low52w) / (stock.high52w - stock.low52w)) * 100).toFixed(0)}% from 52W low
              </div>
            </div>
            <div style={{ padding: "12px", background: "rgba(88,166,255,.05)", border: "1px solid rgba(88,166,255,.2)", borderRadius: 8, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
              💡 <strong>Valuation Context:</strong> At P/E of {stock.pe.toFixed(1)}x,
              {stock.pe < 20 ? " the stock appears reasonably valued vs. historical range." :
                stock.pe < 35 ? " the stock is trading near its fair value range." :
                  " the stock is pricing in significant future growth expectations."}
              Compare with sector average P/E before drawing conclusions.
            </div>
          </div>
        </div>
      )}

      {/* FILINGS TAB */}
      {activeTab === "filings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filings.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
              <FileText size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
              <p>No filings in database for {ticker}. In production, NSE/BSE corporate announcements will appear here.</p>
            </div>
          ) : (
            filings.map((filing) => (
              <div key={filing.id} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: filing.category === "announcement" ? "rgba(88,166,255,.1)" :
                    filing.category === "filings" ? "rgba(188,140,255,.1)" :
                      filing.category === "shareholding" ? "rgba(63,185,80,.1)" : "rgba(248,81,73,.1)",
                  border: `1px solid ${filing.category === "announcement" ? "rgba(88,166,255,.25)" :
                    filing.category === "filings" ? "rgba(188,140,255,.25)" :
                      filing.category === "shareholding" ? "rgba(63,185,80,.25)" : "rgba(248,81,73,.25)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: filing.category === "announcement" ? "var(--accent-blue)" :
                    filing.category === "filings" ? "var(--accent-purple)" :
                      filing.category === "shareholding" ? "var(--accent-green)" : "var(--accent-red)",
                }}>
                  <FileText size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" as const }}>{filing.type}</span>
                    <span style={{ fontSize: 10, background: "var(--background)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 6px", color: "var(--muted)" }}>{filing.exchange}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{filing.title}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{formatDate(filing.date)}</div>
                  <a href={filing.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-blue)", textDecoration: "none", justifyContent: "flex-end" }}>
                    View <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            ))
          )}
          <div style={{ padding: "12px 16px", background: "rgba(88,166,255,.05)", border: "1px solid rgba(88,166,255,.2)", borderRadius: 10, fontSize: 12, color: "var(--muted)" }}>
            📌 In production: Real-time NSE/BSE corporate announcements, SEBI filings, and concall transcripts will be fetched via licensed APIs. Source attribution is always provided.
          </div>
        </div>
      )}

      {/* PEERS TAB */}
      {activeTab === "peers" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Peer Comparison — {stock.sector} Sector</h3>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Compare {stock.name} against {peers.length} sector peers on key metrics</p>
          </div>

          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--background)" }}>
                  {["Company", "Price", "Mkt Cap", "P/E", "P/B", "ROE", "ROCE", "D/E", "Div Yield"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: h === "Company" ? "left" as const : "right" as const, fontSize: 11, color: "var(--muted)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[stock, ...peers].map((s, i) => (
                  <tr key={s.ticker} style={{ borderTop: "1px solid var(--border)", background: i === 0 ? "rgba(88,166,255,.04)" : "none" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {i === 0 && <div style={{ width: 4, height: 20, background: "var(--accent-blue)", borderRadius: 2 }} />}
                        <div>
                          <Link href={`/company/${s.ticker}`} style={{ textDecoration: "none" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "var(--accent-blue)" : "var(--foreground)", fontFamily: "monospace" }}>{s.ticker}</div>
                          </Link>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{s.name.substring(0, 20)}{s.name.length > 20 ? "…" : ""}</div>
                        </div>
                      </div>
                    </td>
                    {[
                      `₹${s.price.toFixed(0)}`,
                      formatCrore(s.marketCap),
                      `${s.pe.toFixed(1)}x`,
                      `${s.pb.toFixed(1)}x`,
                      `${s.roe.toFixed(1)}%`,
                      `${s.roce.toFixed(1)}%`,
                      `${s.debtToEquity.toFixed(2)}`,
                      `${s.dividendYield.toFixed(2)}%`,
                    ].map((val, j) => (
                      <td key={j} style={{ padding: "12px 16px", textAlign: "right" as const, fontSize: 12, fontWeight: i === 0 ? 700 : 400 }}>{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Peer chart */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>ROE vs. P/E Comparison</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[stock, ...peers]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} />
                <YAxis dataKey="ticker" type="category" tick={{ fontSize: 11, fill: "var(--muted)", fontFamily: "monospace" }} tickLine={false} width={80} />
                <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="roe" name="ROE %" radius={[0, 4, 4, 0]} fill="#3fb950">
                  {[stock, ...peers].map((s, i) => (
                    <Cell key={s.ticker} fill={i === 0 ? "#58a6ff" : "#3fb950"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* CHECKLIST TAB */}
      {activeTab === "checklist" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Research Checklist — {stock.ticker}</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Complete all sections before making an investment decision</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: progressPct === 100 ? "var(--accent-green)" : "var(--accent-blue)" }}>{progressPct}%</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{completedItems}/{totalItems} complete</div>
            </div>
          </div>

          <div style={{ height: 6, background: "var(--border)", borderRadius: 3, marginBottom: 24 }}>
            <div style={{ height: "100%", width: `${progressPct}%`, background: progressPct === 100 ? "var(--accent-green)" : "var(--accent-blue)", borderRadius: 3, transition: "width 0.3s ease" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {RESEARCH_CHECKLIST.map((section) => {
              const sectionDone = section.items.filter((item) => checkedItems.has(item)).length;
              return (
                <div key={section.section} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700 }}>{section.section}</h4>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{sectionDone}/{section.items.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {section.items.map((item) => {
                      const checked = checkedItems.has(item);
                      return (
                        <button
                          key={item}
                          onClick={() => toggleCheck(item)}
                          style={{
                            display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 12px",
                            background: checked ? "rgba(63,185,80,.05)" : "var(--background)",
                            border: `1px solid ${checked ? "rgba(63,185,80,.3)" : "var(--border)"}`,
                            borderRadius: 8, cursor: "pointer", textAlign: "left" as const,
                            color: "var(--foreground)", transition: "all 0.15s",
                          }}
                        >
                          {checked
                            ? <CheckSquare size={15} color="var(--accent-green)" style={{ marginTop: 1, flexShrink: 0 }} />
                            : <Square size={15} color="var(--muted)" style={{ marginTop: 1, flexShrink: 0 }} />
                          }
                          <span style={{ fontSize: 13, color: checked ? "var(--muted)" : "var(--foreground)", textDecoration: checked ? "line-through" : "none" }}>
                            {item}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NOTES TAB */}
      {activeTab === "notes" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Research Notes</h3>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={`Write your research notes for ${stock.ticker}...\n\nExample:\n- Revenue growing at 15% CAGR over 5 years\n- ROE consistently above 20% (quality business)\n- Promoter buying in last 3 quarters`}
                style={{
                  width: "100%", height: 220, background: "var(--background)",
                  border: "1px solid var(--border)", borderRadius: 8,
                  padding: 12, fontSize: 13, color: "var(--foreground)",
                  fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" as const,
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{noteText.length} chars</span>
                <button style={{ padding: "8px 16px", background: "var(--accent-blue)", border: "none", borderRadius: 8, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Save Notes
                </button>
              </div>
            </div>

            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--accent-green)" }}>Bull Case</h3>
              <textarea
                value={bullCase}
                onChange={(e) => setBullCase(e.target.value)}
                placeholder={`What could go right for ${stock.ticker}?\n\n- Revenue beats expectations\n- New product/market expansion\n- Sector tailwind...`}
                style={{
                  width: "100%", height: 140, background: "rgba(63,185,80,.04)",
                  border: "1px solid rgba(63,185,80,.2)", borderRadius: 8,
                  padding: 12, fontSize: 13, color: "var(--foreground)",
                  fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" as const,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--accent-red)" }}>Bear Case</h3>
              <textarea
                value={bearCase}
                onChange={(e) => setBearCase(e.target.value)}
                placeholder={`What could go wrong for ${stock.ticker}?\n\n- Margin compression\n- Regulatory headwinds\n- Competition intensifies...`}
                style={{
                  width: "100%", height: 140, background: "rgba(248,81,73,.04)",
                  border: "1px solid rgba(248,81,73,.2)", borderRadius: 8,
                  padding: 12, fontSize: 13, color: "var(--foreground)",
                  fontFamily: "inherit", lineHeight: 1.6, resize: "vertical" as const,
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Research Template</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Target Price", placeholder: "₹2500", color: "var(--accent-green)" },
                  { label: "Stop Loss", placeholder: "₹1800", color: "var(--accent-red)" },
                  { label: "Time Horizon", placeholder: "12-18 months", color: "var(--accent-blue)" },
                  { label: "Conviction Level", placeholder: "High / Medium / Low", color: "var(--accent-yellow)" },
                ].map((field) => (
                  <div key={field.label}>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>{field.label}</label>
                    <input type="text" placeholder={field.placeholder} style={{
                      width: "100%", background: "var(--background)", border: `1px solid var(--border)`,
                      borderRadius: 7, padding: "8px 12px", fontSize: 13, color: "var(--foreground)", outline: "none",
                    }} />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, padding: "12px", background: "rgba(88,166,255,.05)", border: "1px solid rgba(88,166,255,.15)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-blue)", marginBottom: 6 }}>AI SUMMARY</div>
                <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                  {stock.name} ({stock.ticker}) is trading at ₹{stock.price.toFixed(2)} with P/E of {stock.pe.toFixed(1)}x.
                  ROE of {stock.roe.toFixed(1)}% and ROCE of {stock.roce.toFixed(1)}% are
                  {stock.roe > 15 ? " strong indicators of quality business" : " below premium threshold"}.
                  Promoter holding is {stock.promoterHolding > 0 ? `${stock.promoterHolding.toFixed(1)}% (high alignment)` : "nil (institution-controlled)"}.
                  <br /><br />
                  ⚠️ This is an AI-generated educational summary based on mock data. Not investment advice.
                </div>
              </div>
            </div>

            <div style={{ padding: 16, background: "rgba(210,153,34,.06)", border: "1px solid rgba(210,153,34,.2)", borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-yellow)", marginBottom: 8 }}>📋 DISCLAIMER</div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                StockLens is a research and educational tool. Nothing on this platform constitutes investment advice.
                Data shown is mock/demo. Always do your own due diligence and consult a SEBI-registered investment advisor
                before making any investment decisions. Past performance is not indicative of future results.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getRisks(stock: ReturnType<typeof getStockByTicker>) {
  if (!stock) return [];
  const risks = [];
  if (stock.debtToEquity > 1) risks.push({ title: "High Leverage", desc: `Debt/Equity ratio of ${stock.debtToEquity.toFixed(2)}x is elevated. Monitor interest coverage ratio and refinancing risk.` });
  if (stock.pe > 40) risks.push({ title: "Premium Valuation Risk", desc: `P/E of ${stock.pe.toFixed(1)}x prices in significant growth. Any slowdown could lead to sharp de-rating.` });
  if (stock.promoterHolding === 0) risks.push({ title: "No Promoter Holding", desc: "Zero promoter stake means no founding family alignment. Governance depends entirely on board quality and institutional ownership." });
  risks.push({ title: "Market / Macro Risk", desc: "All Indian equities are exposed to RBI rate decisions, global risk-off, USD/INR movements, and crude oil price changes." });
  risks.push({ title: "Regulatory Risk", desc: `${stock.sector} sector faces sector-specific regulations. Changes in policy could impact revenue model or cost structure.` });
  if (risks.length < 3) risks.push({ title: "Competition Risk", desc: "Increasing competition from domestic and global players could compress margins and erode market share over time." });
  return risks.slice(0, 5);
}
