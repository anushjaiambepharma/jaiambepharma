import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "StockLens — India Stock Research Platform",
  description: "Professional NSE/BSE stock research: news, fundamentals, filings, peer comparison, and learning for Indian equity investors.",
  keywords: ["stock research", "NSE", "BSE", "Indian stocks", "fundamental analysis"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <Navbar />
        <main style={{ minHeight: "calc(100vh - 60px)", background: "var(--background)" }}>
          {children}
        </main>
        <footer style={{
          borderTop: "1px solid var(--border)",
          padding: "16px 24px",
          textAlign: "center",
          fontSize: 12,
          color: "var(--muted)",
          background: "var(--card-bg)",
        }}>
          <p>
            StockLens — Educational Platform Only. Not investment advice. All data is mock/demo data.
            Always consult a SEBI-registered advisor before investing.
          </p>
        </footer>
      </body>
    </html>
  );
}
