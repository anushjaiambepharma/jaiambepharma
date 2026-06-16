"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { STOCKS, SECTORS, formatCrore, formatPrice } from "@/lib/mock-data"
import {
  Filter,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  BarChart2,
  Download,
  RefreshCw,
  Star,
} from "lucide-react"

type SortColumn =
  | "marketCap"
  | "price"
  | "changePct"
  | "pe"
  | "pb"
  | "roe"
  | "roce"
  | "debtToEquity"
  | "dividendYield"
  | "name"
  | "eps"

type FilterState = {
  sector: string
  minPE: string
  maxPE: string
  minROE: string
  minROCE: string
  maxDE: string
  minDiv: string
  minMcap: string
  maxMcap: string
  exchange: string
  query: string
}

const DEFAULT_FILTERS: FilterState = {
  sector: "all",
  minPE: "",
  maxPE: "",
  minROE: "",
  minROCE: "",
  maxDE: "",
  minDiv: "",
  minMcap: "",
  maxMcap: "",
  exchange: "all",
  query: "",
}

type Preset = {
  id: string
  label: string
  icon: string
  filters: Partial<FilterState>
}

const PRESETS: Preset[] = [
  {
    id: "high-roe",
    label: "High ROE",
    icon: "🏆",
    filters: { minROE: "20", maxDE: "1" },
  },
  {
    id: "low-pe-div",
    label: "Low PE + Div",
    icon: "💰",
    filters: { maxPE: "20", minDiv: "1.5" },
  },
  {
    id: "quality-largecap",
    label: "Quality Large Cap",
    icon: "🔷",
    filters: { minMcap: "100000", minROE: "15", maxDE: "0.5" },
  },
  {
    id: "high-growth-it",
    label: "High Growth IT",
    icon: "💻",
    filters: { sector: "Information Technology", minROE: "20" },
  },
  {
    id: "debt-free",
    label: "Debt Free",
    icon: "🛡️",
    filters: { maxDE: "0.1" },
  },
  {
    id: "undervalued",
    label: "Undervalued",
    icon: "🎯",
    filters: { maxPE: "15" },
  },
]

function peColor(pe: number): string {
  if (pe <= 0) return "var(--muted)"
  if (pe < 15) return "var(--accent-green)"
  if (pe <= 25) return "var(--accent-yellow)"
  if (pe <= 40) return "var(--foreground)"
  return "var(--accent-red)"
}

function roeColor(roe: number): string {
  if (roe >= 20) return "var(--accent-green)"
  if (roe >= 12) return "var(--accent-yellow)"
  return "var(--accent-red)"
}

function deColor(de: number): string {
  if (de < 0.5) return "var(--accent-green)"
  if (de < 1.5) return "var(--accent-yellow)"
  return "var(--accent-red)"
}

function pctFromHigh(price: number, high: number): string {
  const pct = ((price - high) / high) * 100
  return pct.toFixed(1) + "%"
}

export default function ScreenerPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [sortBy, setSortBy] = useState<SortColumn>("marketCap")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const results = useMemo(() => {
    let list = [...STOCKS]

    // Search query
    if (filters.query.trim()) {
      const q = filters.query.trim().toLowerCase()
      list = list.filter(
        (s) =>
          s.ticker.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)
      )
    }

    // Exchange
    if (filters.exchange !== "all") {
      list = list.filter((s) => s.exchange === filters.exchange)
    }

    // Sector
    if (filters.sector !== "all") {
      list = list.filter((s) => s.sector === filters.sector)
    }

    // Min Market Cap
    if (filters.minMcap !== "") {
      const val = parseFloat(filters.minMcap)
      if (!isNaN(val)) list = list.filter((s) => s.marketCap >= val)
    }

    // Max Market Cap
    if (filters.maxMcap !== "") {
      const val = parseFloat(filters.maxMcap)
      if (!isNaN(val)) list = list.filter((s) => s.marketCap <= val)
    }

    // Min PE
    if (filters.minPE !== "") {
      const val = parseFloat(filters.minPE)
      if (!isNaN(val)) list = list.filter((s) => s.pe >= val)
    }

    // Max PE
    if (filters.maxPE !== "") {
      const val = parseFloat(filters.maxPE)
      if (!isNaN(val)) list = list.filter((s) => s.pe > 0 && s.pe <= val)
    }

    // Min ROE
    if (filters.minROE !== "") {
      const val = parseFloat(filters.minROE)
      if (!isNaN(val)) list = list.filter((s) => s.roe >= val)
    }

    // Min ROCE
    if (filters.minROCE !== "") {
      const val = parseFloat(filters.minROCE)
      if (!isNaN(val)) list = list.filter((s) => s.roce >= val)
    }

    // Max D/E
    if (filters.maxDE !== "") {
      const val = parseFloat(filters.maxDE)
      if (!isNaN(val)) list = list.filter((s) => s.debtToEquity <= val)
    }

    // Min Dividend Yield
    if (filters.minDiv !== "") {
      const val = parseFloat(filters.minDiv)
      if (!isNaN(val)) list = list.filter((s) => s.dividendYield >= val)
    }

    // Sort
    list.sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0

      switch (sortBy) {
        case "marketCap": av = a.marketCap; bv = b.marketCap; break
        case "price": av = a.price; bv = b.price; break
        case "changePct": av = a.changePct; bv = b.changePct; break
        case "pe": av = a.pe; bv = b.pe; break
        case "pb": av = a.pb; bv = b.pb; break
        case "roe": av = a.roe; bv = b.roe; break
        case "roce": av = a.roce; bv = b.roce; break
        case "debtToEquity": av = a.debtToEquity; bv = b.debtToEquity; break
        case "dividendYield": av = a.dividendYield; bv = b.dividendYield; break
        case "eps": av = a.eps; bv = b.eps; break
        case "name": av = a.name; bv = b.name; break
        default: av = a.marketCap; bv = b.marketCap
      }

      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      }

      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number)
    })

    return list
  }, [filters, sortBy, sortDir])

  function applyPreset(preset: Preset) {
    if (activePreset === preset.id) {
      setFilters(DEFAULT_FILTERS)
      setActivePreset(null)
    } else {
      setFilters({ ...DEFAULT_FILTERS, ...preset.filters })
      setActivePreset(preset.id)
    }
  }

  function resetAll() {
    setFilters(DEFAULT_FILTERS)
    setActivePreset(null)
  }

  function handleSort(col: SortColumn) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortDir("desc")
    }
  }

  function removeFilter(key: keyof FilterState) {
    setFilters((prev) => ({ ...prev, [key]: key === "sector" || key === "exchange" ? "all" : "" }))
    setActivePreset(null)
  }

  function setFilter(key: keyof FilterState, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setActivePreset(null)
  }

  // Build active filter chips
  const activeChips: { label: string; key: keyof FilterState }[] = []
  if (filters.query) activeChips.push({ label: `Search: "${filters.query}"`, key: "query" })
  if (filters.exchange !== "all") activeChips.push({ label: `Exchange: ${filters.exchange}`, key: "exchange" })
  if (filters.sector !== "all") activeChips.push({ label: `Sector: ${filters.sector}`, key: "sector" })
  if (filters.minMcap) activeChips.push({ label: `Min MCap: ₹${filters.minMcap} Cr`, key: "minMcap" })
  if (filters.maxMcap) activeChips.push({ label: `Max MCap: ₹${filters.maxMcap} Cr`, key: "maxMcap" })
  if (filters.minPE) activeChips.push({ label: `Min P/E: ${filters.minPE}`, key: "minPE" })
  if (filters.maxPE) activeChips.push({ label: `Max P/E: ${filters.maxPE}`, key: "maxPE" })
  if (filters.minROE) activeChips.push({ label: `Min ROE: ${filters.minROE}%`, key: "minROE" })
  if (filters.minROCE) activeChips.push({ label: `Min ROCE: ${filters.minROCE}%`, key: "minROCE" })
  if (filters.maxDE) activeChips.push({ label: `Max D/E: ${filters.maxDE}`, key: "maxDE" })
  if (filters.minDiv) activeChips.push({ label: `Min Div: ${filters.minDiv}%`, key: "minDiv" })

  const sortOptions: { value: SortColumn; label: string }[] = [
    { value: "marketCap", label: "Market Cap" },
    { value: "price", label: "Price" },
    { value: "changePct", label: "Change %" },
    { value: "pe", label: "P/E Ratio" },
    { value: "pb", label: "P/B Ratio" },
    { value: "roe", label: "ROE %" },
    { value: "roce", label: "ROCE %" },
    { value: "debtToEquity", label: "Debt / Equity" },
    { value: "dividendYield", label: "Dividend Yield" },
    { value: "name", label: "Company Name" },
  ]

  const inputStyle: React.CSSProperties = {
    background: "var(--background)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--foreground)",
    padding: "8px 12px",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.15s",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 5,
    display: "block",
  }

  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
    borderBottom: "1px solid var(--border)",
    textAlign: "left",
  }

  const tdStyle: React.CSSProperties = {
    padding: "11px 12px",
    fontSize: 13,
    color: "var(--foreground)",
    whiteSpace: "nowrap",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
  }

  function SortIcon({ col }: { col: SortColumn }) {
    if (sortBy !== col) {
      return (
        <span style={{ opacity: 0.3, marginLeft: 4, display: "inline-flex", flexDirection: "column", verticalAlign: "middle" }}>
          <ChevronUp size={10} />
          <ChevronDown size={10} style={{ marginTop: -3 }} />
        </span>
      )
    }
    return sortDir === "asc" ? (
      <ChevronUp size={12} style={{ marginLeft: 4, color: "var(--accent-blue)", display: "inline", verticalAlign: "middle" }} />
    ) : (
      <ChevronDown size={12} style={{ marginLeft: 4, color: "var(--accent-blue)", display: "inline", verticalAlign: "middle" }} />
    )
  }

  function handleDownloadCSV() {
    const headers = ["Rank", "Ticker", "Name", "Exchange", "Sector", "Price", "Change%", "MarketCap", "PE", "PB", "ROE", "ROCE", "D/E", "DivYield"]
    const rows = results.map((s, i) => [
      i + 1,
      s.ticker,
      s.name,
      s.exchange,
      s.sector,
      s.price,
      s.changePct,
      s.marketCap,
      s.pe,
      s.pb,
      s.roe,
      s.roce,
      s.debtToEquity,
      s.dividendYield,
    ])
    const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "screener-results.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", padding: "0 0 60px 0" }}>
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--card-bg)",
          padding: "28px 32px 24px",
        }}
      >
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SlidersHorizontal size={20} color="#fff" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                  Stock Screener
                </h1>
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                  Filter NSE/BSE stocks by fundamentals —{" "}
                  <strong style={{ color: "var(--accent-blue)" }}>{results.length} companies</strong> match
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={resetAll}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--muted)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent-red)"
              e.currentTarget.style.color = "var(--accent-red)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)"
              e.currentTarget.style.color = "var(--muted)"
            }}
          >
            <RefreshCw size={13} />
            Reset All
          </button>
        </div>

        {/* Preset chips */}
        <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", alignSelf: "center", marginRight: 4 }}>
            <Star size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
            Preset Screens:
          </span>
          {PRESETS.map((preset) => {
            const isActive = activePreset === preset.id
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: isActive ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
                  background: isActive ? "rgba(59,130,246,0.12)" : "var(--background)",
                  color: isActive ? "var(--accent-blue)" : "var(--foreground)",
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 13 }}>{preset.icon}</span>
                {preset.label}
                {isActive && <X size={11} style={{ marginLeft: 2 }} />}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* Filter Panel */}
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "20px 24px",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Filter size={15} color="var(--accent-blue)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>Filters</span>
          </div>

          {/* Row 1 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              gap: 14,
              marginBottom: 14,
            }}
          >
            {/* Search */}
            <div>
              <label style={labelStyle}>Search</label>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                <input
                  type="text"
                  placeholder="Company name or ticker..."
                  value={filters.query}
                  onChange={(e) => setFilter("query", e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 32 }}
                />
              </div>
            </div>

            {/* Exchange */}
            <div>
              <label style={labelStyle}>Exchange</label>
              <select
                value={filters.exchange}
                onChange={(e) => setFilter("exchange", e.target.value)}
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
              >
                <option value="all">All Exchanges</option>
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </div>

            {/* Sector */}
            <div>
              <label style={labelStyle}>Sector</label>
              <select
                value={filters.sector}
                onChange={(e) => setFilter("sector", e.target.value)}
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
              >
                <option value="all">All Sectors</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <div>
              <label style={labelStyle}>Min Market Cap (Cr)</label>
              <input
                type="number"
                placeholder="e.g. 10000"
                value={filters.minMcap}
                onChange={(e) => setFilter("minMcap", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Max Market Cap (Cr)</label>
              <input
                type="number"
                placeholder="e.g. 500000"
                value={filters.maxMcap}
                onChange={(e) => setFilter("maxMcap", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Min P/E</label>
              <input
                type="number"
                placeholder="e.g. 5"
                value={filters.minPE}
                onChange={(e) => setFilter("minPE", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Max P/E</label>
              <input
                type="number"
                placeholder="e.g. 30"
                value={filters.maxPE}
                onChange={(e) => setFilter("maxPE", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 3 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 14,
            }}
          >
            <div>
              <label style={labelStyle}>Min ROE (%)</label>
              <input
                type="number"
                placeholder="e.g. 15"
                value={filters.minROE}
                onChange={(e) => setFilter("minROE", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Min ROCE (%)</label>
              <input
                type="number"
                placeholder="e.g. 15"
                value={filters.minROCE}
                onChange={(e) => setFilter("minROCE", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Max D/E Ratio</label>
              <input
                type="number"
                placeholder="e.g. 1"
                value={filters.maxDE}
                onChange={(e) => setFilter("maxDE", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Min Dividend Yield (%)</label>
              <input
                type="number"
                placeholder="e.g. 1.5"
                value={filters.minDiv}
                onChange={(e) => setFilter("minDiv", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Active Filters:
            </span>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => removeFilter(chip.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: "1px solid var(--accent-blue)",
                  background: "rgba(59,130,246,0.1)",
                  color: "var(--accent-blue)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {chip.label}
                <X size={10} />
              </button>
            ))}
          </div>
        )}

        {/* Results header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <BarChart2 size={16} color="var(--accent-blue)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
              Results
            </span>
            <span
              style={{
                padding: "2px 10px",
                borderRadius: 20,
                background: "rgba(59,130,246,0.12)",
                color: "var(--accent-blue)",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {results.length} companies found
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Sort dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as SortColumn); }}
                style={{
                  ...inputStyle,
                  width: "auto",
                  padding: "6px 10px",
                  fontSize: 12,
                  appearance: "none",
                  cursor: "pointer",
                  paddingRight: 28,
                }}
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--card-bg)",
                  color: "var(--foreground)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {sortDir === "asc" ? "ASC" : "DESC"}
              </button>
            </div>

            {/* Download CSV */}
            <button
              onClick={handleDownloadCSV}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--card-bg)",
                color: "var(--muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-green)"
                e.currentTarget.style.color = "var(--accent-green)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)"
                e.currentTarget.style.color = "var(--muted)"
              }}
            >
              <Download size={13} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            {results.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "72px 32px",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "rgba(99,102,241,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <SlidersHorizontal size={28} color="var(--muted)" />
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>
                    No stocks match your criteria
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
                    Try relaxing some filters or using a different preset
                  </p>
                </div>
                <button
                  onClick={resetAll}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--accent-blue)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.2)" }}>
                    <th style={{ ...thStyle, width: 44, textAlign: "center" }}>#</th>
                    <th
                      style={{ ...thStyle, minWidth: 220 }}
                      onClick={() => handleSort("name")}
                    >
                      Company <SortIcon col="name" />
                    </th>
                    <th style={{ ...thStyle }}>Exch</th>
                    <th style={{ ...thStyle, minWidth: 140 }}>Sector</th>
                    <th
                      style={{ ...thStyle, textAlign: "right" }}
                      onClick={() => handleSort("price")}
                    >
                      Price <SortIcon col="price" />
                    </th>
                    <th
                      style={{ ...thStyle, textAlign: "right" }}
                      onClick={() => handleSort("changePct")}
                    >
                      Chg % <SortIcon col="changePct" />
                    </th>
                    <th
                      style={{ ...thStyle, textAlign: "right", minWidth: 110 }}
                      onClick={() => handleSort("marketCap")}
                    >
                      Mkt Cap <SortIcon col="marketCap" />
                    </th>
                    <th
                      style={{ ...thStyle, textAlign: "right" }}
                      onClick={() => handleSort("pe")}
                    >
                      P/E <SortIcon col="pe" />
                    </th>
                    <th
                      style={{ ...thStyle, textAlign: "right" }}
                      onClick={() => handleSort("pb")}
                    >
                      P/B <SortIcon col="pb" />
                    </th>
                    <th
                      style={{ ...thStyle, textAlign: "right" }}
                      onClick={() => handleSort("roe")}
                    >
                      ROE % <SortIcon col="roe" />
                    </th>
                    <th
                      style={{ ...thStyle, textAlign: "right" }}
                      onClick={() => handleSort("roce")}
                    >
                      ROCE % <SortIcon col="roce" />
                    </th>
                    <th
                      style={{ ...thStyle, textAlign: "right" }}
                      onClick={() => handleSort("debtToEquity")}
                    >
                      D/E <SortIcon col="debtToEquity" />
                    </th>
                    <th
                      style={{ ...thStyle, textAlign: "right" }}
                      onClick={() => handleSort("dividendYield")}
                    >
                      Div % <SortIcon col="dividendYield" />
                    </th>
                    <th style={{ ...thStyle, textAlign: "right", minWidth: 100 }}>52W High</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((stock, idx) => {
                    const isPositive = stock.changePct >= 0
                    const fromHigh = pctFromHigh(stock.price, stock.high52w)
                    const fromHighNum = ((stock.price - stock.high52w) / stock.high52w) * 100

                    return (
                      <tr
                        key={stock.ticker}
                        style={{ transition: "background 0.1s" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.03)"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent"
                        }}
                      >
                        {/* Rank */}
                        <td style={{ ...tdStyle, textAlign: "center", color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>
                          {idx + 1}
                        </td>

                        {/* Company */}
                        <td style={tdStyle}>
                          <Link href={`/company/${stock.ticker}`} style={{ textDecoration: "none" }}>
                            <div>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: "var(--accent-blue)",
                                  display: "block",
                                  lineHeight: 1.3,
                                }}
                              >
                                {stock.name}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "var(--muted)",
                                  background: "rgba(255,255,255,0.06)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 4,
                                  padding: "1px 5px",
                                  marginTop: 3,
                                  display: "inline-block",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                {stock.ticker}
                              </span>
                            </div>
                          </Link>
                        </td>

                        {/* Exchange */}
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "2px 7px",
                              borderRadius: 4,
                              background: stock.exchange === "NSE"
                                ? "rgba(59,130,246,0.12)"
                                : "rgba(168,85,247,0.12)",
                              color: stock.exchange === "NSE"
                                ? "var(--accent-blue)"
                                : "var(--accent-purple)",
                              letterSpacing: "0.06em",
                              border: stock.exchange === "NSE"
                                ? "1px solid rgba(59,130,246,0.25)"
                                : "1px solid rgba(168,85,247,0.25)",
                            }}
                          >
                            {stock.exchange}
                          </span>
                        </td>

                        {/* Sector */}
                        <td style={{ ...tdStyle, color: "var(--muted)", fontSize: 12 }}>
                          {stock.sector}
                        </td>

                        {/* Price */}
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {formatPrice(stock.price)}
                        </td>

                        {/* Change % */}
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              fontWeight: 700,
                              fontSize: 12,
                              color: isPositive ? "var(--accent-green)" : "var(--accent-red)",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {isPositive ? "+" : ""}
                            {stock.changePct.toFixed(2)}%
                          </span>
                        </td>

                        {/* Market Cap */}
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {formatCrore(stock.marketCap)}
                        </td>

                        {/* P/E */}
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 12,
                              color: peColor(stock.pe),
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {stock.pe > 0 ? stock.pe.toFixed(1) : "—"}
                          </span>
                        </td>

                        {/* P/B */}
                        <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {stock.pb.toFixed(1)}
                        </td>

                        {/* ROE % */}
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 12,
                              color: roeColor(stock.roe),
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {stock.roe.toFixed(1)}%
                          </span>
                        </td>

                        {/* ROCE % */}
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 12,
                              color: roeColor(stock.roce),
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {stock.roce.toFixed(1)}%
                          </span>
                        </td>

                        {/* D/E */}
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 12,
                              color: deColor(stock.debtToEquity),
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {stock.debtToEquity.toFixed(2)}
                          </span>
                        </td>

                        {/* Div Yield */}
                        <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {stock.dividendYield > 0 ? (
                            <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>
                              {stock.dividendYield.toFixed(2)}%
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>

                        {/* 52W High */}
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                              {formatPrice(stock.high52w)}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: fromHighNum < -20 ? "var(--accent-red)" : fromHighNum < -10 ? "var(--accent-yellow)" : "var(--muted)",
                                fontWeight: 600,
                                marginTop: 2,
                              }}
                            >
                              {fromHigh} from high
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <Link
                            href={`/company/${stock.ticker}`}
                            style={{
                              display: "inline-block",
                              padding: "5px 14px",
                              borderRadius: 6,
                              background: "transparent",
                              border: "1px solid var(--accent-blue)",
                              color: "var(--accent-blue)",
                              fontSize: 11,
                              fontWeight: 700,
                              textDecoration: "none",
                              transition: "all 0.15s",
                              letterSpacing: "0.04em",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--accent-blue)"
                              e.currentTarget.style.color = "#fff"
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent"
                              e.currentTarget.style.color = "var(--accent-blue)"
                            }}
                          >
                            VIEW
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer note */}
        <div
          style={{
            marginTop: 28,
            padding: "14px 20px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "rgba(234,179,8,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            <span style={{ fontSize: 11 }}>i</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--accent-yellow)" }}>Mock Data Notice:</strong> All stock data displayed is simulated for demonstration purposes. In a production environment, this page would integrate with real-time market data APIs (NSE/BSE data feeds, financial data providers like Refinitiv or Bloomberg) to display live prices, fundamentals, and screener results. The screener logic, filtering, sorting, and UI are production-ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
