export type Stock = {
  ticker: string;
  name: string;
  exchange: "NSE" | "BSE";
  sector: string;
  industry: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number; // in crores
  pe: number;
  pb: number;
  roe: number;
  roce: number;
  debtToEquity: number;
  eps: number;
  dividendYield: number;
  high52w: number;
  low52w: number;
  volume: number;
  avgVolume: number;
  description: string;
  promoterHolding: number;
  fiiHolding: number;
  diiHolding: number;
  publicHolding: number;
};

export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  url: string;
  publishedAt: string;
  sentiment: "positive" | "negative" | "neutral";
  topic: string;
  tickers: string[];
  credibility: "high" | "medium" | "low";
};

export type Filing = {
  id: string;
  ticker: string;
  type: string;
  title: string;
  date: string;
  exchange: "NSE" | "BSE";
  url: string;
  category: "announcement" | "filings" | "shareholding" | "insider";
};

export type FinancialData = {
  ticker: string;
  quarterlyRevenue: { quarter: string; revenue: number; profit: number }[];
  annualRevenue: { year: string; revenue: number; profit: number; ebitda: number }[];
  priceHistory: { date: string; price: number; volume: number }[];
};

export type LearningModule = {
  id: string;
  title: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  duration: number; // minutes
  topics: string[];
  content: { section: string; text: string }[];
};

export type WatchlistItem = {
  ticker: string;
  addedAt: string;
  notes: string;
  targetPrice: number | null;
  alertAt: number | null;
};

export type ResearchNote = {
  id: string;
  ticker: string;
  title: string;
  content: string;
  thesis: string;
  bullCase: string;
  bearCase: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export const STOCKS: Stock[] = [
  {
    ticker: "RELIANCE",
    name: "Reliance Industries Ltd",
    exchange: "NSE",
    sector: "Energy",
    industry: "Diversified",
    price: 2847.35,
    change: 42.15,
    changePct: 1.50,
    marketCap: 1923450,
    pe: 24.8,
    pb: 2.9,
    roe: 11.8,
    roce: 10.2,
    debtToEquity: 0.43,
    eps: 114.81,
    dividendYield: 0.35,
    high52w: 3217.90,
    low52w: 2194.55,
    volume: 8234120,
    avgVolume: 7890000,
    description: "Reliance Industries is India's largest private sector corporation with revenues over $100 billion. Operates in energy, petrochemicals, natural gas, retail, telecommunications, and mass media.",
    promoterHolding: 50.30,
    fiiHolding: 23.45,
    diiHolding: 14.20,
    publicHolding: 12.05,
  },
  {
    ticker: "TCS",
    name: "Tata Consultancy Services Ltd",
    exchange: "NSE",
    sector: "Information Technology",
    industry: "IT Services",
    price: 3612.80,
    change: -28.45,
    changePct: -0.78,
    marketCap: 1317430,
    pe: 28.6,
    pb: 12.4,
    roe: 46.5,
    roce: 61.2,
    debtToEquity: 0.03,
    eps: 126.3,
    dividendYield: 1.55,
    high52w: 4592.25,
    low52w: 3311.00,
    volume: 3421000,
    avgVolume: 2980000,
    description: "TCS is the world's 2nd largest IT services company by market cap. Provides IT services, consulting, and business solutions to clients across 50+ countries.",
    promoterHolding: 72.30,
    fiiHolding: 12.80,
    diiHolding: 8.45,
    publicHolding: 6.45,
  },
  {
    ticker: "INFY",
    name: "Infosys Ltd",
    exchange: "NSE",
    sector: "Information Technology",
    industry: "IT Services",
    price: 1587.25,
    change: 12.35,
    changePct: 0.78,
    marketCap: 659820,
    pe: 24.1,
    pb: 8.1,
    roe: 33.7,
    roce: 44.8,
    debtToEquity: 0.06,
    eps: 65.87,
    dividendYield: 2.85,
    high52w: 1936.65,
    low52w: 1358.35,
    volume: 5672000,
    avgVolume: 5120000,
    description: "Infosys is a global leader in next-generation digital services and consulting. Enables clients in 56 countries to navigate their digital transformation.",
    promoterHolding: 14.90,
    fiiHolding: 33.60,
    diiHolding: 28.40,
    publicHolding: 23.10,
  },
  {
    ticker: "HDFCBANK",
    name: "HDFC Bank Ltd",
    exchange: "NSE",
    sector: "Financial Services",
    industry: "Private Sector Banks",
    price: 1748.60,
    change: 22.40,
    changePct: 1.30,
    marketCap: 1329800,
    pe: 19.2,
    pb: 2.7,
    roe: 14.1,
    roce: 8.9,
    debtToEquity: 8.24,
    eps: 91.06,
    dividendYield: 1.08,
    high52w: 1880.00,
    low52w: 1363.55,
    volume: 9823000,
    avgVolume: 9120000,
    description: "HDFC Bank is India's largest private sector bank by assets. Known for consistent asset quality, digital banking leadership, and retail focus.",
    promoterHolding: 0.00,
    fiiHolding: 47.20,
    diiHolding: 28.60,
    publicHolding: 24.20,
  },
  {
    ticker: "ICICIBANK",
    name: "ICICI Bank Ltd",
    exchange: "NSE",
    sector: "Financial Services",
    industry: "Private Sector Banks",
    price: 1198.45,
    change: -8.20,
    changePct: -0.68,
    marketCap: 844320,
    pe: 17.4,
    pb: 3.0,
    roe: 17.3,
    roce: 11.2,
    debtToEquity: 7.15,
    eps: 68.87,
    dividendYield: 0.84,
    high52w: 1322.85,
    low52w: 978.10,
    volume: 11245000,
    avgVolume: 10780000,
    description: "ICICI Bank is India's second-largest private sector bank with a strong digital banking franchise and diversified financial services.",
    promoterHolding: 0.00,
    fiiHolding: 42.30,
    diiHolding: 30.80,
    publicHolding: 26.90,
  },
  {
    ticker: "BHARTIARTL",
    name: "Bharti Airtel Ltd",
    exchange: "NSE",
    sector: "Communication Services",
    industry: "Telecom",
    price: 1687.30,
    change: 34.75,
    changePct: 2.10,
    marketCap: 1007800,
    pe: 78.2,
    pb: 8.9,
    roe: 11.4,
    roce: 10.8,
    debtToEquity: 2.12,
    eps: 21.58,
    dividendYield: 0.59,
    high52w: 1779.00,
    low52w: 1168.00,
    volume: 6780000,
    avgVolume: 6340000,
    description: "Bharti Airtel is India's largest telecom company by subscribers. Operates in 18 African countries and leads India's 5G rollout with strong ARPU growth.",
    promoterHolding: 55.50,
    fiiHolding: 20.30,
    diiHolding: 15.40,
    publicHolding: 8.80,
  },
  {
    ticker: "HINDUNILVR",
    name: "Hindustan Unilever Ltd",
    exchange: "NSE",
    sector: "FMCG",
    industry: "FMCG",
    price: 2278.90,
    change: -15.30,
    changePct: -0.67,
    marketCap: 535120,
    pe: 52.4,
    pb: 10.8,
    roe: 20.5,
    roce: 26.8,
    debtToEquity: 0.00,
    eps: 43.50,
    dividendYield: 1.80,
    high52w: 2974.15,
    low52w: 2152.85,
    volume: 4321000,
    avgVolume: 3980000,
    description: "HUL is India's largest FMCG company with 90+ brands across beauty & personal care, home care, and foods. Subsidiary of Unilever Plc.",
    promoterHolding: 61.90,
    fiiHolding: 16.40,
    diiHolding: 10.50,
    publicHolding: 11.20,
  },
  {
    ticker: "ITC",
    name: "ITC Ltd",
    exchange: "NSE",
    sector: "FMCG",
    industry: "Cigarettes & FMCG",
    price: 434.65,
    change: 4.30,
    changePct: 1.00,
    marketCap: 544350,
    pe: 26.3,
    pb: 6.8,
    roe: 26.0,
    roce: 34.5,
    debtToEquity: 0.00,
    eps: 16.52,
    dividendYield: 3.25,
    high52w: 528.50,
    low52w: 388.25,
    volume: 15678000,
    avgVolume: 14320000,
    description: "ITC is a diversified conglomerate with market-leading businesses in cigarettes, hotels, paperboards, agribusiness, and FMCG. One of India's highest dividend payers.",
    promoterHolding: 0.00,
    fiiHolding: 38.60,
    diiHolding: 35.20,
    publicHolding: 26.20,
  },
  {
    ticker: "KOTAKBANK",
    name: "Kotak Mahindra Bank Ltd",
    exchange: "NSE",
    sector: "Financial Services",
    industry: "Private Sector Banks",
    price: 2089.75,
    change: 18.90,
    changePct: 0.91,
    marketCap: 415870,
    pe: 21.8,
    pb: 3.8,
    roe: 17.4,
    roce: 10.9,
    debtToEquity: 5.78,
    eps: 95.86,
    dividendYield: 0.10,
    high52w: 2235.95,
    low52w: 1544.15,
    volume: 5234000,
    avgVolume: 4870000,
    description: "Kotak Mahindra Bank is a premium private sector bank known for conservative lending, low NPAs, and strong capital adequacy. Ranks 4th in India by market cap.",
    promoterHolding: 25.90,
    fiiHolding: 35.20,
    diiHolding: 22.40,
    publicHolding: 16.50,
  },
  {
    ticker: "WIPRO",
    name: "Wipro Ltd",
    exchange: "NSE",
    sector: "Information Technology",
    industry: "IT Services",
    price: 476.30,
    change: 3.80,
    changePct: 0.80,
    marketCap: 248130,
    pe: 22.4,
    pb: 3.8,
    roe: 17.0,
    roce: 22.4,
    debtToEquity: 0.18,
    eps: 21.26,
    dividendYield: 0.21,
    high52w: 578.90,
    low52w: 393.50,
    volume: 8976000,
    avgVolume: 8230000,
    description: "Wipro is a leading global IT, consulting and business process services company. Serves over 100 Fortune 500 companies across 6 continents.",
    promoterHolding: 72.80,
    fiiHolding: 9.40,
    diiHolding: 10.20,
    publicHolding: 7.60,
  },
  {
    ticker: "MARUTI",
    name: "Maruti Suzuki India Ltd",
    exchange: "NSE",
    sector: "Consumer Discretionary",
    industry: "Automobile",
    price: 11487.50,
    change: 145.80,
    changePct: 1.29,
    marketCap: 347230,
    pe: 26.4,
    pb: 4.6,
    roe: 17.5,
    roce: 23.2,
    debtToEquity: 0.00,
    eps: 435.13,
    dividendYield: 1.04,
    high52w: 13680.00,
    low52w: 10124.90,
    volume: 1234000,
    avgVolume: 1120000,
    description: "Maruti Suzuki is India's largest passenger vehicle manufacturer with over 40% market share. Subsidiary of Japan's Suzuki Motor Corporation.",
    promoterHolding: 58.20,
    fiiHolding: 19.80,
    diiHolding: 13.40,
    publicHolding: 8.60,
  },
  {
    ticker: "SUNPHARMA",
    name: "Sun Pharmaceutical Industries Ltd",
    exchange: "NSE",
    sector: "Healthcare",
    industry: "Pharmaceutical",
    price: 1698.45,
    change: -12.65,
    changePct: -0.74,
    marketCap: 407230,
    pe: 38.2,
    pb: 5.8,
    roe: 15.2,
    roce: 20.1,
    debtToEquity: 0.07,
    eps: 44.46,
    dividendYield: 0.71,
    high52w: 1960.35,
    low52w: 1290.80,
    volume: 3456000,
    avgVolume: 3120000,
    description: "Sun Pharma is India's largest pharma company and among the top 5 specialty pharma companies globally. Focused on dermatology, ophthalmology, and oncology.",
    promoterHolding: 54.50,
    fiiHolding: 19.30,
    diiHolding: 16.20,
    publicHolding: 10.00,
  },
  {
    ticker: "ASIANPAINT",
    name: "Asian Paints Ltd",
    exchange: "NSE",
    sector: "Consumer Discretionary",
    industry: "Paints",
    price: 2289.15,
    change: -34.20,
    changePct: -1.47,
    marketCap: 219450,
    pe: 47.8,
    pb: 15.2,
    roe: 31.8,
    roce: 41.2,
    debtToEquity: 0.05,
    eps: 47.89,
    dividendYield: 0.96,
    high52w: 3394.45,
    low52w: 2175.65,
    volume: 2567000,
    avgVolume: 2340000,
    description: "Asian Paints is India's largest paint company with 25+ countries presence. Dominant 50%+ share in India's decorative paints market.",
    promoterHolding: 52.60,
    fiiHolding: 16.80,
    diiHolding: 18.40,
    publicHolding: 12.20,
  },
  {
    ticker: "AXISBANK",
    name: "Axis Bank Ltd",
    exchange: "NSE",
    sector: "Financial Services",
    industry: "Private Sector Banks",
    price: 1148.70,
    change: 9.45,
    changePct: 0.83,
    marketCap: 354210,
    pe: 15.2,
    pb: 2.1,
    roe: 13.8,
    roce: 8.7,
    debtToEquity: 8.56,
    eps: 75.57,
    dividendYield: 0.09,
    high52w: 1339.65,
    low52w: 963.60,
    volume: 9876000,
    avgVolume: 9230000,
    description: "Axis Bank is India's 3rd largest private sector bank, focused on retail, SME, and corporate banking with growing fee income.",
    promoterHolding: 8.20,
    fiiHolding: 44.50,
    diiHolding: 29.80,
    publicHolding: 17.50,
  },
  {
    ticker: "ULTRACEMCO",
    name: "UltraTech Cement Ltd",
    exchange: "NSE",
    sector: "Materials",
    industry: "Cement",
    price: 10789.50,
    change: 89.30,
    changePct: 0.83,
    marketCap: 311890,
    pe: 35.6,
    pb: 5.8,
    roe: 16.2,
    roce: 21.8,
    debtToEquity: 0.34,
    eps: 303.13,
    dividendYield: 0.32,
    high52w: 12244.00,
    low52w: 9124.10,
    volume: 678000,
    avgVolume: 620000,
    description: "UltraTech Cement is India's largest cement company with capacity of 136+ MTPA. Part of the Aditya Birla Group.",
    promoterHolding: 59.60,
    fiiHolding: 15.80,
    diiHolding: 17.30,
    publicHolding: 7.30,
  },
  {
    ticker: "NESTLEIND",
    name: "Nestle India Ltd",
    exchange: "NSE",
    sector: "FMCG",
    industry: "Food Products",
    price: 2289.60,
    change: 14.80,
    changePct: 0.65,
    marketCap: 220870,
    pe: 68.4,
    pb: 59.2,
    roe: 86.5,
    roce: 113.2,
    debtToEquity: 0.00,
    eps: 33.47,
    dividendYield: 1.83,
    high52w: 2778.00,
    low52w: 2110.00,
    volume: 987000,
    avgVolume: 920000,
    description: "Nestle India is a subsidiary of Swiss Nestle SA, maker of Maggi, KitKat, Nescafe, and Munch — dominant in premium packaged foods.",
    promoterHolding: 62.80,
    fiiHolding: 13.60,
    diiHolding: 13.20,
    publicHolding: 10.40,
  },
  {
    ticker: "TATAMOTORS",
    name: "Tata Motors Ltd",
    exchange: "NSE",
    sector: "Consumer Discretionary",
    industry: "Automobile",
    price: 789.45,
    change: 21.35,
    changePct: 2.78,
    marketCap: 292370,
    pe: 8.4,
    pb: 3.2,
    roe: 38.2,
    roce: 15.8,
    debtToEquity: 1.86,
    eps: 93.98,
    dividendYield: 0.00,
    high52w: 1179.00,
    low52w: 682.35,
    volume: 16234000,
    avgVolume: 15120000,
    description: "Tata Motors is India's largest commercial vehicle maker and owns Jaguar Land Rover (JLR). India's 2nd largest passenger vehicle maker, leading EV transition.",
    promoterHolding: 46.40,
    fiiHolding: 22.60,
    diiHolding: 19.20,
    publicHolding: 11.80,
  },
  {
    ticker: "BAJFINANCE",
    name: "Bajaj Finance Ltd",
    exchange: "NSE",
    sector: "Financial Services",
    industry: "NBFC",
    price: 7234.80,
    change: -89.45,
    changePct: -1.22,
    marketCap: 437820,
    pe: 29.8,
    pb: 6.8,
    roe: 22.8,
    roce: 13.4,
    debtToEquity: 6.12,
    eps: 242.78,
    dividendYield: 0.41,
    high52w: 7829.95,
    low52w: 6188.05,
    volume: 2345000,
    avgVolume: 2180000,
    description: "Bajaj Finance is India's most valuable NBFC, known for consumer finance, SME lending, and digital lending innovation with 80M+ customers.",
    promoterHolding: 55.80,
    fiiHolding: 19.60,
    diiHolding: 15.30,
    publicHolding: 9.30,
  },
  {
    ticker: "HCLTECH",
    name: "HCL Technologies Ltd",
    exchange: "NSE",
    sector: "Information Technology",
    industry: "IT Services",
    price: 1589.70,
    change: 18.40,
    changePct: 1.17,
    marketCap: 431230,
    pe: 26.2,
    pb: 7.4,
    roe: 28.3,
    roce: 37.6,
    debtToEquity: 0.09,
    eps: 60.68,
    dividendYield: 3.65,
    high52w: 1944.30,
    low52w: 1235.55,
    volume: 5678000,
    avgVolume: 5230000,
    description: "HCL Tech is India's 3rd largest IT services company with strength in engineering services, products (HCL Software), and digital transformation.",
    promoterHolding: 60.80,
    fiiHolding: 16.20,
    diiHolding: 14.60,
    publicHolding: 8.40,
  },
  {
    ticker: "ONGC",
    name: "Oil & Natural Gas Corporation Ltd",
    exchange: "NSE",
    sector: "Energy",
    industry: "Oil & Gas",
    price: 254.70,
    change: 2.40,
    changePct: 0.95,
    marketCap: 320450,
    pe: 8.2,
    pb: 1.0,
    roe: 12.6,
    roce: 11.8,
    debtToEquity: 0.32,
    eps: 31.06,
    dividendYield: 5.26,
    high52w: 345.00,
    low52w: 214.40,
    volume: 23456000,
    avgVolume: 21890000,
    description: "ONGC is India's largest oil and gas exploration company, producing ~70% of India's domestic crude. Government owned with strategic energy importance.",
    promoterHolding: 58.90,
    fiiHolding: 8.40,
    diiHolding: 18.30,
    publicHolding: 14.40,
  },
  {
    ticker: "TITAN",
    name: "Titan Company Ltd",
    exchange: "NSE",
    sector: "Consumer Discretionary",
    industry: "Jewellery & Watches",
    price: 3412.55,
    change: 28.70,
    changePct: 0.85,
    marketCap: 303210,
    pe: 78.4,
    pb: 19.2,
    roe: 25.8,
    roce: 33.4,
    debtToEquity: 0.04,
    eps: 43.52,
    dividendYield: 0.29,
    high52w: 3886.00,
    low52w: 2794.45,
    volume: 1234000,
    avgVolume: 1120000,
    description: "Titan Company is India's largest consumer lifestyle company, with brands like Tanishq (jewellery), Titan (watches), Fastrack, and Eyeplus. Part of the Tata Group.",
    promoterHolding: 52.90,
    fiiHolding: 18.40,
    diiHolding: 19.30,
    publicHolding: 9.40,
  },
  {
    ticker: "PIDILITIND",
    name: "Pidilite Industries Ltd",
    exchange: "NSE",
    sector: "Materials",
    industry: "Adhesives & Chemicals",
    price: 2834.90,
    change: 15.35,
    changePct: 0.54,
    marketCap: 143870,
    pe: 72.8,
    pb: 18.5,
    roe: 25.5,
    roce: 34.2,
    debtToEquity: 0.00,
    eps: 38.94,
    dividendYield: 0.63,
    high52w: 3192.00,
    low52w: 2380.70,
    volume: 456000,
    avgVolume: 420000,
    description: "Pidilite is India's dominant adhesives and sealants company, maker of Fevicol, Dr. Fixit, M-Seal. Near-monopoly in construction adhesives with 70%+ market share.",
    promoterHolding: 70.00,
    fiiHolding: 11.20,
    diiHolding: 10.30,
    publicHolding: 8.50,
  },
  {
    ticker: "BAJAJFINSV",
    name: "Bajaj Finserv Ltd",
    exchange: "NSE",
    sector: "Financial Services",
    industry: "Diversified Financial",
    price: 1867.45,
    change: -12.30,
    changePct: -0.65,
    marketCap: 297850,
    pe: 31.2,
    pb: 4.8,
    roe: 15.4,
    roce: 11.2,
    debtToEquity: 0.23,
    eps: 59.85,
    dividendYield: 0.05,
    high52w: 2259.70,
    low52w: 1597.00,
    volume: 2345000,
    avgVolume: 2180000,
    description: "Bajaj Finserv is a diversified financial services conglomerate with stakes in Bajaj Finance (NBFC), Bajaj Allianz Life Insurance, and Bajaj Allianz General Insurance.",
    promoterHolding: 60.70,
    fiiHolding: 16.80,
    diiHolding: 13.40,
    publicHolding: 9.10,
  },
  {
    ticker: "TECHM",
    name: "Tech Mahindra Ltd",
    exchange: "NSE",
    sector: "Information Technology",
    industry: "IT Services",
    price: 1398.75,
    change: 22.45,
    changePct: 1.63,
    marketCap: 136780,
    pe: 32.4,
    pb: 4.6,
    roe: 14.2,
    roce: 18.8,
    debtToEquity: 0.11,
    eps: 43.18,
    dividendYield: 3.58,
    high52w: 1807.35,
    low52w: 1096.50,
    volume: 4567000,
    avgVolume: 4120000,
    description: "Tech Mahindra is an IT services company with a strong focus on telecom (BU1 vertical) and 5G. Part of the Mahindra Group, with 150,000+ employees in 90+ countries.",
    promoterHolding: 35.10,
    fiiHolding: 26.80,
    diiHolding: 20.40,
    publicHolding: 17.70,
  },
  {
    ticker: "POWERGRID",
    name: "Power Grid Corporation of India Ltd",
    exchange: "NSE",
    sector: "Utilities",
    industry: "Power Transmission",
    price: 298.45,
    change: 1.85,
    changePct: 0.62,
    marketCap: 277640,
    pe: 17.8,
    pb: 3.1,
    roe: 17.5,
    roce: 10.2,
    debtToEquity: 1.67,
    eps: 16.77,
    dividendYield: 5.25,
    high52w: 366.50,
    low52w: 235.85,
    volume: 9876000,
    avgVolume: 9230000,
    description: "Power Grid Corp is India's central transmission utility, owning and operating ~170,000 circuit km of transmission lines. A Government of India enterprise.",
    promoterHolding: 51.30,
    fiiHolding: 16.80,
    diiHolding: 18.60,
    publicHolding: 13.30,
  },
  {
    ticker: "DRREDDY",
    name: "Dr. Reddy's Laboratories Ltd",
    exchange: "NSE",
    sector: "Healthcare",
    industry: "Pharmaceutical",
    price: 1198.65,
    change: -8.90,
    changePct: -0.74,
    marketCap: 99870,
    pe: 18.4,
    pb: 3.2,
    roe: 17.4,
    roce: 22.8,
    debtToEquity: 0.12,
    eps: 65.14,
    dividendYield: 0.67,
    high52w: 1440.00,
    low52w: 1014.25,
    volume: 1234000,
    avgVolume: 1120000,
    description: "Dr. Reddy's is India's 2nd largest pharma company. Strong in US generics, biopharmaceuticals, and APIs. Known for complex generics and biosimilars strategy.",
    promoterHolding: 26.70,
    fiiHolding: 28.40,
    diiHolding: 22.90,
    publicHolding: 22.00,
  },
  {
    ticker: "ADANIENT",
    name: "Adani Enterprises Ltd",
    exchange: "NSE",
    sector: "Industrials",
    industry: "Diversified Industrials",
    price: 2378.90,
    change: 45.20,
    changePct: 1.94,
    marketCap: 270450,
    pe: 52.6,
    pb: 5.8,
    roe: 11.0,
    roce: 8.4,
    debtToEquity: 1.78,
    eps: 45.23,
    dividendYield: 0.04,
    high52w: 3743.00,
    low52w: 1840.10,
    volume: 3456000,
    avgVolume: 3120000,
    description: "Adani Enterprises is the flagship company of the Adani Group — a diversified conglomerate in airports, green energy, data centers, roads, and defense manufacturing.",
    promoterHolding: 72.60,
    fiiHolding: 11.20,
    diiHolding: 8.60,
    publicHolding: 7.60,
  },
  {
    ticker: "LTIM",
    name: "LTIMindtree Ltd",
    exchange: "NSE",
    sector: "Information Technology",
    industry: "IT Services",
    price: 4867.30,
    change: 67.80,
    changePct: 1.41,
    marketCap: 143890,
    pe: 29.4,
    pb: 6.8,
    roe: 23.2,
    roce: 30.8,
    debtToEquity: 0.00,
    eps: 165.55,
    dividendYield: 1.85,
    high52w: 6768.65,
    low52w: 4082.00,
    volume: 876000,
    avgVolume: 810000,
    description: "LTIMindtree (formed from merger of L&T Infotech and Mindtree) is a top-10 Indian IT services company with strong BFSI and manufacturing verticals.",
    promoterHolding: 68.60,
    fiiHolding: 13.80,
    diiHolding: 10.40,
    publicHolding: 7.20,
  },
  {
    ticker: "ZOMATO",
    name: "Zomato Ltd",
    exchange: "NSE",
    sector: "Consumer Discretionary",
    industry: "Food Delivery",
    price: 234.75,
    change: 5.65,
    changePct: 2.47,
    marketCap: 208890,
    pe: 312.4,
    pb: 8.9,
    roe: 2.8,
    roce: 3.6,
    debtToEquity: 0.00,
    eps: 0.75,
    dividendYield: 0.00,
    high52w: 304.70,
    low52w: 127.90,
    volume: 45678000,
    avgVolume: 42300000,
    description: "Zomato is India's largest food delivery platform with 55M+ monthly ordering users. Recently expanded into quick commerce (Blinkit) which is now the primary growth driver.",
    promoterHolding: 0.00,
    fiiHolding: 38.40,
    diiHolding: 25.80,
    publicHolding: 35.80,
  },
  {
    ticker: "COALINDIA",
    name: "Coal India Ltd",
    exchange: "NSE",
    sector: "Energy",
    industry: "Coal Mining",
    price: 387.45,
    change: -3.25,
    changePct: -0.83,
    marketCap: 238420,
    pe: 8.6,
    pb: 4.2,
    roe: 48.8,
    roce: 66.4,
    debtToEquity: 0.00,
    eps: 45.05,
    dividendYield: 6.45,
    high52w: 543.55,
    low52w: 348.70,
    volume: 8765000,
    avgVolume: 8120000,
    description: "Coal India is the world's largest coal producer and a Government of India enterprise. Accounts for ~80% of India's coal production with significant dividend payouts.",
    promoterHolding: 63.10,
    fiiHolding: 6.80,
    diiHolding: 17.40,
    publicHolding: 12.70,
  },
];

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    id: "n1",
    title: "Reliance Industries Q4 Results: Net profit rises 7% to ₹19,407 crore, beats estimates",
    summary: "RIL's Q4FY25 results exceeded analyst expectations with strong performance across O2C and retail segments. Jio's ARPU grew to ₹198, while retail segment showed 11% revenue growth.",
    source: "Economic Times",
    sourceUrl: "https://economictimes.indiatimes.com",
    url: "#",
    publishedAt: "2026-06-15T09:30:00Z",
    sentiment: "positive",
    topic: "Earnings",
    tickers: ["RELIANCE"],
    credibility: "high",
  },
  {
    id: "n2",
    title: "TCS misses Q1 revenue guidance; FY26 growth to be below industry average",
    summary: "TCS's revenue growth of 4.2% in Q1FY26 came below the company's own guidance of 5-7%. Management cited macro uncertainty in BFSI and retail verticals as key headwinds.",
    source: "Mint",
    sourceUrl: "https://livemint.com",
    url: "#",
    publishedAt: "2026-06-15T11:15:00Z",
    sentiment: "negative",
    topic: "Earnings",
    tickers: ["TCS"],
    credibility: "high",
  },
  {
    id: "n3",
    title: "HDFC Bank set for index rebalancing; FIIs may add ₹12,000 crore",
    summary: "HDFC Bank's weight in global EM indices is set to increase after MSCI rebalancing, potentially attracting significant foreign institutional inflows in the coming weeks.",
    source: "CNBC-TV18",
    sourceUrl: "https://cnbctv18.com",
    url: "#",
    publishedAt: "2026-06-14T14:00:00Z",
    sentiment: "positive",
    topic: "Institutional Activity",
    tickers: ["HDFCBANK"],
    credibility: "high",
  },
  {
    id: "n4",
    title: "Bharti Airtel to raise ₹20,000 crore via QIP to fund 5G expansion",
    summary: "Airtel announced a qualified institutional placement at ₹1,650/share to accelerate 5G network rollout and reduce debt. The offering was oversubscribed within hours of opening.",
    source: "Business Standard",
    sourceUrl: "https://business-standard.com",
    url: "#",
    publishedAt: "2026-06-14T10:45:00Z",
    sentiment: "neutral",
    topic: "Capital Raise",
    tickers: ["BHARTIARTL"],
    credibility: "high",
  },
  {
    id: "n5",
    title: "Infosys wins $1.5 billion contract with UK government for digital infrastructure",
    summary: "Infosys announced one of its largest-ever deals — a 7-year contract with HMRC for digital transformation. Management calls this a 'landmark win' for government vertical.",
    source: "Reuters",
    sourceUrl: "https://reuters.com",
    url: "#",
    publishedAt: "2026-06-13T16:30:00Z",
    sentiment: "positive",
    topic: "Business Win",
    tickers: ["INFY"],
    credibility: "high",
  },
  {
    id: "n6",
    title: "Asian Paints faces pressure as raw material costs spike 15% in Q1",
    summary: "Asian Paints' margins are under pressure as TiO2 and other raw material prices have spiked. Analysts expect 100-150bps gross margin compression in Q1FY26.",
    source: "Moneycontrol",
    sourceUrl: "https://moneycontrol.com",
    url: "#",
    publishedAt: "2026-06-13T12:00:00Z",
    sentiment: "negative",
    topic: "Raw Materials",
    tickers: ["ASIANPAINT"],
    credibility: "medium",
  },
  {
    id: "n7",
    title: "Bajaj Finance launches 'BFL Pay' super app targeting 100M customers",
    summary: "Bajaj Finance unveiled its comprehensive financial super app that integrates lending, insurance, investments, and payments. Plans to reach 100M users in 3 years.",
    source: "Financial Express",
    sourceUrl: "https://financialexpress.com",
    url: "#",
    publishedAt: "2026-06-12T09:00:00Z",
    sentiment: "positive",
    topic: "Strategy",
    tickers: ["BAJFINANCE"],
    credibility: "high",
  },
  {
    id: "n8",
    title: "Sebi cracks down on F&O: Weekly options restricted to only 1 per exchange",
    summary: "SEBI's new derivatives framework limits each exchange to one weekly options expiry. This significantly reduces speculative F&O activity and may impact market volumes.",
    source: "SEBI",
    sourceUrl: "https://sebi.gov.in",
    url: "#",
    publishedAt: "2026-06-12T16:00:00Z",
    sentiment: "negative",
    topic: "Regulation",
    tickers: [],
    credibility: "high",
  },
  {
    id: "n9",
    title: "Indian IT sector outlook: Morgan Stanley upgrades sector to 'Overweight'",
    summary: "Morgan Stanley raised its view on Indian IT, citing AI-led deal acceleration and improving US tech spending. TCS and Infosys are top picks with 20%+ upside targets.",
    source: "Morgan Stanley Research",
    sourceUrl: "https://morganstanley.com",
    url: "#",
    publishedAt: "2026-06-11T10:30:00Z",
    sentiment: "positive",
    topic: "Analyst Rating",
    tickers: ["TCS", "INFY", "HCLTECH", "WIPRO"],
    credibility: "high",
  },
  {
    id: "n10",
    title: "Tata Motors JLR: EV range expansion with 3 new models in FY26",
    summary: "JLR plans to launch Range Rover Electric, Defender Electric, and Discovery Electric in FY26. Management expects 40% of JLR revenue from EVs by FY28.",
    source: "Auto Car India",
    sourceUrl: "https://autocarindia.com",
    url: "#",
    publishedAt: "2026-06-11T14:00:00Z",
    sentiment: "positive",
    topic: "Product Launch",
    tickers: ["TATAMOTORS"],
    credibility: "medium",
  },
  {
    id: "n11",
    title: "RBI keeps repo rate unchanged at 6.25%; GDP growth forecast raised to 7.2%",
    summary: "The Reserve Bank of India held rates steady as expected, while raising India's GDP growth forecast. Inflation trajectory remains comfortable with food prices easing.",
    source: "RBI",
    sourceUrl: "https://rbi.org.in",
    url: "#",
    publishedAt: "2026-06-10T14:30:00Z",
    sentiment: "positive",
    topic: "Macro",
    tickers: [],
    credibility: "high",
  },
  {
    id: "n12",
    title: "ICICI Bank promoter stake: Confusion over holding; clarification awaited",
    summary: "Shareholding pattern discrepancy flagged by proxy advisory firms. ICICI Bank has zero promoter stake since demerger from ICICI Ltd in 2002 — this remains a common investor query.",
    source: "Moneycontrol",
    sourceUrl: "https://moneycontrol.com",
    url: "#",
    publishedAt: "2026-06-10T09:00:00Z",
    sentiment: "neutral",
    topic: "Shareholding",
    tickers: ["ICICIBANK"],
    credibility: "medium",
  },
];

export const FILINGS: Filing[] = [
  { id: "f1", ticker: "RELIANCE", type: "Board Meeting", title: "Q4FY25 Financial Results — Board Meeting Outcome", date: "2026-05-20", exchange: "NSE", url: "#", category: "announcement" },
  { id: "f2", ticker: "RELIANCE", type: "Annual Report", title: "Annual Report FY2024-25", date: "2026-05-15", exchange: "BSE", url: "#", category: "filings" },
  { id: "f3", ticker: "RELIANCE", type: "Shareholding", title: "Shareholding Pattern Q4FY25 (March 2026)", date: "2026-04-25", exchange: "NSE", url: "#", category: "shareholding" },
  { id: "f4", ticker: "RELIANCE", type: "Insider Trade", title: "Disclosure of Purchase by Director", date: "2026-04-12", exchange: "NSE", url: "#", category: "insider" },
  { id: "f5", ticker: "RELIANCE", type: "Announcement", title: "Outcome of AGM 2025", date: "2026-03-20", exchange: "BSE", url: "#", category: "announcement" },
  { id: "f6", ticker: "TCS", type: "Board Meeting", title: "Q4FY25 Financial Results — Board Meeting Outcome", date: "2026-05-17", exchange: "NSE", url: "#", category: "announcement" },
  { id: "f7", ticker: "TCS", type: "Dividend", title: "Final Dividend of ₹28/share declared", date: "2026-05-17", exchange: "NSE", url: "#", category: "announcement" },
  { id: "f8", ticker: "TCS", type: "Shareholding", title: "Shareholding Pattern Q4FY25", date: "2026-04-22", exchange: "NSE", url: "#", category: "shareholding" },
  { id: "f9", ticker: "INFY", type: "Board Meeting", title: "Q4FY25 Results — Investor Presentation", date: "2026-05-14", exchange: "NSE", url: "#", category: "filings" },
  { id: "f10", ticker: "HDFCBANK", type: "Board Meeting", title: "Q4FY25 Financial Results", date: "2026-05-18", exchange: "NSE", url: "#", category: "announcement" },
];

export const FINANCIAL_DATA: Record<string, FinancialData> = {
  RELIANCE: {
    ticker: "RELIANCE",
    quarterlyRevenue: [
      { quarter: "Q1FY24", revenue: 208669, profit: 16011 },
      { quarter: "Q2FY24", revenue: 215513, profit: 17394 },
      { quarter: "Q3FY24", revenue: 224869, profit: 18951 },
      { quarter: "Q4FY24", revenue: 236502, profit: 18951 },
      { quarter: "Q1FY25", revenue: 234996, profit: 15138 },
      { quarter: "Q2FY25", revenue: 235481, profit: 16563 },
      { quarter: "Q3FY25", revenue: 244398, profit: 18540 },
      { quarter: "Q4FY25", revenue: 262000, profit: 19407 },
    ],
    annualRevenue: [
      { year: "FY21", revenue: 530177, profit: 49128, ebitda: 95014 },
      { year: "FY22", revenue: 721634, profit: 67845, ebitda: 124710 },
      { year: "FY23", revenue: 876169, profit: 74088, ebitda: 148034 },
      { year: "FY24", revenue: 899042, profit: 79020, ebitda: 162282 },
      { year: "FY25", revenue: 976875, profit: 73648, ebitda: 178420 },
    ],
    priceHistory: Array.from({ length: 180 }, (_, i) => ({
      date: new Date(Date.now() - (179 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      price: 2400 + Math.sin(i * 0.05) * 200 + Math.random() * 100 + i * 1.5,
      volume: Math.floor(7000000 + Math.random() * 3000000),
    })),
  },
  TCS: {
    ticker: "TCS",
    quarterlyRevenue: [
      { quarter: "Q1FY24", revenue: 59381, profit: 11074 },
      { quarter: "Q2FY24", revenue: 59692, profit: 11358 },
      { quarter: "Q3FY24", revenue: 63973, profit: 11735 },
      { quarter: "Q4FY24", revenue: 61237, profit: 12434 },
      { quarter: "Q1FY25", revenue: 62613, profit: 12040 },
      { quarter: "Q2FY25", revenue: 63001, profit: 11909 },
      { quarter: "Q3FY25", revenue: 63973, profit: 12380 },
      { quarter: "Q4FY25", revenue: 64479, profit: 12224 },
    ],
    annualRevenue: [
      { year: "FY21", revenue: 164177, profit: 38327, ebitda: 44975 },
      { year: "FY22", revenue: 191754, profit: 38327, ebitda: 50045 },
      { year: "FY23", revenue: 225458, profit: 42147, ebitda: 60000 },
      { year: "FY24", revenue: 240893, profit: 45908, ebitda: 67000 },
      { year: "FY25", revenue: 254066, profit: 48553, ebitda: 72000 },
    ],
    priceHistory: Array.from({ length: 180 }, (_, i) => ({
      date: new Date(Date.now() - (179 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      price: 3200 + Math.sin(i * 0.04) * 180 + Math.random() * 80 + i * 0.8,
      volume: Math.floor(2500000 + Math.random() * 1200000),
    })),
  },
};

for (const stock of STOCKS) {
  if (!FINANCIAL_DATA[stock.ticker]) {
    const basePrice = stock.price * 0.75;
    FINANCIAL_DATA[stock.ticker] = {
      ticker: stock.ticker,
      quarterlyRevenue: Array.from({ length: 8 }, (_, i) => ({
        quarter: `Q${(i % 4) + 1}FY${i < 4 ? 24 : 25}`,
        revenue: Math.floor(stock.marketCap * 0.04 + Math.random() * stock.marketCap * 0.01),
        profit: Math.floor(stock.marketCap * 0.008 + Math.random() * stock.marketCap * 0.002),
      })),
      annualRevenue: Array.from({ length: 5 }, (_, i) => ({
        year: `FY${21 + i}`,
        revenue: Math.floor(stock.marketCap * 0.14 * (0.85 + i * 0.04)),
        profit: Math.floor(stock.marketCap * 0.025 * (0.8 + i * 0.05)),
        ebitda: Math.floor(stock.marketCap * 0.045 * (0.82 + i * 0.04)),
      })),
      priceHistory: Array.from({ length: 180 }, (_, i) => ({
        date: new Date(Date.now() - (179 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        price: basePrice + Math.sin(i * 0.05) * basePrice * 0.08 + Math.random() * basePrice * 0.03 + i * (stock.price - basePrice) / 180,
        volume: Math.floor(stock.avgVolume * (0.7 + Math.random() * 0.6)),
      })),
    };
  }
}

export const LEARNING_MODULES: LearningModule[] = [
  {
    id: "lm1",
    title: "Understanding P/E Ratio",
    description: "Learn what the Price-to-Earnings ratio tells you about a stock's valuation",
    level: "beginner",
    duration: 8,
    topics: ["Valuation", "Fundamentals"],
    content: [
      {
        section: "What is P/E Ratio?",
        text: "The Price-to-Earnings (P/E) ratio is the most widely used valuation metric. It tells you how much investors are willing to pay for every ₹1 of company earnings. Formula: P/E = Market Price / Earnings Per Share (EPS). Example: If a stock trades at ₹100 and EPS is ₹5, P/E = 20x."
      },
      {
        section: "How to Interpret P/E",
        text: "A high P/E (30x+) suggests investors expect high future growth. A low P/E (<15x) may indicate undervaluation or slow growth expectations. Always compare P/E within the same sector — a bank's P/E cannot be compared to an IT company's. Compare to: (1) Historical P/E of the same company, (2) Sector average P/E, (3) Market P/E (Nifty P/E is typically 18-25x)."
      },
      {
        section: "P/E Limitations",
        text: "P/E doesn't work for: loss-making companies (negative EPS), cyclical businesses where earnings vary wildly, companies with heavy debt (use EV/EBITDA instead). Always use P/E alongside other metrics like PEG ratio, P/B, and ROE."
      }
    ]
  },
  {
    id: "lm2",
    title: "Return on Equity (ROE) Explained",
    description: "Understand how efficiently a company uses shareholder capital to generate profits",
    level: "beginner",
    duration: 10,
    topics: ["Profitability", "Fundamentals"],
    content: [
      {
        section: "What is ROE?",
        text: "ROE = Net Profit / Shareholders' Equity × 100. It measures how much profit a company generates for every ₹100 of shareholder money. Example: If net profit is ₹500 crore and equity is ₹2,500 crore, ROE = 20%."
      },
      {
        section: "What's a Good ROE?",
        text: "ROE above 15% is generally considered good. Above 20% is excellent. Warren Buffett looks for companies with ROE above 15% consistently over 10+ years. High ROE + low debt = a quality business. Watch out: high ROE from excessive debt (check D/E ratio)."
      },
      {
        section: "DuPont Analysis",
        text: "ROE = Net Profit Margin × Asset Turnover × Equity Multiplier. This decomposition shows WHY ROE is high: Is it great margins? Efficient asset use? Or financial leverage? A software company may have high ROE via margins; a retail chain via turnover."
      }
    ]
  },
  {
    id: "lm3",
    title: "Reading a Balance Sheet",
    description: "Learn to decode a company's assets, liabilities, and equity",
    level: "intermediate",
    duration: 15,
    topics: ["Balance Sheet", "Accounting"],
    content: [
      {
        section: "Balance Sheet Structure",
        text: "Assets = Liabilities + Equity. Assets: What the company owns (cash, inventory, property). Liabilities: What it owes (loans, payables). Equity: What's left for shareholders. Always check if the balance sheet is 'growing rich' (cash/investments) or 'growing debt-heavy'."
      },
      {
        section: "Key Ratios from Balance Sheet",
        text: "Current Ratio = Current Assets / Current Liabilities (>1.5 preferred). Debt-to-Equity = Total Debt / Equity (<1 preferred for most businesses). Quick Ratio = (Cash + Receivables) / Current Liabilities (>1 preferred)."
      }
    ]
  },
  {
    id: "lm4",
    title: "Promoter Holding Analysis",
    description: "Why promoter shareholding trends matter for investment decisions",
    level: "beginner",
    duration: 7,
    topics: ["Shareholding", "Governance"],
    content: [
      {
        section: "What is Promoter Holding?",
        text: "Promoters are the founding family or original investors who control the company. High promoter holding (50%+) usually means alignment with minority shareholders. A promoter consistently increasing stake is a bullish signal. Falling promoter stake without disclosed reason is a red flag."
      },
      {
        section: "Pledging Alert",
        text: "If promoters have pledged (borrowed against) their shares, it's risky. Check the 'pledged %' in shareholding data. High pledging + falling stock price can trigger a forced sell-off (cascade). SEBI mandates disclosure of pledging above 20% of total promoter holding."
      }
    ]
  },
  {
    id: "lm5",
    title: "How to Read Corporate Announcements",
    description: "Understand what BSE/NSE filings and corporate announcements reveal",
    level: "beginner",
    duration: 12,
    topics: ["Filings", "Research Process"],
    content: [
      {
        section: "Types of Announcements",
        text: "Board Meeting Outcome: Results, dividends, buybacks. AGM: Annual General Meeting minutes. Shareholding Pattern: Filed quarterly — check promoter + FII/DII trends. Insider Trading: Directors/promoters buying/selling is a signal. Credit Rating: Rating changes impact debt cost and sentiment."
      },
      {
        section: "Where to Find Filings",
        text: "NSE: https://nseindia.com → Corporate Announcements. BSE: https://bseindia.com → Corporate Filings. SEBI EDGAR: For insider trading disclosures. Annual Reports: Available on company investor relations pages."
      }
    ]
  },
  {
    id: "lm6",
    title: "Peer Comparison & Sector Analysis",
    description: "How to compare companies within the same sector to identify the best performer",
    level: "intermediate",
    duration: 14,
    topics: ["Valuation", "Sector Analysis"],
    content: [
      {
        section: "Why Compare Peers?",
        text: "No stock exists in isolation. A bank with 15% ROE may be great if peers have 10%, or poor if peers have 25%. Identify 3-5 true peers: similar size, same product line, same geography. Use sector-appropriate metrics."
      },
      {
        section: "Key Comparison Metrics by Sector",
        text: "Banks: ROA, NIM, GNPA, PCR. IT: Revenue growth, EBIT margin, employee count. FMCG: Volume growth, gross margin, distribution network. Pharma: R&D as % of sales, export mix, ANDA filings. Auto: Volume growth, EBITDA/vehicle, EV pipeline."
      }
    ]
  },
];

export const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { ticker: "RELIANCE", addedAt: "2026-01-10T00:00:00Z", notes: "Watch for Jio IPO announcement", targetPrice: 3200, alertAt: 3000 },
  { ticker: "TCS", addedAt: "2026-02-15T00:00:00Z", notes: "AI deal pipeline improving", targetPrice: 4200, alertAt: 3500 },
  { ticker: "HDFCBANK", addedAt: "2026-03-01T00:00:00Z", notes: "Post-merger integration on track", targetPrice: 1900, alertAt: 1700 },
  { ticker: "BHARTIARTL", addedAt: "2026-03-20T00:00:00Z", notes: "5G monetization play", targetPrice: 1900, alertAt: null },
  { ticker: "BAJFINANCE", addedAt: "2026-04-05T00:00:00Z", notes: "Monitoring asset quality", targetPrice: 8000, alertAt: 7000 },
];

export const SAMPLE_NOTES: ResearchNote[] = [
  {
    id: "rn1",
    ticker: "RELIANCE",
    title: "Reliance Investment Thesis — FY26",
    content: "Reliance is undergoing a massive transformation from a commodity/energy company to a consumer-tech company. Three pillars: Jio (digital), Retail (omnichannel), and O2C (cash cow).",
    thesis: "Buy for Jio IPO value unlock and retail scale-up. O2C provides steady cash flows while new commerce segments drive re-rating.",
    bullCase: "Jio IPO at 2x FY27 revenue = ₹3,000+ for RIL. Retail becomes #1 in India by GMV. New Energy bets pay off.",
    bearCase: "Jio IPO delayed beyond FY27. Global crude crash hurts O2C margins. Retail faces Amazon/Flipkart pricing war.",
    tags: ["diversified", "large-cap", "value-unlock"],
    createdAt: "2026-05-01T10:00:00Z",
    updatedAt: "2026-06-10T14:30:00Z",
  },
  {
    id: "rn2",
    ticker: "TCS",
    title: "TCS — Quality at a Fair Price?",
    content: "TCS is the gold standard of Indian IT. 46% ROE, debt-free, consistent dividend payer. The question is always about growth velocity vs valuation.",
    thesis: "Hold with accumulate on dips. AI-led deal acceleration in H2FY26 could re-rate the stock above 30x PE.",
    bullCase: "GenAI deals reach $3B annually. BFSI recovery in US. Margin expansion from AI automation of delivery.",
    bearCase: "US recession hurts discretionary IT spend. Competition from Accenture in large deals. Rupee appreciation.",
    tags: ["IT", "quality", "large-cap", "dividend"],
    createdAt: "2026-04-15T09:00:00Z",
    updatedAt: "2026-06-01T16:00:00Z",
  },
];

export const MARKET_INDICES = [
  { name: "NIFTY 50", value: 24678.35, change: 187.45, changePct: 0.76 },
  { name: "SENSEX", value: 81247.90, change: 623.30, changePct: 0.77 },
  { name: "NIFTY BANK", value: 52341.20, change: -124.55, changePct: -0.24 },
  { name: "NIFTY IT", value: 37892.45, change: 412.80, changePct: 1.10 },
  { name: "NIFTY MIDCAP 100", value: 53219.75, change: 342.15, changePct: 0.65 },
  { name: "INDIA VIX", value: 13.45, change: -0.82, changePct: -5.75 },
];

export const SECTORS = [
  "Financial Services",
  "Information Technology",
  "Energy",
  "FMCG",
  "Healthcare",
  "Consumer Discretionary",
  "Materials",
  "Communication Services",
  "Industrials",
  "Utilities",
];

export function getStockByTicker(ticker: string): Stock | undefined {
  return STOCKS.find((s) => s.ticker === ticker);
}

export function getStocksByTickers(tickers: string[]): Stock[] {
  return STOCKS.filter((s) => tickers.includes(s.ticker));
}

export function searchStocks(query: string): Stock[] {
  const q = query.toLowerCase();
  return STOCKS.filter(
    (s) =>
      s.ticker.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.sector.toLowerCase().includes(q)
  );
}

export function getNewsByTicker(ticker: string): NewsArticle[] {
  return NEWS_ARTICLES.filter((n) => n.tickers.includes(ticker) || n.tickers.length === 0);
}

export function getFilingsByTicker(ticker: string): Filing[] {
  return FILINGS.filter((f) => f.ticker === ticker);
}

export function getPeersByTicker(ticker: string): Stock[] {
  const stock = getStockByTicker(ticker);
  if (!stock) return [];
  return STOCKS.filter((s) => s.sector === stock.sector && s.ticker !== ticker).slice(0, 5);
}

export function formatCrore(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L Cr`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K Cr`;
  return `₹${value.toFixed(0)} Cr`;
}

export function formatPrice(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function calcCAGR(start: number, end: number, years: number): number {
  if (start <= 0 || years <= 0) return 0;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

export type PLRow = {
  year: string;
  revenue: number;
  expenses: number;
  ebitda: number;
  ebitdaMargin: number;
  depreciation: number;
  ebit: number;
  interest: number;
  pbt: number;
  tax: number;
  pat: number;
  patMargin: number;
  eps: number;
  dps: number; // dividend per share
};

export type BSRow = {
  year: string;
  shareCapital: number;
  reserves: number;
  totalEquity: number;
  longTermDebt: number;
  shortTermDebt: number;
  totalDebt: number;
  otherLiabilities: number;
  totalLiabilities: number;
  netFixedAssets: number;
  cwip: number;
  investments: number;
  tradeReceivables: number;
  inventories: number;
  cash: number;
  otherCurrentAssets: number;
  totalAssets: number;
};

export type CFRow = {
  year: string;
  operating: number;
  investing: number;
  financing: number;
  netCashFlow: number;
  freeCashFlow: number; // operating + capex (investing is negative)
};

export type DividendRecord = {
  year: string;
  dps: number;       // dividend per share (Rs)
  yield: number;     // yield at year-end price (%)
  exDate: string;
};

export function generatePL(ticker: string): PLRow[] {
  const fd = FINANCIAL_DATA[ticker];
  if (!fd) return [];
  return fd.annualRevenue.map((ar) => {
    const revenue = ar.revenue;
    const ebitda = ar.ebitda;
    const ebitdaMargin = (ebitda / revenue) * 100;
    const depreciation = ebitda * 0.22;
    const ebit = ebitda - depreciation;
    const stock = getStockByTicker(ticker);
    const deRatio = stock?.debtToEquity ?? 0.3;
    const interest = ebit * 0.12 * Math.min(deRatio, 2);
    const pbt = ebit - interest;
    const taxRate = 0.25;
    const pat = ar.profit;
    const tax = pbt - pat;
    const shares = (stock?.marketCap ?? 1000) / (stock?.price ?? 100);
    const eps = (pat / shares) * 100;
    const dps = eps * (stock?.dividendYield ?? 0.5) / 100 * (stock?.price ?? 100) / eps;
    return {
      year: ar.year,
      revenue,
      expenses: revenue - ebitda,
      ebitda,
      ebitdaMargin: parseFloat(ebitdaMargin.toFixed(1)),
      depreciation: parseFloat(depreciation.toFixed(0)),
      ebit: parseFloat(ebit.toFixed(0)),
      interest: parseFloat(interest.toFixed(0)),
      pbt: parseFloat(pbt.toFixed(0)),
      tax: parseFloat(tax.toFixed(0)),
      pat,
      patMargin: parseFloat(((pat / revenue) * 100).toFixed(1)),
      eps: parseFloat(eps.toFixed(2)),
      dps: parseFloat((eps * 0.18).toFixed(2)),
    };
  });
}

export function generateBS(ticker: string): BSRow[] {
  const fd = FINANCIAL_DATA[ticker];
  const stock = getStockByTicker(ticker);
  if (!fd || !stock) return [];
  return fd.annualRevenue.map((ar, i) => {
    const scaleFactor = 0.8 + i * 0.05;
    const mcap = stock.marketCap * scaleFactor;
    const shareCapital = Math.round(mcap * 0.003);
    const reserves = Math.round(mcap * 0.34);
    const totalEquity = shareCapital + reserves;
    const longTermDebt = Math.round(mcap * 0.18 * (1 - i * 0.03));
    const shortTermDebt = Math.round(mcap * 0.05);
    const totalDebt = longTermDebt + shortTermDebt;
    const otherLiabilities = Math.round(mcap * 0.12);
    const totalLiabilities = totalEquity + totalDebt + otherLiabilities;
    const netFixedAssets = Math.round(mcap * 0.38);
    const cwip = Math.round(mcap * 0.06);
    const investments = Math.round(mcap * 0.15);
    const tradeReceivables = Math.round(ar.revenue * 0.06);
    const inventories = Math.round(ar.revenue * 0.07);
    const cash = Math.round(mcap * 0.07 * (1 + i * 0.1));
    const otherCurrentAssets = totalLiabilities - netFixedAssets - cwip - investments - tradeReceivables - inventories - cash;
    return {
      year: ar.year,
      shareCapital, reserves, totalEquity,
      longTermDebt, shortTermDebt, totalDebt,
      otherLiabilities, totalLiabilities,
      netFixedAssets, cwip, investments,
      tradeReceivables, inventories, cash,
      otherCurrentAssets: Math.max(0, otherCurrentAssets),
      totalAssets: totalLiabilities,
    };
  });
}

export function generateCF(ticker: string): CFRow[] {
  const fd = FINANCIAL_DATA[ticker];
  if (!fd) return [];
  return fd.annualRevenue.map((ar) => {
    const operating = Math.round(ar.ebitda * 0.85);
    const investing = -Math.round(ar.ebitda * 0.65);
    const financing = Math.round((operating + investing) * -0.4);
    const netCashFlow = operating + investing + financing;
    const freeCashFlow = operating + Math.round(investing * 0.5); // operating - maintenance capex
    return {
      year: ar.year,
      operating, investing, financing, netCashFlow, freeCashFlow,
    };
  });
}

export function generateDividendHistory(ticker: string): DividendRecord[] {
  const stock = getStockByTicker(ticker);
  if (!stock || stock.dividendYield === 0) return [];
  const years = ["FY21", "FY22", "FY23", "FY24", "FY25"];
  const basePrice = stock.price * 0.65;
  return years.map((year, i) => {
    const price = basePrice + i * ((stock.price - basePrice) / 4);
    const dps = parseFloat((stock.eps * 0.18 * (0.9 + i * 0.03)).toFixed(2));
    const yld = parseFloat(((dps / price) * 100).toFixed(2));
    const month = ["Jun", "Aug", "Jul", "Jun", "Jun"][i];
    return {
      year,
      dps,
      yield: yld,
      exDate: `${15 + i} ${month} 202${1 + i}`,
    };
  });
}

export type ShareholderTrendRow = {
  quarter: string;
  promoter: number;
  promoterPledged: number;
  fii: number;
  dii: number;
  public: number;
  totalShareholders: number;
};

export function generateShareholderTrend(ticker: string): ShareholderTrendRow[] {
  const stock = getStockByTicker(ticker);
  if (!stock) return [];
  const quarters = ["Mar 2024", "Jun 2024", "Sep 2024", "Dec 2024", "Mar 2025"];
  return quarters.map((q, i) => ({
    quarter: q,
    promoter: parseFloat((stock.promoterHolding + (i - 2) * 0.1).toFixed(2)),
    promoterPledged: parseFloat((stock.promoterHolding * 0.07 * (1 - i * 0.05)).toFixed(2)),
    fii: parseFloat((stock.fiiHolding + (i - 2) * 0.15).toFixed(2)),
    dii: parseFloat((stock.diiHolding + (i - 2) * -0.08).toFixed(2)),
    public: parseFloat((stock.publicHolding + (i - 2) * -0.07).toFixed(2)),
    totalShareholders: Math.round(850000 + i * 45000 + Math.random() * 20000),
  }));
}

export type HistoricalRatios = {
  year: string;
  pe: number;
  pb: number;
  roe: number;
  roce: number;
  eps: number;
  dividendYield: number;
};

export function generateHistoricalRatios(ticker: string): HistoricalRatios[] {
  const stock = getStockByTicker(ticker);
  if (!stock) return [];
  return ["FY21", "FY22", "FY23", "FY24", "FY25"].map((year, i) => ({
    year,
    pe: parseFloat((stock.pe * (0.75 + i * 0.07)).toFixed(1)),
    pb: parseFloat((stock.pb * (0.72 + i * 0.08)).toFixed(1)),
    roe: parseFloat((stock.roe * (0.8 + i * 0.06)).toFixed(1)),
    roce: parseFloat((stock.roce * (0.78 + i * 0.07)).toFixed(1)),
    eps: parseFloat((stock.eps * (0.55 + i * 0.12)).toFixed(2)),
    dividendYield: parseFloat((stock.dividendYield * (1.1 - i * 0.05)).toFixed(2)),
  }));
}

export function getRevenueCagr(ticker: string, years: 3 | 5): number {
  const fd = FINANCIAL_DATA[ticker];
  if (!fd || fd.annualRevenue.length < years) return 0;
  const arr = fd.annualRevenue;
  const start = arr[arr.length - 1 - years].revenue;
  const end = arr[arr.length - 1].revenue;
  return parseFloat(calcCAGR(start, end, years).toFixed(1));
}

export function getProfitCagr(ticker: string, years: 3 | 5): number {
  const fd = FINANCIAL_DATA[ticker];
  if (!fd || fd.annualRevenue.length < years) return 0;
  const arr = fd.annualRevenue;
  const start = arr[arr.length - 1 - years].profit;
  const end = arr[arr.length - 1].profit;
  return parseFloat(calcCAGR(start, end, years).toFixed(1));
}

export function getStockReturn(ticker: string, years: 3 | 5): number {
  const stock = getStockByTicker(ticker);
  if (!stock) return 0;
  const fd = FINANCIAL_DATA[ticker];
  if (!fd || fd.priceHistory.length < 2) return 0;
  const hist = fd.priceHistory;
  const targetIndex = hist.length - 1 - years * 365;
  const startPrice = targetIndex >= 0 ? hist[Math.max(0, targetIndex)].price : hist[0].price;
  const endPrice = hist[hist.length - 1].price;
  return parseFloat(calcCAGR(startPrice, endPrice, years).toFixed(1));
}
