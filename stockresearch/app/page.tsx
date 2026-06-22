"use client";
import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Star, ArrowRight, BookOpen,
  Activity, Plus, BarChart2
} from "lucide-react";
import {
  STOCKS, NEWS_ARTICLES, MARKET_INDICES, DEFAULT_WATCHLIST,
  getStockByTicker, LEARNING_MODULES, FINANCIAL_DATA, formatCrore, formatPrice
} from "@/lib/mock-data";
import { formatRelativeTime } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

export default function DashboardPage() {
  const [watchlist] = useState(DEFAULT_WATCHLIST);

  const watchlistStocks = watchlist
    .map((w) => ({ ...w, stock: getStockByTicker(w.ticker) }))
    .filter((w) => w.stock);

  const topGainers = [...STOCKS].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const topLosers = [...STOCKS].sort((a, b) => a.changePct - b.changePct).slice(0, 5);
  const latestNews = NEWS_ARTICLES.slice(0, 6);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>
      {/* Market Index Bar */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4, marginBottom: 28 }}>
        {MARKET_INDICES.map((idx) => (
          <div key={idx.name} style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "12px 20px",
            flexShrink: 0,
            minWidth: 160,
          }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 4 }}>{idx.name}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{idx.value.toLocaleString("en-IN")}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: idx.changePct >= 0 ? "var(--accent-green)" : "var(--accent-red)", display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
              {idx.changePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {idx.changePct >= 0 ? "+" : ""}{idx.changePct.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Watchlist */}
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Star size={16} color="var(--accent-gold)" fill="var(--accent-gold)" /> My Watchlist
              </h2>
              <button style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 12px", fontSize: 12, color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <Plus size={12} /> Add Stock
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {watchlistStocks.map(({ stock, ticker, targetPrice, notes }) => {
                if (!stock) return null;
                const chartData = FINANCIAL_DATA[ticker]?.priceHistory.slice(-30) || [];
                const isUp = stock.changePct >= 0;
                return (
                  <Link key={ticker} href={`/company/${ticker}`} style={{ textDecoration: "none" }}>
                    <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--accent-blue)"; el.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--border)"; el.style.transform = "none"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-blue)", fontFamily: "monospace" }}>{ticker}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{stock.name.substring(0, 28)}{stock.name.length > 28 ? "…" : ""}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{formatPrice(stock.price)}</div>
                          <div style={{ fontSize: 11, color: isUp ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 600 }}>
                            {isUp ? "▲" : "▼"} {Math.abs(stock.changePct).toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      <div style={{ height: 50, margin: "8px 0" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <Line type="monotone" dataKey="price" stroke={isUp ? "var(--accent-green)" : "var(--accent-red)"} strokeWidth={1.5} dot={false} />
                            <Tooltip contentStyle={{ display: "none" }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>Target: {targetPrice ? `₹${targetPrice.toLocaleString("en-IN")}` : "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>MCap: {formatCrore(stock.marketCap)}</div>
                      </div>
                      {notes && (
                        <div style={{ marginTop: 8, padding: "5px 8px", background: "var(--background)", borderRadius: 5, fontSize: 11, color: "var(--muted)", borderLeft: "2px solid var(--accent-blue)" }}>
                          {notes}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* News */}
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={16} /> Latest Market News
              </h2>
              <Link href="/news" style={{ fontSize: 12, color: "var(--accent-blue)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                News Hub <ArrowRight size={12} />
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {latestNews.map((article) => (
                <div key={article.id} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: article.sentiment === "positive" ? "var(--accent-green)" : article.sentiment === "negative" ? "var(--accent-red)" : "var(--muted)",
                      background: article.sentiment === "positive" ? "rgba(63,185,80,.1)" : article.sentiment === "negative" ? "rgba(248,81,73,.1)" : "rgba(139,148,158,.1)",
                      border: `1px solid ${article.sentiment === "positive" ? "rgba(63,185,80,.3)" : article.sentiment === "negative" ? "rgba(248,81,73,.3)" : "rgba(139,148,158,.2)"}`,
                      borderRadius: 4, padding: "2px 7px", textTransform: "uppercase" as const,
                    }}>
                      {article.sentiment}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{article.topic}</span>
                    {article.tickers.slice(0, 3).map((t) => (
                      <span key={t} style={{ fontSize: 10, background: "rgba(88,166,255,.1)", color: "var(--accent-blue)", borderRadius: 4, padding: "1px 6px", fontFamily: "monospace", fontWeight: 700 }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4, lineHeight: 1.4 }}>{article.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{article.summary.substring(0, 130)}…</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{article.source}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>· {formatRelativeTime(article.publishedAt)}</span>
                    <span style={{ fontSize: 10, color: article.credibility === "high" ? "var(--accent-green)" : "var(--accent-yellow)", marginLeft: "auto" }}>
                      {article.credibility === "high" ? "✓ Verified" : "⚡ Medium"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Top Movers */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-green)", display: "flex", alignItems: "center", gap: 4 }}>
                  <TrendingUp size={12} /> Top Gainers
                </div>
              </div>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-red)", display: "flex", alignItems: "center", gap: 4 }}>
                  <TrendingDown size={12} /> Top Losers
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ borderRight: "1px solid var(--border)" }}>
                {topGainers.map((s) => (
                  <Link key={s.ticker} href={`/company/${s.ticker}`} style={{ textDecoration: "none" }}>
                    <div style={{ padding: "9px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--border)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-blue)", fontFamily: "monospace" }}>{s.ticker}</div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>₹{s.price.toFixed(0)}</div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-green)" }}>+{s.changePct.toFixed(2)}%</div>
                    </div>
                  </Link>
                ))}
              </div>
              <div>
                {topLosers.map((s) => (
                  <Link key={s.ticker} href={`/company/${s.ticker}`} style={{ textDecoration: "none" }}>
                    <div style={{ padding: "9px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--border)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-blue)", fontFamily: "monospace" }}>{s.ticker}</div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>₹{s.price.toFixed(0)}</div>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-red)" }}>{s.changePct.toFixed(2)}%</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Learning */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <BookOpen size={14} /> Research Coach
              </h3>
              <Link href="/learn" style={{ fontSize: 12, color: "var(--accent-blue)", textDecoration: "none" }}>View all →</Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {LEARNING_MODULES.slice(0, 4).map((m) => (
                <Link key={m.id} href="/learn" style={{ textDecoration: "none" }}>
                  <div style={{ padding: "9px 12px", background: "var(--background)", borderRadius: 8, border: "1px solid var(--border)", transition: "border-color 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-blue)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{m.title}</div>
                      <div style={{ fontSize: 10, color: m.level === "beginner" ? "var(--accent-green)" : m.level === "intermediate" ? "var(--accent-yellow)" : "var(--accent-red)", fontWeight: 600, textTransform: "uppercase" as const }}>
                        {m.level}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{m.duration} min · {m.topics.join(", ")}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* All Stocks */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
              <BarChart2 size={14} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>NSE / BSE Stocks</span>
              <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>{STOCKS.length} tracked</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {STOCKS.map((s) => (
                <Link key={s.ticker} href={`/company/${s.ticker}`} style={{ textDecoration: "none" }}>
                  <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--background)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-blue)", fontFamily: "monospace" }}>{s.ticker}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>{s.sector}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>₹{s.price.toFixed(2)}</div>
                      <div style={{ fontSize: 11, color: s.changePct >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 600 }}>
                        {s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
