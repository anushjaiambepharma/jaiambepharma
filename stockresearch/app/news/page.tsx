"use client";
import { useState } from "react";
import { NEWS_ARTICLES, STOCKS, SECTORS } from "@/lib/mock-data";
import { formatRelativeTime } from "@/lib/utils";
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Newspaper,
  ExternalLink,
  X,
} from "lucide-react";

type SentimentFilter = "all" | "positive" | "negative" | "neutral";

export default function NewsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSentiment, setSelectedSentiment] = useState<SentimentFilter>("all");
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");

  const allTopics = Array.from(new Set(NEWS_ARTICLES.map((a) => a.topic))).sort();
  const allSources = Array.from(new Set(NEWS_ARTICLES.map((a) => a.source))).sort();

  const filtered = NEWS_ARTICLES.filter((article) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      article.title.toLowerCase().includes(q) ||
      article.summary.toLowerCase().includes(q) ||
      article.tickers.some((t) => t.toLowerCase().includes(q)) ||
      article.source.toLowerCase().includes(q);
    const matchesSentiment =
      selectedSentiment === "all" || article.sentiment === selectedSentiment;
    const matchesTopic = selectedTopic === "all" || article.topic === selectedTopic;
    const matchesSource = selectedSource === "all" || article.source === selectedSource;
    return matchesSearch && matchesSentiment && matchesTopic && matchesSource;
  });

  const positiveCount = NEWS_ARTICLES.filter((a) => a.sentiment === "positive").length;
  const negativeCount = NEWS_ARTICLES.filter((a) => a.sentiment === "negative").length;
  const neutralCount = NEWS_ARTICLES.filter((a) => a.sentiment === "neutral").length;

  const sentimentColor = (s: string) =>
    s === "positive"
      ? "var(--accent-green)"
      : s === "negative"
      ? "var(--accent-red)"
      : "var(--muted)";

  const sentimentBg = (s: string) =>
    s === "positive"
      ? "rgba(63,185,80,0.1)"
      : s === "negative"
      ? "rgba(248,81,73,0.1)"
      : "rgba(139,148,158,0.1)";

  const sentimentBorder = (s: string) =>
    s === "positive"
      ? "rgba(63,185,80,0.3)"
      : s === "negative"
      ? "rgba(248,81,73,0.3)"
      : "rgba(139,148,158,0.25)";

  const credibilityLabel = (c: string) =>
    c === "high" ? "✓ High Credibility" : c === "medium" ? "⚡ Medium" : "⚠ Low";
  const credibilityColor = (c: string) =>
    c === "high"
      ? "var(--accent-green)"
      : c === "medium"
      ? "var(--accent-yellow)"
      : "var(--accent-red)";

  const activeFilters =
    (selectedSentiment !== "all" ? 1 : 0) +
    (selectedTopic !== "all" ? 1 : 0) +
    (selectedSource !== "all" ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedSentiment("all");
    setSelectedTopic("all");
    setSelectedSource("all");
    setSearchQuery("");
  };

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(88,166,255,0.12)",
              border: "1px solid rgba(88,166,255,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Newspaper size={20} color="var(--accent-blue)" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>
              News Hub
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              Market news, analyst views & regulatory updates — curated for Indian equities
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Articles", value: NEWS_ARTICLES.length, color: "var(--accent-blue)", icon: <Newspaper size={14} /> },
          { label: "Positive", value: positiveCount, color: "var(--accent-green)", icon: <TrendingUp size={14} /> },
          { label: "Negative", value: negativeCount, color: "var(--accent-red)", icon: <TrendingDown size={14} /> },
          { label: "Neutral", value: neutralCount, color: "var(--muted)", icon: <Filter size={14} /> },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: `${stat.color}18`,
                border: `1px solid ${stat.color}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: stat.color,
                flexShrink: 0,
              }}
            >
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Search + clear */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={15}
              color="var(--muted)"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              placeholder="Search headlines, tickers, sources…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "9px 12px 9px 36px",
                fontSize: 13,
                color: "var(--foreground)",
                outline: "none",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {activeFilters > 0 && (
            <button
              onClick={clearAllFilters}
              style={{
                background: "rgba(248,81,73,0.1)",
                border: "1px solid rgba(248,81,73,0.3)",
                borderRadius: 7,
                padding: "8px 14px",
                fontSize: 12,
                color: "var(--accent-red)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
              }}
            >
              <X size={12} /> Clear ({activeFilters})
            </button>
          )}
        </div>

        {/* Sentiment Filters + Dropdowns */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, flexShrink: 0 }}>
            Sentiment:
          </span>
          {(["all", "positive", "negative", "neutral"] as SentimentFilter[]).map((s) => {
            const active = selectedSentiment === s;
            const color =
              s === "all"
                ? "var(--accent-blue)"
                : s === "positive"
                ? "var(--accent-green)"
                : s === "negative"
                ? "var(--accent-red)"
                : "var(--muted)";
            const count =
              s === "all"
                ? NEWS_ARTICLES.length
                : s === "positive"
                ? positiveCount
                : s === "negative"
                ? negativeCount
                : neutralCount;
            return (
              <button
                key={s}
                onClick={() => setSelectedSentiment(s)}
                style={{
                  background: active ? `${color}18` : "var(--background)",
                  border: `1px solid ${active ? color : "var(--border)"}`,
                  borderRadius: 6,
                  padding: "5px 11px",
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  color: active ? color : "var(--muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s",
                  textTransform: "capitalize",
                }}
              >
                {s === "all" ? "All" : s}
                <span
                  style={{
                    background: active ? color : "var(--border)",
                    color: active ? "#fff" : "var(--muted)",
                    borderRadius: 10,
                    padding: "0px 6px",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: 7,
                padding: "7px 12px",
                fontSize: 12,
                color: selectedTopic !== "all" ? "var(--accent-purple)" : "var(--muted)",
                cursor: "pointer",
                outline: "none",
                fontWeight: selectedTopic !== "all" ? 700 : 400,
              }}
            >
              <option value="all">All Topics</option>
              {allTopics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: 7,
                padding: "7px 12px",
                fontSize: 12,
                color: selectedSource !== "all" ? "var(--accent-purple)" : "var(--muted)",
                cursor: "pointer",
                outline: "none",
                fontWeight: selectedSource !== "all" ? 700 : 400,
              }}
            >
              <option value="all">All Sources</option>
              {allSources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results summary */}
      <div
        style={{
          fontSize: 12,
          color: "var(--muted)",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Newspaper size={13} />
        Showing <strong style={{ color: "var(--foreground)" }}>{filtered.length}</strong> of{" "}
        {NEWS_ARTICLES.length} articles
        {activeFilters > 0 && (
          <span style={{ color: "var(--accent-yellow)" }}>· {activeFilters} filter{activeFilters > 1 ? "s" : ""} active</span>
        )}
      </div>

      {/* News Grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 14,
          }}
        >
          <Newspaper size={40} color="var(--border)" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No articles found</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
            Try adjusting your search or filters
          </div>
          <button
            onClick={clearAllFilters}
            style={{
              background: "rgba(88,166,255,0.12)",
              border: "1px solid rgba(88,166,255,0.3)",
              borderRadius: 8,
              padding: "9px 20px",
              fontSize: 13,
              color: "var(--accent-blue)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          {filtered.map((article) => (
            <div
              key={article.id}
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor =
                  article.sentiment === "positive"
                    ? "rgba(63,185,80,0.4)"
                    : article.sentiment === "negative"
                    ? "rgba(248,81,73,0.35)"
                    : "rgba(88,166,255,0.3)";
                el.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "var(--border)";
                el.style.boxShadow = "none";
              }}
            >
              {/* Badges row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {/* Sentiment badge */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: sentimentColor(article.sentiment),
                    background: sentimentBg(article.sentiment),
                    border: `1px solid ${sentimentBorder(article.sentiment)}`,
                    borderRadius: 5,
                    padding: "2px 8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {article.sentiment === "positive" ? (
                    <TrendingUp size={10} />
                  ) : article.sentiment === "negative" ? (
                    <TrendingDown size={10} />
                  ) : null}
                  {article.sentiment}
                </span>

                {/* Topic badge */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--accent-purple)",
                    background: "rgba(188,140,255,0.1)",
                    border: "1px solid rgba(188,140,255,0.25)",
                    borderRadius: 5,
                    padding: "2px 8px",
                  }}
                >
                  {article.topic}
                </span>

                {/* Ticker chips */}
                {article.tickers.map((ticker) => (
                  <span
                    key={ticker}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--accent-blue)",
                      background: "rgba(88,166,255,0.1)",
                      border: "1px solid rgba(88,166,255,0.2)",
                      borderRadius: 4,
                      padding: "2px 7px",
                      fontFamily: "monospace",
                    }}
                  >
                    {ticker}
                  </span>
                ))}
              </div>

              {/* Headline */}
              <div>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--foreground)",
                    margin: 0,
                    lineHeight: 1.45,
                  }}
                >
                  {article.title}
                </h3>
              </div>

              {/* Summary */}
              <p
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  lineHeight: 1.6,
                  margin: 0,
                  flex: 1,
                }}
              >
                {article.summary}
              </p>

              {/* Footer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--foreground)",
                    }}
                  >
                    {article.source}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>·</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {formatRelativeTime(article.publishedAt)}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: credibilityColor(article.credibility),
                      background: `${credibilityColor(article.credibility)}15`,
                      border: `1px solid ${credibilityColor(article.credibility)}30`,
                      borderRadius: 4,
                      padding: "1px 7px",
                    }}
                  >
                    {credibilityLabel(article.credibility)}
                  </span>
                </div>

                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--accent-blue)",
                    textDecoration: "none",
                    background: "rgba(88,166,255,0.08)",
                    border: "1px solid rgba(88,166,255,0.2)",
                    borderRadius: 6,
                    padding: "4px 10px",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(88,166,255,0.18)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(88,166,255,0.08)";
                  }}
                >
                  Read Original <ExternalLink size={11} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom disclaimer */}
      <div
        style={{
          marginTop: 32,
          padding: "12px 18px",
          background: "rgba(139,148,158,0.05)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 11,
          color: "var(--muted)",
          textAlign: "center",
        }}
      >
        News articles are sourced from public financial media. Credibility ratings are indicative only.
        This is not investment advice. Always verify information from official sources before making decisions.
      </div>
    </div>
  );
}
