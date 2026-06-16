"use client";
import { useState } from "react";
import Link from "next/link";
import {
  SAMPLE_NOTES,
  DEFAULT_WATCHLIST,
  getStockByTicker,
  formatCrore,
  formatPrice,
} from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import {
  PenLine,
  Plus,
  Trash2,
  Download,
  Tag,
  Calendar,
  TrendingUp,
  TrendingDown,
  Star,
  BookOpen,
  FileText,
} from "lucide-react";
import type { ResearchNote } from "@/lib/mock-data";

export default function NotebookPage() {
  const [notes, setNotes] = useState<ResearchNote[]>(SAMPLE_NOTES);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteTicker, setNewNoteTicker] = useState("");
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});

  const selectedNote = notes.find((n) => n.id === activeNote) ?? null;

  const handleCreateNote = () => {
    if (!newNoteTitle.trim()) return;
    const newNote: ResearchNote = {
      id: `rn${Date.now()}`,
      ticker: newNoteTicker.trim().toUpperCase(),
      title: newNoteTitle.trim(),
      content: "",
      thesis: "",
      bullCase: "",
      bearCase: "",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [newNote, ...prev]);
    setActiveNote(newNote.id);
    setShowNewNote(false);
    setNewNoteTitle("");
    setNewNoteTicker("");
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNote === id) setActiveNote(null);
  };

  const getContent = (note: ResearchNote) =>
    editedContent[note.id] !== undefined ? editedContent[note.id] : note.content;

  const handleContentChange = (id: string, val: string) => {
    setEditedContent((prev) => ({ ...prev, [id]: val }));
  };

  const watchlistWithStocks = DEFAULT_WATCHLIST.map((w) => ({
    ...w,
    stock: getStockByTicker(w.ticker),
  })).filter((w) => w.stock);

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(227,179,65,0.12)",
              border: "1px solid rgba(227,179,65,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PenLine size={20} color="var(--accent-gold)" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>
              Research Notebook
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
              Your personal investment thesis journal — bull/bear cases, notes, and watchlist insights
            </p>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
        {/* Left Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Sidebar Header */}
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <BookOpen size={14} color="var(--accent-gold)" />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Saved Notes</span>
                <span
                  style={{
                    fontSize: 10,
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "1px 7px",
                    color: "var(--muted)",
                  }}
                >
                  {notes.length}
                </span>
              </div>
              <button
                onClick={() => setShowNewNote((v) => !v)}
                style={{
                  background: showNewNote
                    ? "rgba(248,81,73,0.1)"
                    : "rgba(88,166,255,0.1)",
                  border: showNewNote
                    ? "1px solid rgba(248,81,73,0.3)"
                    : "1px solid rgba(88,166,255,0.3)",
                  borderRadius: 7,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: showNewNote ? "var(--accent-red)" : "var(--accent-blue)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.15s",
                }}
              >
                <Plus size={12} />
                {showNewNote ? "Cancel" : "New Note"}
              </button>
            </div>

            {/* New Note Form */}
            {showNewNote && (
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(88,166,255,0.03)",
                }}
              >
                <input
                  type="text"
                  placeholder="Note title…"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateNote()}
                  style={{
                    width: "100%",
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "var(--foreground)",
                    outline: "none",
                    marginBottom: 8,
                  }}
                />
                <input
                  type="text"
                  placeholder="Ticker (e.g. RELIANCE)"
                  value={newNoteTicker}
                  onChange={(e) => setNewNoteTicker(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateNote()}
                  style={{
                    width: "100%",
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "var(--foreground)",
                    outline: "none",
                    marginBottom: 10,
                    fontFamily: "monospace",
                  }}
                />
                <button
                  onClick={handleCreateNote}
                  disabled={!newNoteTitle.trim()}
                  style={{
                    width: "100%",
                    background: newNoteTitle.trim()
                      ? "rgba(63,185,80,0.12)"
                      : "var(--background)",
                    border: newNoteTitle.trim()
                      ? "1px solid rgba(63,185,80,0.35)"
                      : "1px solid var(--border)",
                    borderRadius: 7,
                    padding: "8px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: newNoteTitle.trim() ? "var(--accent-green)" : "var(--muted)",
                    cursor: newNoteTitle.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Create Note
                </button>
              </div>
            )}

            {/* Notes List */}
            <div style={{ maxHeight: 480, overflowY: "auto" }}>
              {notes.map((note) => {
                const isActive = activeNote === note.id;
                const stock = note.ticker ? getStockByTicker(note.ticker) : undefined;
                return (
                  <div
                    key={note.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      position: "relative",
                    }}
                  >
                    <button
                      onClick={() => setActiveNote(isActive ? null : note.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: isActive ? "rgba(227,179,65,0.06)" : "none",
                        border: "none",
                        borderLeft: isActive
                          ? "3px solid var(--accent-gold)"
                          : "3px solid transparent",
                        padding: "12px 36px 12px 14px",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background =
                            "rgba(255,255,255,0.02)";
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
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        {note.ticker && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: "var(--accent-blue)",
                              fontFamily: "monospace",
                              background: "rgba(88,166,255,0.1)",
                              border: "1px solid rgba(88,166,255,0.2)",
                              borderRadius: 3,
                              padding: "1px 5px",
                            }}
                          >
                            {note.ticker}
                          </span>
                        )}
                        {stock && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color:
                                stock.changePct >= 0
                                  ? "var(--accent-green)"
                                  : "var(--accent-red)",
                            }}
                          >
                            {stock.changePct >= 0 ? "▲" : "▼"}
                            {Math.abs(stock.changePct).toFixed(2)}%
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: isActive ? "var(--foreground)" : "var(--foreground)",
                          lineHeight: 1.3,
                          marginBottom: 4,
                        }}
                      >
                        {note.title}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--muted)",
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <Calendar size={9} />
                          {formatDate(note.updatedAt)}
                        </span>
                        {note.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: 9,
                              color: "var(--accent-purple)",
                              background: "rgba(188,140,255,0.08)",
                              border: "1px solid rgba(188,140,255,0.15)",
                              borderRadius: 3,
                              padding: "1px 5px",
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
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
                        padding: 4,
                        borderRadius: 4,
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--accent-red)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--muted)";
                      }}
                      title="Delete note"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}

              {notes.length === 0 && (
                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: "var(--muted)",
                    fontSize: 13,
                  }}
                >
                  <FileText size={28} color="var(--border)" style={{ marginBottom: 10 }} />
                  <div>No notes yet.</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    Click "New Note" to get started
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div>
          {selectedNote === null ? (
            /* Watchlist Insights */
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "18px 24px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(227,179,65,0.03)",
                }}
              >
                <Star size={16} color="var(--accent-gold)" fill="var(--accent-gold)" />
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                  Watchlist Insights
                </h2>
                <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>
                  — select a note from the sidebar, or review your tracked stocks below
                </span>
              </div>

              <div style={{ padding: "8px 0" }}>
                {watchlistWithStocks.map(({ ticker, stock, targetPrice, notes: wNotes, alertAt }) => {
                  if (!stock) return null;
                  const isUp = stock.changePct >= 0;
                  const targetPct =
                    targetPrice
                      ? (((targetPrice - stock.price) / stock.price) * 100).toFixed(1)
                      : null;
                  return (
                    <div
                      key={ticker}
                      style={{
                        padding: "16px 24px",
                        borderBottom: "1px solid var(--border)",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 16,
                        alignItems: "center",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background =
                          "rgba(255,255,255,0.015)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "none";
                      }}
                    >
                      {/* Stock info */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <Link
                            href={`/company/${ticker}`}
                            style={{
                              fontSize: 15,
                              fontWeight: 800,
                              color: "var(--accent-blue)",
                              fontFamily: "monospace",
                              textDecoration: "none",
                            }}
                          >
                            {ticker}
                          </Link>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: 12,
                              fontWeight: 700,
                              color: isUp ? "var(--accent-green)" : "var(--accent-red)",
                            }}
                          >
                            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {isUp ? "+" : ""}
                            {stock.changePct.toFixed(2)}%
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
                          {stock.name.length > 30
                            ? stock.name.substring(0, 30) + "…"
                            : stock.name}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>
                          {formatPrice(stock.price)}
                        </div>
                      </div>

                      {/* Stats */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 11,
                          }}
                        >
                          <span style={{ color: "var(--muted)" }}>MCap</span>
                          <span style={{ fontWeight: 600 }}>{formatCrore(stock.marketCap)}</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 11,
                          }}
                        >
                          <span style={{ color: "var(--muted)" }}>P/E</span>
                          <span style={{ fontWeight: 600 }}>{stock.pe.toFixed(1)}x</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 11,
                          }}
                        >
                          <span style={{ color: "var(--muted)" }}>ROE</span>
                          <span
                            style={{
                              fontWeight: 600,
                              color:
                                stock.roe >= 20
                                  ? "var(--accent-green)"
                                  : stock.roe >= 12
                                  ? "var(--accent-yellow)"
                                  : "var(--accent-red)",
                            }}
                          >
                            {stock.roe.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Target & Notes */}
                      <div>
                        {targetPrice && (
                          <div
                            style={{
                              background: "var(--background)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              padding: "8px 12px",
                              marginBottom: 8,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10,
                                color: "var(--muted)",
                                fontWeight: 600,
                                marginBottom: 2,
                              }}
                            >
                              TARGET PRICE
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <span style={{ fontSize: 13, fontWeight: 700 }}>
                                {formatPrice(targetPrice)}
                              </span>
                              {targetPct && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color:
                                      parseFloat(targetPct) >= 0
                                        ? "var(--accent-green)"
                                        : "var(--accent-red)",
                                  }}
                                >
                                  {parseFloat(targetPct) >= 0 ? "+" : ""}
                                  {targetPct}%
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {alertAt && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--accent-yellow)",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              marginBottom: 4,
                            }}
                          >
                            <span>⚡</span> Alert at {formatPrice(alertAt)}
                          </div>
                        )}
                        {wNotes && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--muted)",
                              background: "var(--background)",
                              borderLeft: "2px solid var(--accent-blue)",
                              borderRadius: "0 5px 5px 0",
                              padding: "4px 8px",
                              lineHeight: 1.4,
                            }}
                          >
                            {wNotes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  padding: "14px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
                  Select a note from the left panel to view your research thesis
                </div>
              </div>
            </div>
          ) : (
            /* Note Detail View */
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {/* Note Header */}
              <div
                style={{
                  padding: "22px 28px",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(227,179,65,0.03)",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    {selectedNote.ticker && (
                      <Link
                        href={`/company/${selectedNote.ticker}`}
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: "var(--accent-blue)",
                          fontFamily: "monospace",
                          textDecoration: "none",
                          background: "rgba(88,166,255,0.1)",
                          border: "1px solid rgba(88,166,255,0.25)",
                          borderRadius: 5,
                          padding: "3px 10px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            "rgba(88,166,255,0.18)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            "rgba(88,166,255,0.1)";
                        }}
                      >
                        {selectedNote.ticker} ↗
                      </Link>
                    )}
                    {selectedNote.ticker &&
                      (() => {
                        const s = getStockByTicker(selectedNote.ticker);
                        if (!s) return null;
                        return (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color:
                                s.changePct >= 0 ? "var(--accent-green)" : "var(--accent-red)",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {s.changePct >= 0 ? (
                              <TrendingUp size={12} />
                            ) : (
                              <TrendingDown size={12} />
                            )}
                            {formatPrice(s.price)} ({s.changePct >= 0 ? "+" : ""}
                            {s.changePct.toFixed(2)}%)
                          </span>
                        );
                      })()}
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, marginBottom: 10 }}>
                    {selectedNote.title}
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Calendar size={11} /> Last updated:{" "}
                      {formatDate(selectedNote.updatedAt)}
                    </span>
                    {selectedNote.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 10,
                          color: "var(--accent-purple)",
                          background: "rgba(188,140,255,0.08)",
                          border: "1px solid rgba(188,140,255,0.18)",
                          borderRadius: 4,
                          padding: "2px 7px",
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Tag size={9} /> {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  title="Export as PDF (coming soon)"
                  style={{
                    background: "rgba(139,148,158,0.08)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--muted)",
                    cursor: "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                    opacity: 0.7,
                  }}
                >
                  <Download size={13} />
                  Export PDF
                  <span
                    style={{
                      fontSize: 9,
                      background: "var(--border)",
                      borderRadius: 3,
                      padding: "1px 5px",
                      color: "var(--muted)",
                    }}
                  >
                    soon
                  </span>
                </button>
              </div>

              {/* Note Body */}
              <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Thesis */}
                {selectedNote.thesis && (
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <PenLine size={11} /> Investment Thesis
                    </div>
                    <div
                      style={{
                        background: "rgba(88,166,255,0.04)",
                        border: "1px solid rgba(88,166,255,0.15)",
                        borderLeft: "3px solid var(--accent-blue)",
                        borderRadius: "0 8px 8px 0",
                        padding: "14px 16px",
                        fontSize: 13,
                        lineHeight: 1.7,
                        color: "var(--foreground)",
                      }}
                    >
                      {selectedNote.thesis}
                    </div>
                  </div>
                )}

                {/* Bull / Bear Cases */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Bull Case */}
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--accent-green)",
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <TrendingUp size={12} /> Bull Case
                    </div>
                    <div
                      style={{
                        background: "rgba(63,185,80,0.04)",
                        border: "1px solid rgba(63,185,80,0.2)",
                        borderRadius: 10,
                        padding: "14px 16px",
                        fontSize: 12,
                        lineHeight: 1.7,
                        color: "var(--muted)",
                        minHeight: 80,
                      }}
                    >
                      {selectedNote.bullCase || (
                        <span style={{ fontStyle: "italic", opacity: 0.6 }}>
                          No bull case documented yet
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bear Case */}
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--accent-red)",
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <TrendingDown size={12} /> Bear Case
                    </div>
                    <div
                      style={{
                        background: "rgba(248,81,73,0.04)",
                        border: "1px solid rgba(248,81,73,0.2)",
                        borderRadius: 10,
                        padding: "14px 16px",
                        fontSize: 12,
                        lineHeight: 1.7,
                        color: "var(--muted)",
                        minHeight: 80,
                      }}
                    >
                      {selectedNote.bearCase || (
                        <span style={{ fontStyle: "italic", opacity: 0.6 }}>
                          No bear case documented yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes / Content area */}
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.6px",
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <FileText size={11} /> Notes
                  </div>
                  <textarea
                    value={getContent(selectedNote)}
                    onChange={(e) => handleContentChange(selectedNote.id, e.target.value)}
                    placeholder="Write your research notes here…"
                    style={{
                      width: "100%",
                      minHeight: 160,
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "14px 16px",
                      fontSize: 13,
                      lineHeight: 1.7,
                      color: "var(--foreground)",
                      resize: "vertical",
                      outline: "none",
                      fontFamily: "inherit",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "rgba(88,166,255,0.4)";
                    }}
                    onBlur={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      marginTop: 6,
                      textAlign: "right",
                    }}
                  >
                    {getContent(selectedNote).length} characters
                  </div>
                </div>

                {/* Last Updated */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Calendar size={11} />
                    Created {formatDate(selectedNote.createdAt)} · Last updated{" "}
                    {formatDate(selectedNote.updatedAt)}
                  </div>
                  <button
                    onClick={() => handleDeleteNote(selectedNote.id)}
                    style={{
                      background: "rgba(248,81,73,0.08)",
                      border: "1px solid rgba(248,81,73,0.2)",
                      borderRadius: 7,
                      padding: "6px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--accent-red)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(248,81,73,0.16)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(248,81,73,0.08)";
                    }}
                  >
                    <Trash2 size={11} /> Delete Note
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div
            style={{
              marginTop: 16,
              padding: "12px 18px",
              background: "rgba(139,148,158,0.04)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 11,
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <BookOpen size={12} />
            <span>
              This notebook is for <strong>educational and research purposes only</strong>. Notes are
              stored locally in your session. Nothing here constitutes investment advice. Always do
              your own due diligence before making investment decisions.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
