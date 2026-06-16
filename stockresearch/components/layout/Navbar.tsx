"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, TrendingUp, Bell, BookOpen, BarChart2, Newspaper, StickyNote, Home, X
} from "lucide-react";
import { searchStocks } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReturnType<typeof searchStocks>>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const NAV_LINKS = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/news", label: "News Hub", icon: Newspaper },
    { href: "/learn", label: "Learn", icon: BookOpen },
    { href: "/notebook", label: "Notebook", icon: StickyNote },
  ];

  useEffect(() => {
    if (query.length >= 1) {
      const res = searchStocks(query).slice(0, 8);
      setResults(res);
      setShowResults(true);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [query]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function handleSelect(ticker: string) {
    setQuery("");
    setShowResults(false);
    router.push(`/company/${ticker}`);
  }

  return (
    <nav style={{
      background: "var(--card-bg)",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 20px", height: 60, display: "flex", alignItems: "center", gap: 24 }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{
            background: "linear-gradient(135deg, var(--accent-blue), var(--accent-purple))",
            borderRadius: 8,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <TrendingUp size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>StockLens</div>
            <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>India Research</div>
          </div>
        </Link>

        {/* Search */}
        <div ref={searchRef} style={{ position: "relative", flex: 1, maxWidth: 480 }}>
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company, ticker... (e.g. TCS, Reliance)"
              style={{
                width: "100%",
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 36px 8px 36px",
                fontSize: 13,
                color: "var(--foreground)",
                outline: "none",
              }}
              onFocus={() => query.length >= 1 && setShowResults(true)}
            />
            {query && (
              <button onClick={() => { setQuery(""); setShowResults(false); }} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
                <X size={14} />
              </button>
            )}
          </div>

          {showResults && results.length > 0 && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              right: 0,
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              zIndex: 100,
            }}>
              {results.map((stock) => (
                <button
                  key={stock.ticker}
                  onClick={() => handleSelect(stock.ticker)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    color: "var(--foreground)",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--border)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      background: "var(--background)",
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--accent-blue)",
                      letterSpacing: "0.05em",
                      fontFamily: "monospace",
                    }}>
                      {stock.ticker}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{stock.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{stock.sector} · {stock.exchange}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>₹{stock.price.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: stock.changePct >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                      {stock.changePct >= 0 ? "▲" : "▼"} {Math.abs(stock.changePct).toFixed(2)}%
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", gap: 4 }}>
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--muted)",
                textDecoration: "none",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--foreground)";
                (e.currentTarget as HTMLElement).style.background = "var(--border)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--muted)";
                (e.currentTarget as HTMLElement).style.background = "none";
              }}
            >
              <Icon size={14} />
              <span className="hidden md:inline">{label}</span>
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{
            background: "rgba(88, 166, 255, 0.1)",
            border: "1px solid rgba(88, 166, 255, 0.2)",
            borderRadius: 6,
            padding: "3px 10px",
            fontSize: 11,
            color: "var(--accent-blue)",
            fontWeight: 600,
          }}>
            MOCK DATA
          </div>
          <button style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px",
            cursor: "pointer",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
          }}>
            <Bell size={15} />
          </button>
        </div>
      </div>
    </nav>
  );
}
