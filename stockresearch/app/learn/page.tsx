"use client";
import { useState } from "react";
import { LEARNING_MODULES } from "@/lib/mock-data";
import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  Award,
  Clock,
  Target,
  CheckCircle,
  PlayCircle,
  Lightbulb,
} from "lucide-react";

const COMPLETED_MODULE_IDS = ["lm1", "lm2"];

const ratioQuickRef = [
  { ratio: "P/E", formula: "Price / EPS", good: "< 25x (varies by sector)", note: "Valuation" },
  { ratio: "P/B", formula: "Price / Book Value", good: "< 3x (banks < 2x)", note: "Valuation" },
  { ratio: "ROE", formula: "Net Profit / Equity × 100", good: "> 15%", note: "Profitability" },
  { ratio: "ROCE", formula: "EBIT / Capital Employed × 100", good: "> 15%", note: "Profitability" },
  { ratio: "D/E", formula: "Total Debt / Equity", good: "< 1x (ideally 0)", note: "Leverage" },
];

const quickTips = [
  { icon: "📌", tip: "Always read the annual report — particularly the MD&A section" },
  { icon: "🔍", tip: "Compare a stock's P/E to its own 5-year average, not just the sector" },
  { icon: "📊", tip: "Track promoter holding changes quarterly — they know the business best" },
  { icon: "⚠️", tip: "High ROE with high debt is a warning sign — use DuPont to decompose it" },
  { icon: "📅", tip: "Check if earnings are growing — P/E is meaningless without growth context" },
];

export default function LearnPage() {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const activeModule = LEARNING_MODULES.find((m) => m.id === selectedModule) ?? null;

  const levelColor = (level: string) =>
    level === "beginner"
      ? "var(--accent-green)"
      : level === "intermediate"
      ? "var(--accent-yellow)"
      : "var(--accent-red)";

  const levelBg = (level: string) =>
    level === "beginner"
      ? "rgba(63,185,80,0.1)"
      : level === "intermediate"
      ? "rgba(210,153,34,0.1)"
      : "rgba(248,81,73,0.1)";

  const levelBorder = (level: string) =>
    level === "beginner"
      ? "rgba(63,185,80,0.3)"
      : level === "intermediate"
      ? "rgba(210,153,34,0.3)"
      : "rgba(248,81,73,0.3)";

  const completedCount = COMPLETED_MODULE_IDS.length;
  const totalCount = LEARNING_MODULES.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(188,140,255,0.12)",
              border: "1px solid rgba(188,140,255,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BookOpen size={20} color="var(--accent-purple)" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>
              Research Coach
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              Master fundamental analysis concepts with guided modules
            </p>
          </div>
        </div>
      </div>

      {/* Progress Tracker */}
      <div
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 50,
            background: "rgba(227,179,65,0.12)",
            border: "1px solid rgba(227,179,65,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Award size={20} color="var(--accent-gold)" />
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700 }}>Learning Progress</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              <span style={{ color: "var(--accent-gold)", fontWeight: 700 }}>{completedCount}</span> of{" "}
              <span style={{ fontWeight: 700 }}>{totalCount}</span> modules completed
            </div>
          </div>
          <div
            style={{
              height: 6,
              background: "var(--border)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, var(--accent-gold), var(--accent-yellow))",
                borderRadius: 3,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            {progressPct}% complete — keep going!
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        {/* Left Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Module List */}
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Target size={14} color="var(--accent-purple)" />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Learning Modules</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  color: "var(--muted)",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "1px 8px",
                }}
              >
                {LEARNING_MODULES.length} total
              </span>
            </div>

            <div>
              {LEARNING_MODULES.map((module) => {
                const isActive = selectedModule === module.id;
                const isCompleted = COMPLETED_MODULE_IDS.includes(module.id);
                return (
                  <button
                    key={module.id}
                    onClick={() => {
                      setSelectedModule(module.id === selectedModule ? null : module.id);
                      setExpandedSection(null);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: isActive ? "rgba(88,166,255,0.06)" : "none",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      borderLeft: isActive ? "3px solid var(--accent-blue)" : "3px solid transparent",
                      padding: "14px 16px 14px 14px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = "none";
                      }
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isCompleted ? (
                          <CheckCircle size={14} color="var(--accent-green)" style={{ flexShrink: 0 }} />
                        ) : (
                          <PlayCircle
                            size={14}
                            color={isActive ? "var(--accent-blue)" : "var(--muted)"}
                            style={{ flexShrink: 0 }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: isActive ? "var(--foreground)" : "var(--foreground)",
                            lineHeight: 1.3,
                          }}
                        >
                          {module.title}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: levelColor(module.level),
                          background: levelBg(module.level),
                          border: `1px solid ${levelBorder(module.level)}`,
                          borderRadius: 4,
                          padding: "2px 7px",
                          textTransform: "uppercase",
                          flexShrink: 0,
                        }}
                      >
                        {module.level}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 22 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          color: "var(--muted)",
                        }}
                      >
                        <Clock size={11} /> {module.duration} min
                      </div>
                      <span style={{ color: "var(--border)" }}>·</span>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {module.topics.join(", ")}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ratio Quick Reference */}
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Lightbulb size={14} color="var(--accent-gold)" />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Ratio Quick Reference</span>
            </div>

            <div style={{ padding: "4px 0" }}>
              {ratioQuickRef.map((row, idx) => (
                <div
                  key={row.ratio}
                  style={{
                    padding: "10px 16px",
                    borderBottom:
                      idx < ratioQuickRef.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "var(--accent-blue)",
                        fontFamily: "monospace",
                      }}
                    >
                      {row.ratio}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: "var(--accent-purple)",
                        background: "rgba(188,140,255,0.1)",
                        border: "1px solid rgba(188,140,255,0.2)",
                        borderRadius: 3,
                        padding: "1px 6px",
                      }}
                    >
                      {row.note}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
                    {row.formula}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--accent-green)",
                      fontWeight: 600,
                    }}
                  >
                    ✓ {row.good}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div>
          {activeModule === null ? (
            /* Welcome Screen */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Welcome Banner */}
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(188,140,255,0.08) 0%, rgba(88,166,255,0.06) 100%)",
                  border: "1px solid rgba(188,140,255,0.2)",
                  borderRadius: 14,
                  padding: "28px 32px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <BookOpen size={28} color="var(--accent-purple)" />
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                      Welcome to Research Coach
                    </h2>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, marginTop: 2 }}>
                      Select a module from the left to start learning
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7, margin: 0 }}>
                  These modules are designed to help you build a rigorous research process —
                  from reading financial ratios to analyzing corporate filings. Each module is
                  concise, practical, and grounded in Indian market context.
                </p>
              </div>

              {/* Why Research Matters */}
              <div
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "20px 24px",
                }}
              >
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Target size={16} color="var(--accent-blue)" />
                  Why Research Matters
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 14,
                  }}
                >
                  {[
                    {
                      title: "Avoid Value Traps",
                      desc: "A cheap P/E on a business with falling earnings or high debt isn't a bargain — research helps you spot the difference.",
                      color: "var(--accent-red)",
                    },
                    {
                      title: "Find Compounders",
                      desc: "High ROE + low debt + reinvestment at high returns = the compounding engine. Research teaches you where to look.",
                      color: "var(--accent-green)",
                    },
                    {
                      title: "Build Conviction",
                      desc: "Without a thesis, you'll panic-sell on every dip. Research gives you conviction to hold through volatility.",
                      color: "var(--accent-blue)",
                    },
                  ].map((card) => (
                    <div
                      key={card.title}
                      style={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: "16px",
                        borderTop: `3px solid ${card.color}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          marginBottom: 8,
                          color: card.color,
                        }}
                      >
                        {card.title}
                      </div>
                      <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
                        {card.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Tips */}
              <div
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "20px 24px",
                }}
              >
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    marginBottom: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Lightbulb size={16} color="var(--accent-gold)" />
                  Quick Research Tips
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {quickTips.map((tip, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "10px 14px",
                        background: "var(--background)",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{tip.icon}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                        {tip.tip}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Start */}
              <div
                style={{
                  background: "rgba(63,185,80,0.05)",
                  border: "1px solid rgba(63,185,80,0.2)",
                  borderRadius: 10,
                  padding: "14px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <CheckCircle size={18} color="var(--accent-green)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    Suggested starting point
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Begin with{" "}
                    <button
                      onClick={() => setSelectedModule("lm1")}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent-blue)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      Understanding P/E Ratio
                    </button>{" "}
                    — the most fundamental valuation metric
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Module Detail View */
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {/* Module Header */}
              <div
                style={{
                  padding: "24px 28px",
                  borderBottom: "1px solid var(--border)",
                  background: "linear-gradient(135deg, rgba(88,166,255,0.04) 0%, transparent 100%)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: levelColor(activeModule.level),
                      background: levelBg(activeModule.level),
                      border: `1px solid ${levelBorder(activeModule.level)}`,
                      borderRadius: 5,
                      padding: "3px 10px",
                      textTransform: "uppercase",
                    }}
                  >
                    {activeModule.level}
                  </span>
                  {COMPLETED_MODULE_IDS.includes(activeModule.id) && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--accent-green)",
                        background: "rgba(63,185,80,0.1)",
                        border: "1px solid rgba(63,185,80,0.3)",
                        borderRadius: 5,
                        padding: "3px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <CheckCircle size={11} /> Completed
                    </span>
                  )}
                </div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    marginBottom: 8,
                    letterSpacing: "-0.3px",
                  }}
                >
                  {activeModule.title}
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--muted)",
                    lineHeight: 1.6,
                    marginBottom: 16,
                  }}
                >
                  {activeModule.description}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    <Clock size={13} /> {activeModule.duration} min read
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {activeModule.topics.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 11,
                          color: "var(--accent-purple)",
                          background: "rgba(188,140,255,0.1)",
                          border: "1px solid rgba(188,140,255,0.2)",
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontWeight: 600,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Content Sections */}
              <div style={{ padding: "16px 0" }}>
                {activeModule.content.map((section, idx) => {
                  const isExpanded = expandedSection === `${activeModule.id}-${idx}`;
                  return (
                    <div
                      key={idx}
                      style={{
                        borderBottom:
                          idx < activeModule.content.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                      }}
                    >
                      <button
                        onClick={() =>
                          setExpandedSection(
                            isExpanded ? null : `${activeModule.id}-${idx}`
                          )
                        }
                        style={{
                          width: "100%",
                          textAlign: "left",
                          background: isExpanded
                            ? "rgba(88,166,255,0.04)"
                            : "none",
                          border: "none",
                          padding: "16px 28px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          if (!isExpanded) {
                            (e.currentTarget as HTMLElement).style.background =
                              "rgba(255,255,255,0.02)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isExpanded) {
                            (e.currentTarget as HTMLElement).style.background = "none";
                          }
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              background: isExpanded
                                ? "rgba(88,166,255,0.15)"
                                : "var(--background)",
                              border: "1px solid var(--border)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 700,
                              color: isExpanded ? "var(--accent-blue)" : "var(--muted)",
                              flexShrink: 0,
                            }}
                          >
                            {idx + 1}
                          </div>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: isExpanded ? "var(--foreground)" : "var(--foreground)",
                            }}
                          >
                            {section.section}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown size={16} color="var(--accent-blue)" />
                        ) : (
                          <ChevronRight size={16} color="var(--muted)" />
                        )}
                      </button>

                      {isExpanded && (
                        <div
                          style={{
                            padding: "0 28px 20px 28px",
                            paddingLeft: 62,
                          }}
                        >
                          <div
                            style={{
                              background: "var(--background)",
                              border: "1px solid var(--border)",
                              borderLeft: "3px solid var(--accent-blue)",
                              borderRadius: 8,
                              padding: "16px 20px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 13,
                                color: "var(--muted)",
                                lineHeight: 1.8,
                                margin: 0,
                                whiteSpace: "pre-line",
                              }}
                            >
                              {section.text}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Navigation Footer */}
              <div
                style={{
                  padding: "16px 28px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(255,255,255,0.01)",
                }}
              >
                <button
                  onClick={() => {
                    const idx = LEARNING_MODULES.findIndex((m) => m.id === activeModule.id);
                    if (idx > 0) {
                      setSelectedModule(LEARNING_MODULES[idx - 1].id);
                      setExpandedSection(null);
                    }
                  }}
                  disabled={LEARNING_MODULES.findIndex((m) => m.id === activeModule.id) === 0}
                  style={{
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    color:
                      LEARNING_MODULES.findIndex((m) => m.id === activeModule.id) === 0
                        ? "var(--border)"
                        : "var(--muted)",
                    cursor:
                      LEARNING_MODULES.findIndex((m) => m.id === activeModule.id) === 0
                        ? "not-allowed"
                        : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  ← Previous
                </button>

                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {LEARNING_MODULES.findIndex((m) => m.id === activeModule.id) + 1} /{" "}
                  {LEARNING_MODULES.length}
                </div>

                <button
                  onClick={() => {
                    const idx = LEARNING_MODULES.findIndex((m) => m.id === activeModule.id);
                    if (idx < LEARNING_MODULES.length - 1) {
                      setSelectedModule(LEARNING_MODULES[idx + 1].id);
                      setExpandedSection(null);
                    }
                  }}
                  disabled={
                    LEARNING_MODULES.findIndex((m) => m.id === activeModule.id) ===
                    LEARNING_MODULES.length - 1
                  }
                  style={{
                    background:
                      LEARNING_MODULES.findIndex((m) => m.id === activeModule.id) ===
                      LEARNING_MODULES.length - 1
                        ? "var(--background)"
                        : "rgba(88,166,255,0.1)",
                    border:
                      LEARNING_MODULES.findIndex((m) => m.id === activeModule.id) ===
                      LEARNING_MODULES.length - 1
                        ? "1px solid var(--border)"
                        : "1px solid rgba(88,166,255,0.3)",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    color:
                      LEARNING_MODULES.findIndex((m) => m.id === activeModule.id) ===
                      LEARNING_MODULES.length - 1
                        ? "var(--border)"
                        : "var(--accent-blue)",
                    cursor:
                      LEARNING_MODULES.findIndex((m) => m.id === activeModule.id) ===
                      LEARNING_MODULES.length - 1
                        ? "not-allowed"
                        : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
