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
import { Grid, type CellModel } from "./grid"
import "./grid.css"
import {
  COL,
  FIRST_DATA_ROW,
  HEADER_ROW,
  TITLE_ROW,
  addrName,
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

const HEADERS: Record<number, string> = {
  [COL.company]: "Company Names",
  [COL.ticker]: "Ticker",
  [COL.price]: "Price",
  [COL.change]: "Change %",
}

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
      setKeyError("Finnhub rejected that key. The sheet is still on simulated prices.")
      return
    }
    if (result === "rate-limited") {
      setKeyError("Finnhub is rate limited. Wait a minute and try the key again.")
      return
    }
    setKeyError("Could not reach Finnhub. The sheet is still on simulated prices.")
  }

  const listed = symbols.length
  const statusText = statusTextFor(status, listed, capped.size, provider.limits.maxSymbols)

  return (
    <div className="workbook">
      {status.kind === "simulated" ? (
        <div className="banner" role="status">
          <span>Simulated data. These prices are not from an exchange.</span>
          <button type="button" onClick={() => setKeyOpen(true)}>
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
          <button type="button" onClick={() => setKeyOpen(false)}>
            Close
          </button>
          {apiKey ? (
            <button
              type="button"
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
      <div className="formula-row">
        <div className="name-box" data-testid="name-box">
          {addrName(state.focus)}
        </div>
        <FormulaBar state={state} dispatch={dispatch} marketClosed={status.kind === "market-closed"} />
      </div>
      <Grid state={state} dispatch={dispatch} cell={(addr) => cellFor(state, addr, capped, status)} />
      <div className="sheet-tabs">
        <div className="sheet-tab">Monitor</div>
      </div>
      <div className="status-bar" data-testid="status-bar">
        <span>{statusText}</span>
        <button type="button" className="quiet" onClick={() => dispatch({ type: "add-row" })}>
          Add ticker
        </button>
      </div>
    </div>
  )
}

function cellFor(
  state: GridState,
  addr: Addr,
  capped: Set<Symbol>,
  status: ProviderStatus,
): CellModel {
  if (addr.r === TITLE_ROW && addr.c === COL.company) {
    return { text: "Real-Time Stock Monitor", colSpan: 4, className: "title" }
  }
  if (addr.r === TITLE_ROW && addr.c > COL.company && addr.c <= COL.change) return { text: "", skip: true }
  if (addr.r === HEADER_ROW && HEADERS[addr.c]) return { text: HEADERS[addr.c] ?? "", className: "header" }
  if (addr.r < FIRST_DATA_ROW) return { text: "" }

  const symbol = symbolForRow(state, addr.r)
  if (addr.c === COL.ticker) return { text: symbol, className: "ticker" }
  if (!symbol) return { text: "" }
  const parsed = parseSymbol(symbol)
  if (!parsed) return { text: "#N/A", className: "company" }
  if (capped.has(parsed)) {
    if (addr.c === COL.company) return { text: symbol, className: "company" }
    if (addr.c === COL.price) return { text: "Symbol cap", className: "price" }
    return { text: "" }
  }
  if (addr.c === COL.company) return { text: "", className: "company", node: <CompanyCell symbol={parsed} /> }
  if (addr.c === COL.price) {
    return {
      text: "",
      className: status.kind === "reconnecting" ? "price dimmed" : "price",
      node: <PriceCell symbol={parsed} marketClosed={status.kind === "market-closed"} />,
    }
  }
  if (addr.c === COL.change) {
    return {
      text: "",
      className: "change",
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
  const text = slice.unknown ? "#N/A" : (slice.name ?? "")
  return <span data-testid={`company-${symbol}`}>{text}</span>
}

function PriceCell({ symbol, marketClosed }: { symbol: string; marketClosed: boolean }) {
  const slice = usePrice(symbol)
  if (slice.unknown) {
    return (
      <span data-testid={`price-${symbol}`} data-field="price" data-symbol={symbol}>
        #N/A
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
      className={slice.flash ? "flash" : undefined}
    >
      {price == null ? "" : formatPrice(price)}
    </span>
  )
}

function ChangeCell({ symbol, marketClosed }: { symbol: string; marketClosed: boolean }) {
  const slice = usePrice(symbol)
  if (slice.unknown) return <span>#N/A</span>
  const price = marketClosed ? (slice.previousClose ?? slice.price) : slice.price
  if (price == null || slice.previousClose == null) return null
  const percent = changePercent(price, slice.previousClose)
  if (percent == null) return null
  return (
    <span data-testid={`change-${symbol}`} className={slice.flash ? "flash" : undefined} style={heatStyle(percent)}>
      {formatPercent(percent)}
    </span>
  )
}

function FormulaBar({
  state,
  dispatch,
  marketClosed,
}: {
  state: GridState
  dispatch: (action: Parameters<typeof reduceGrid>[1]) => void
  marketClosed: boolean
}) {
  const symbol = symbolForRow(state, state.focus.r)
  const price = usePrice(symbol)
  const name = useName(symbol)
  const shown = state.editing ? state.editing.draft : formulaText(state, symbol, price, name, marketClosed)
  const editable = state.focus.c === COL.ticker
  return (
    <input
      className="formula"
      aria-label="Formula bar"
      readOnly={!editable}
      value={shown}
      onChange={(event) => {
        if (!editable) return
        if (!state.editing) dispatch({ type: "begin-edit", seed: event.target.value })
        else dispatch({ type: "draft", text: event.target.value })
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          dispatch({ type: "move", dc: 0, dr: 1, shift: false })
        } else if (event.key === "Escape") {
          event.preventDefault()
          dispatch({ type: "cancel" })
        }
      }}
    />
  )
}

function formulaText(
  state: GridState,
  symbol: string,
  price: PriceSlice,
  name: NameSlice,
  marketClosed: boolean,
): string {
  if (state.focus.r === TITLE_ROW && state.focus.c === COL.company) return "Real-Time Stock Monitor"
  if (state.focus.r === HEADER_ROW) return HEADERS[state.focus.c] ?? ""
  if (state.focus.c === COL.ticker) return symbol
  if (state.focus.c === COL.company) return name.unknown ? "#N/A" : (name.name ?? "")
  const shown = marketClosed ? (price.previousClose ?? price.price) : price.price
  if (state.focus.c === COL.price) return shown == null ? "" : formatPrice(shown)
  if (state.focus.c === COL.change && shown != null && price.previousClose != null) {
    const percent = changePercent(shown, price.previousClose)
    return percent == null ? "" : formatPercent(percent)
  }
  return ""
}

function heatStyle(percent: number): { backgroundColor: string } | undefined {
  if (percent === 0) return undefined
  const strength = Math.min(Math.abs(percent) / 2, 1)
  const alpha = 0.18 + strength * 0.62
  const color = percent > 0 ? `rgba(84, 130, 53, ${alpha})` : `rgba(204, 65, 65, ${alpha})`
  return { backgroundColor: color }
}

function statusTextFor(status: ProviderStatus, listed: number, capped: number, maxSymbols: number): string {
  const extra = capped > 0 ? ` ${capped} rows are past the ${maxSymbols} symbol limit.` : ""
  switch (status.kind) {
    case "simulated":
      return `Simulated · ${listed} symbols.${extra}`
    case "live":
      return `Live · ${listed} symbols.${extra}`
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
