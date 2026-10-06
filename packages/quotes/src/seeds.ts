export type Seed = { symbol: string; name: string; price: number }

export const SIMULATED_SEEDS: readonly Seed[] = [
  { symbol: "AMZN", name: "AMAZON.COM, INC.", price: 175.4 },
  { symbol: "AAPL", name: "APPLE INC.", price: 180.22 },
  { symbol: "DIS", name: "THE WALT DISNEY", price: 83.31 },
  { symbol: "WMM", name: "Wal Mart de Mexico", price: 27.36 },
  { symbol: "MSFT", name: "MICROSOFT", price: 157.56 },
  { symbol: "KO", name: "THE COCA-COLA", price: 68.38 },
  { symbol: "FDX", name: "FEDEX", price: 204.59 },
  { symbol: "JNJ", name: "JOHNSON &", price: 150.7 },
  { symbol: "META", name: "Meta Platforms, Inc.", price: 518.41 },
  { symbol: "NFLX", name: "NETFLIX, INC.", price: 873.65 },
  { symbol: "ADBE", name: "ADOBE INC.", price: 339.63 },
  { symbol: "INTC", name: "INTEL", price: 19.55 },
  { symbol: "V", name: "VISA INC.", price: 312.94 },
  { symbol: "PYPL", name: "PAYPAL HOLDINGS", price: 58.57 },
  { symbol: "AXP", name: "AMERICAN EXPRESS", price: 234.13 },
  { symbol: "GM", name: "GENERAL MOTORS", price: 43.5 },
  { symbol: "XOM", name: "EXXON MOBIL", price: 102.8 },
  { symbol: "CVX", name: "CHEVRON", price: 139.98 },
  { symbol: "SHEL", name: "SHELL PLC", price: 62.42 },
  { symbol: "BA", name: "THE BOEING", price: 137.96 },
  { symbol: "MMM", name: "3M COMPANY", price: 128.16 },
  { symbol: "F", name: "FORD MOTOR", price: 9.27 },
]

export const DEFAULT_TICKERS: readonly string[] = SIMULATED_SEEDS.map((seed) => seed.symbol)
