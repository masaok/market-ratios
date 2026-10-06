"use client"

import {
  DEFAULT_TICKERS,
  createFinnhubProvider,
  createSimulatedProvider,
  parseSymbol,
  probeFinnhubKey,
  type ProviderStatus,
  type QuoteProvider,
  type Symbol,
} from "@market-ratios/quotes"
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react"
import { Grid, type CellModel, type ColumnModel } from "./grid"
import "./grid.css"
import {
  COL,
  changePercent,
  formatPercent,
  formatPrice,
  initialGrid,
  reduceGrid,
  symbolForRow,
  type Addr,
  type GridState,
} from "./model"
import { QuoteBook, type NameSlice, type PriceSlice } from "./quote-book"
import { loadSheet, saveSheet } from "./storage"

// One book for the page, so a tick notifies the price cell and not the grid.
const book = new QuoteBook()

function initialMonitorState(tickers: readonly string[] | undefined): GridState {
  if (tickers) return initialGrid(tickers)
  if (typeof window === "undefined") return initialGrid(DEFAULT_TICKERS)
  const saved = loadSheet()
  if (saved && saved.tickers.length > 0) return initialGrid(saved.tickers)
  return initialGrid(DEFAULT_TICKERS)
}

function initialApiKey(): string | null {
  if (typeof window === "undefined") return null
  return loadSheet()?.apiKey ?? null
}

// In COL order.
const COLUMNS: readonly ColumnModel[] = [
  { label: "Company", className: "company" },
  { label: "Ticker", className: "ticker" },
  { label: "Price", className: "price" },
  { label: "Change", className: "change" },
]

export function StockMonitor({
  provider: providerOverride,
  tickers,
  onTickersChange,
}: {
  provider?: QuoteProvider
  tickers?: readonly string[]
  onTickersChange?: (tickers: string[]) => void
}) {
  const [state, setState] = useState<GridState>(() => initialMonitorState(tickers))
  const [apiKey, setApiKey] = useState<string | null>(initialApiKey)
  const [status, setStatus] = useState<ProviderStatus>({ kind: "simulated" })
  const [keyOpen, setKeyOpen] = useState(false)
  const [keyDraft, setKeyDraft] = useState("")
  const [keyError, setKeyError] = useState<string | null>(null)

  useEffect(() => {
    const next = state.tickers.filter((ticker) => ticker.length > 0)
    if (onTickersChange) {
      onTickersChange(next)
      return
    }
    saveSheet({ tickers: next, apiKey })
  }, [state.tickers, apiKey, onTickersChange])

  const provider = useMemo(() => {
    if (providerOverride) return providerOverride
    if (apiKey) return createFinnhubProvider({ token: apiKey })
    return createSimulatedProvider()
  }, [providerOverride, apiKey])

  const tickerKey = state.tickers.join("\n")
  const symbols = useMemo(() => {
    const parsed: Symbol[] = []
    for (const raw of tickerKey.split("\n")) {
      const symbol = parseSymbol(raw)
      if (symbol) parsed.push(symbol)
    }
    return parsed
  }, [tickerKey])

  useEffect(() => {
    const live = symbols.slice(0, provider.limits.maxSymbols)
    const unsubscribe = provider.subscribe(live, (quote) => book.applyQuote(quote))
    const unstatus = provider.onStatus(setStatus)
    let cancelled = false
    for (const symbol of live) {
      provider.getSnapshot(symbol).then(
        (snapshot) => {
          if (!cancelled) book.applySnapshot(snapshot)
        },
        () => {
          // The status listener reports an invalid key. This row stays blank.
        },
      )
    }
    return () => {
      cancelled = true
      unsubscribe()
      unstatus()
    }
  }, [provider, symbols])

  const capped = useMemo(() => {
    return new Set(symbols.slice(provider.limits.maxSymbols))
  }, [symbols, provider])

  function dispatch(action: Parameters<typeof reduceGrid>[1]) {
    setState((current) => reduceGrid(current, action))
  }

  async function submitKey(event: FormEvent) {
    event.preventDefault()
    const token = keyDraft.trim()
    if (!token) {
      setApiKey(null)
      setKeyError(null)
      setKeyOpen(false)
      return
    }
    const result = await probeFinnhubKey(token)
    if (result === "ok") {
      setApiKey(token)
      setKeyError(null)
      setKeyOpen(false)
      return
    }
    if (result === "invalid") {
      setKeyError("Finnhub rejected that key. The table is still on simulated prices.")
      return
    }
    if (result === "rate-limited") {
      setKeyError("Finnhub is rate limited. Wait a minute and try the key again.")
      return
    }
    setKeyError("Could not reach Finnhub. The table is still on simulated prices.")
  }

  const listed = symbols.length
  const statusText = statusTextFor(status, listed, capped.size, provider.limits.maxSymbols)

  return (
    <div className="monitor">
      <header className="monitor-head">
        <div>
          <h1>Real-Time Stock Monitor</h1>
          <p className="status" data-testid="status-bar" data-kind={status.kind}>
            {statusText}
          </p>
        </div>
        <button type="button" onClick={() => dispatch({ type: "add-row" })}>
          Add ticker
        </button>
      </header>
      {status.kind === "simulated" ? (
        <div className="banner" role="status">
          <span>Simulated data. These prices are not from an exchange.</span>
          <button type="button" className="quiet" onClick={() => setKeyOpen(true)}>
            Add a Finnhub key
          </button>
        </div>
      ) : null}
      {keyOpen ? (
        <form className="key-panel" onSubmit={submitKey}>
          <label htmlFor="finnhub-key">Finnhub API key</label>
          <input
            id="finnhub-key"
            type="password"
            autoComplete="off"
            value={keyDraft}
            onChange={(event) => setKeyDraft(event.target.value)}
          />
          <a href="https://finnhub.io/register" target="_blank" rel="noreferrer">
            Get a free key
          </a>
          <button type="submit">Use key</button>
          <button type="button" className="quiet" onClick={() => setKeyOpen(false)}>
            Close
          </button>
          {apiKey ? (
            <button
              type="button"
              className="quiet"
              onClick={() => {
                setApiKey(null)
                setKeyError(null)
                setKeyOpen(false)
              }}
            >
              Remove key
            </button>
          ) : null}
          {keyError ? (
            <p className="key-error" role="alert">
              {keyError}
            </p>
          ) : null}
        </form>
      ) : null}
      <Grid
        state={state}
        columns={COLUMNS}
        dispatch={dispatch}
        cell={(addr) => cellFor(state, addr, capped, status)}
      />
    </div>
  )
}

function cellFor(
  state: GridState,
  addr: Addr,
  capped: Set<Symbol>,
  status: ProviderStatus,
): CellModel {
  const symbol = symbolForRow(state, addr.r)
  if (addr.c === COL.ticker) {
    if (!symbol) return { text: "", node: <span className="placeholder">Add a ticker</span> }
    return { text: symbol }
  }
  if (!symbol) return { text: "" }
  const parsed = parseSymbol(symbol)
  if (!parsed) return { text: addr.c === COL.company ? "Unknown symbol" : "", className: "dimmed" }
  if (capped.has(parsed)) {
    if (addr.c === COL.company) return { text: symbol }
    if (addr.c === COL.price) return { text: "Symbol cap", className: "dimmed" }
    return { text: "" }
  }
  if (addr.c === COL.company) return { text: "", node: <CompanyCell symbol={parsed} /> }
  if (addr.c === COL.price) {
    return {
      text: "",
      className: status.kind === "reconnecting" ? "dimmed" : undefined,
      node: <PriceCell symbol={parsed} marketClosed={status.kind === "market-closed"} />,
    }
  }
  if (addr.c === COL.change) {
    return {
      text: "",
      node: <ChangeCell symbol={parsed} marketClosed={status.kind === "market-closed"} />,
    }
  }
  return { text: "" }
}

function usePrice(symbol: string): PriceSlice {
  return useSyncExternalStore(
    (listener) => book.subscribePrice(symbol, listener),
    () => book.getPrice(symbol),
    () => book.getPrice(symbol),
  )
}

function useName(symbol: string): NameSlice {
  return useSyncExternalStore(
    (listener) => book.subscribeName(symbol, listener),
    () => book.getName(symbol),
    () => book.getName(symbol),
  )
}

function CompanyCell({ symbol }: { symbol: string }) {
  const slice = useName(symbol)
  if (slice.unknown) {
    return (
      <span data-testid={`company-${symbol}`} className="missing">
        Unknown symbol
      </span>
    )
  }
  return <span data-testid={`company-${symbol}`}>{slice.name ?? ""}</span>
}

function PriceCell({ symbol, marketClosed }: { symbol: string; marketClosed: boolean }) {
  const slice = usePrice(symbol)
  if (slice.unknown) {
    return (
      <span data-testid={`price-${symbol}`} data-field="price" data-symbol={symbol} className="missing">
        No price
      </span>
    )
  }
  const price = marketClosed ? (slice.previousClose ?? slice.price) : slice.price
  return (
    <span
      data-testid={`price-${symbol}`}
      data-field="price"
      data-symbol={symbol}
      data-price={price ?? ""}
      className={slice.flash ? "amount flash" : "amount"}
    >
      {price == null ? "" : formatPrice(price)}
    </span>
  )
}

function ChangeCell({ symbol, marketClosed }: { symbol: string; marketClosed: boolean }) {
  const slice = usePrice(symbol)
  if (slice.unknown) return null
  const price = marketClosed ? (slice.previousClose ?? slice.price) : slice.price
  if (price == null || slice.previousClose == null) return null
  const percent = changePercent(price, slice.previousClose)
  if (percent == null) return null
  return (
    <span
      data-testid={`change-${symbol}`}
      className={slice.flash ? "chip flash" : "chip"}
      data-direction={percent > 0 ? "up" : percent < 0 ? "down" : "flat"}
      style={heatStyle(percent)}
    >
      {percent > 0 ? `+${formatPercent(percent)}` : formatPercent(percent)}
    </span>
  )
}

// A bigger move gets a deeper tint, and a 2% move is as deep as it goes.
function heatStyle(percent: number): { backgroundColor: string } | undefined {
  if (percent === 0) return undefined
  const strength = Math.min(Math.abs(percent) / 2, 1)
  const alpha = 0.1 + strength * 0.16
  const color = percent > 0 ? `rgba(14, 138, 95, ${alpha})` : `rgba(200, 55, 45, ${alpha})`
  return { backgroundColor: color }
}

function statusTextFor(status: ProviderStatus, listed: number, capped: number, maxSymbols: number): string {
  const extra = capped > 0 ? ` ${capped} rows are past the ${maxSymbols} symbol limit.` : ""
  switch (status.kind) {
    case "simulated":
      return `${listed} symbols on simulated prices.${extra}`
    case "live":
      return `${listed} symbols on live prices.${extra}`
    case "reconnecting":
      return `Reconnecting...${extra}`
    case "market-closed":
      return `Market closed.${extra}`
    case "rate-limited":
      return `Rate limited. Requests are waiting.${extra}`
    case "invalid-key":
      return status.message
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}
