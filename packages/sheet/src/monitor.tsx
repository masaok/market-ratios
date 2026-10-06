"use client"

import {
  DEFAULT_TICKERS,
  createFinnhubProvider,
  createSimulatedProvider,
  parseSymbol,
  probeFinnhubKey,
  type FinnhubCache,
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
import { loadApiKey, loadSheet, saveApiKey, saveSheet } from "./storage"

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
  return loadApiKey()
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
  apiKey: hostApiKey,
  onApiKeyChange,
  finnhubCache,
  finnhubFetch,
  manageRows = false,
  workspace = false,
}: {
  provider?: QuoteProvider
  tickers?: readonly string[]
  onTickersChange?: (tickers: string[]) => void
  // A host that passes apiKey owns the key. The sheet then leaves browser storage alone.
  apiKey?: string | null
  onApiKeyChange?: (apiKey: string | null) => void
  // Keep this object the same between renders. A new one starts a new provider.
  finnhubCache?: FinnhubCache
  // Sends the Finnhub calls somewhere else, such as a host's own server. Keep it the same too.
  finnhubFetch?: typeof fetch
  manageRows?: boolean
  workspace?: boolean
}) {
  const [state, setState] = useState<GridState>(() => initialMonitorState(tickers))
  const [apiKey, setApiKey] = useState<string | null>(() =>
    hostApiKey === undefined ? initialApiKey() : hostApiKey,
  )
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
    if (apiKey) return createFinnhubProvider({ token: apiKey, cache: finnhubCache, fetch: finnhubFetch })
    return createSimulatedProvider()
  }, [providerOverride, apiKey, finnhubCache, finnhubFetch])

  useEffect(() => {
    const timer = setInterval(() => book.expire(), 60_000)
    return () => clearInterval(timer)
  }, [])

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
      book.beginLoad(symbol)
      provider.getSnapshot(symbol).then(
        (snapshot) => {
          if (!cancelled) book.applySnapshot(snapshot)
        },
        () => {
          // The status listener reports an invalid key. This row stays blank.
          if (!cancelled) book.failLoad(symbol)
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

  function changeApiKey(next: string | null) {
    setApiKey(next)
    onApiKeyChange?.(next)
    // A host that keeps the tickers skips the save above, so the key is saved here.
    if (hostApiKey === undefined && onTickersChange) saveApiKey(next)
  }

  async function submitKey(event: FormEvent) {
    event.preventDefault()
    const token = keyDraft.trim()
    if (!token) {
      changeApiKey(null)
      setKeyError(null)
      setKeyOpen(false)
      return
    }
    const result = await probeFinnhubKey(token)
    if (result === "ok") {
      changeApiKey(token)
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
    <div className={workspace ? "monitor workspace" : "monitor"}>
      <header className="monitor-head">
        <div>
          <h1>Real-Time Stock Monitor</h1>
          <p className="status" data-testid="status-bar" data-kind={status.kind}>
            {statusText}
          </p>
        </div>
        <div className="monitor-actions">
          {manageRows ? (
            <button
              type="button"
              className="danger"
              disabled={state.selected.length === 0}
              onClick={() => dispatch({ type: "delete-selected" })}
            >
              Delete
            </button>
          ) : null}
          <button type="button" onClick={() => dispatch({ type: "add-row" })}>
            Add ticker
          </button>
        </div>
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
                changeApiKey(null)
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
        selectable={manageRows}
        dispatch={dispatch}
        cell={(addr) => cellFor(state, addr, capped, status, manageRows, dispatch)}
      />
    </div>
  )
}

function cellFor(
  state: GridState,
  addr: Addr,
  capped: Set<Symbol>,
  status: ProviderStatus,
  manageRows: boolean,
  dispatch: (action: Parameters<typeof reduceGrid>[1]) => void,
): CellModel {
  const symbol = symbolForRow(state, addr.r)
  if (addr.c === COL.ticker) return tickerCell(state, addr, symbol, manageRows, dispatch)
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

function tickerCell(
  state: GridState,
  addr: Addr,
  symbol: string,
  manageRows: boolean,
  dispatch: (action: Parameters<typeof reduceGrid>[1]) => void,
): CellModel {
  const editing = state.editing?.addr.c === COL.ticker && state.editing.addr.r === addr.r
  if (manageRows && editing && state.editing) {
    return {
      text: state.editing.draft,
      node: (
        <TickerEditor
          draft={state.editing.draft}
          onDraft={(text) => dispatch({ type: "draft", text })}
          onSave={() => dispatch({ type: "commit" })}
          onCancel={() => dispatch({ type: "cancel" })}
        />
      ),
    }
  }
  if (!symbol) {
    if (!manageRows) return { text: "", node: <span className="placeholder">Add a ticker</span> }
    return {
      text: "",
      node: (
        <button
          type="button"
          className="placeholder-btn"
          onClick={(event) => {
            event.stopPropagation()
            dispatch({ type: "edit-ticker", row: addr.r })
          }}
        >
          Add a ticker
        </button>
      ),
    }
  }
  if (!manageRows) return { text: symbol }
  return {
    text: symbol,
    node: (
      <button
        type="button"
        className="ticker-button"
        onClick={(event) => {
          event.stopPropagation()
          dispatch({ type: "edit-ticker", row: addr.r })
        }}
      >
        {symbol}
      </button>
    ),
  }
}

function TickerEditor({
  draft,
  onDraft,
  onSave,
  onCancel,
}: {
  draft: string
  onDraft: (text: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <form
      className="ticker-edit"
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
    >
      <input
        aria-label="Ticker symbol"
        autoFocus
        value={draft}
        onChange={(event) => onDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            onCancel()
          }
        }}
      />
      <button type="submit" onMouseDown={(event) => event.preventDefault()}>
        Save
      </button>
    </form>
  )
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
  if (slice.loading && slice.name == null) {
    return (
      <span data-testid={`company-${symbol}`}>
        <Loading wide />
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
      {price == null ? slice.loading ? <Loading /> : "" : formatPrice(price)}
    </span>
  )
}

function ChangeCell({ symbol, marketClosed }: { symbol: string; marketClosed: boolean }) {
  const slice = usePrice(symbol)
  if (slice.unknown) return null
  const price = marketClosed ? (slice.previousClose ?? slice.price) : slice.price
  if (price == null && slice.loading) return <Loading />
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

function Loading({ wide = false }: { wide?: boolean }) {
  return <span className={wide ? "loading wide" : "loading"} role="img" aria-label="Loading" />
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
