import { realClock, type Clock } from "./clock"
import { isUsEquitySessionOpen } from "./market-hours"
import { parseSymbol } from "./symbols"
import { ProviderRequestError, type ProviderStatus, type Quote, type QuoteProvider, type Snapshot, type Symbol } from "./types"

type Answer = { body: unknown; at: number }

type Registration = {
  symbols: readonly Symbol[]
  listener: (quote: Quote) => void
}

const WINDOW_MS = 60_000
export const FINNHUB_MIN_INTERVAL_MS = 1000
export const FINNHUB_POLL_MS = 2 * 60 * 1000
export const FINNHUB_CACHE_MS = 2 * 60 * 1000

// Answers a host keeps between visits. A request is the path and symbol, never the key.
export type FinnhubCache = {
  get(request: string): { body: unknown; at: number } | null
  set(request: string, body: unknown): void
}

function quoteRequest(symbol: Symbol): string {
  return `quote?symbol=${encodeURIComponent(symbol)}`
}

function profileRequest(symbol: Symbol): string {
  return `stock/profile2?symbol=${encodeURIComponent(symbol)}`
}

export function createFinnhubProvider(options: {
  token: string
  fetch?: typeof fetch
  clock?: Clock
  marketOpen?: (nowMs: number) => boolean
  maxSymbols?: number
  restPerMinute?: number
  minIntervalMs?: number
  pollMs?: number
  cache?: FinnhubCache
  cacheMs?: number
}): QuoteProvider {
  const fetchImpl = options.fetch ?? fetch
  const clock = options.clock ?? realClock
  const marketOpen = options.marketOpen ?? ((nowMs: number) => isUsEquitySessionOpen(new Date(nowMs)))
  const maxSymbols = options.maxSymbols ?? 50
  const restPerMinute = options.restPerMinute ?? 60
  const minIntervalMs = options.minIntervalMs ?? FINNHUB_MIN_INTERVAL_MS
  const pollMs = options.pollMs ?? FINNHUB_POLL_MS
  const cache = options.cache
  const cacheMs = options.cacheMs ?? FINNHUB_CACHE_MS
  const token = options.token

  const registrations: Registration[] = []
  const statusListeners = new Set<(status: ProviderStatus) => void>()
  let timer: number | null = null
  let inFlight = false
  let generation = 0
  let invalid = false
  let failed = false
  let rateWaiters = 0
  const stamps: number[] = []
  let nextStart = 0
  const snapshots = new Map<Symbol, { at: number; result: Promise<Snapshot> }>()
  const loading = new Map<string, Promise<Answer>>()

  function currentStatus(): ProviderStatus {
    if (invalid) return { kind: "invalid-key", message: "Finnhub rejected the API key." }
    if (rateWaiters > 0) return { kind: "rate-limited" }
    if (failed) return { kind: "reconnecting" }
    if (!marketOpen(clock.now())) return { kind: "market-closed" }
    return { kind: "live" }
  }

  function emitStatus() {
    const status = currentStatus()
    for (const listener of statusListeners) listener(status)
  }

  function desiredSymbols(): string[] {
    const chosen: string[] = []
    const seen = new Set<string>()
    for (const registration of registrations) {
      for (const symbol of registration.symbols) {
        if (seen.has(symbol)) continue
        seen.add(symbol)
        chosen.push(symbol)
        if (chosen.length >= maxSymbols) return chosen
      }
    }
    return chosen
  }

  function stop() {
    generation += 1
    inFlight = false
    if (timer != null) {
      clock.clearTimeout(timer)
      timer = null
    }
  }

  function schedule(delay: number) {
    if (timer != null) clock.clearTimeout(timer)
    const gen = generation
    timer = clock.setTimeout(() => {
      timer = null
      if (gen !== generation) return
      void poll()
    }, delay)
  }

  function deliver(symbol: Symbol, answer: Answer) {
    const { c, pc } = answer.body as { c?: unknown; pc?: unknown }
    if (typeof c !== "number" || c <= 0) return
    const quote: Quote = { symbol, price: c, timeMs: answer.at }
    if (typeof pc === "number" && pc > 0) quote.previousClose = pc
    for (const registration of registrations) {
      if (registration.symbols.includes(symbol)) registration.listener(quote)
    }
  }

  // One call per request at a time, so a poll and a snapshot asking together share it.
  function load(request: string): Promise<Answer> {
    const pending = loading.get(request)
    if (pending) return pending
    const url = `https://finnhub.io/api/v1/${request}&token=${encodeURIComponent(token)}`
    const result = runLimited(() => fetchImpl(url))
      .then(readJson)
      .then((body) => {
        cache?.set(request, body)
        return { body, at: clock.now() }
      })
    loading.set(request, result)
    const done = () => {
      if (loading.get(request) === result) loading.delete(request)
    }
    result.then(done, done)
    return result
  }

  // A cached answer inside cacheMs costs no call. With onRefresh, an older one is returned
  // at once and replaced behind it. Without, the caller waits for the new answer.
  function ask(request: string, onRefresh?: (answer: Answer) => void): Promise<Answer> {
    const entry = cache?.get(request)
    if (entry && clock.now() - entry.at < cacheMs) return Promise.resolve(entry)
    if (entry && onRefresh) {
      load(request).then(onRefresh, () => {
        // The old answer stays on screen. The next poll tries again.
      })
      return Promise.resolve(entry)
    }
    return load(request)
  }

  async function poll() {
    if (invalid) return
    const symbols = desiredSymbols()
    if (symbols.length === 0) return
    inFlight = true
    const gen = generation
    let anyFailed = false
    for (const raw of symbols) {
      if (gen !== generation || invalid) return
      const symbol = parseSymbol(raw)
      if (!symbol) continue
      try {
        const answer = await ask(quoteRequest(symbol))
        if (gen !== generation || invalid) return
        deliver(symbol, answer)
      } catch {
        if (gen !== generation || invalid) return
        anyFailed = true
      }
    }
    if (gen !== generation || invalid) return
    inFlight = false
    failed = anyFailed
    emitStatus()
    if (desiredSymbols().length > 0) schedule(pollMs)
  }

  function ensurePolling() {
    if (invalid || desiredSymbols().length === 0) return
    if (timer != null || inFlight) return
    void poll()
  }

  function runLimited<T>(run: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const attempt = () => {
        const now = clock.now()
        while (stamps.length > 0 && stamps[0]! <= now - WINDOW_MS) stamps.shift()
        if (stamps.length >= restPerMinute) {
          rateWaiters += 1
          emitStatus()
          const wait = Math.max(stamps[0]! + WINDOW_MS - now + 1, 1)
          clock.setTimeout(() => {
            rateWaiters = Math.max(0, rateWaiters - 1)
            emitStatus()
            attempt()
          }, wait)
          return
        }
        stamps.push(now)
        run().then(resolve, reject)
      }
      // Calls start at least minIntervalMs apart. A poll and a snapshot share the one line.
      const now = clock.now()
      const startAt = Math.max(now, nextStart)
      nextStart = startAt + minIntervalMs
      if (startAt <= now) attempt()
      else clock.setTimeout(attempt, startAt - now)
    })
  }

  async function readJson(response: Response): Promise<unknown> {
    if (response.status === 401 || response.status === 403) {
      invalid = true
      stop()
      emitStatus()
      throw new ProviderRequestError("invalid-key", "Finnhub rejected the API key.")
    }
    if (response.status === 429) throw new ProviderRequestError("rate-limited", "Finnhub rate limit.")
    if (!response.ok) throw new ProviderRequestError("network", `Finnhub HTTP ${response.status}`)
    return response.json() as Promise<unknown>
  }

  async function fetchSnapshot(symbol: Symbol): Promise<Snapshot> {
    const [quoteAnswer, profileAnswer] = await Promise.all([
      ask(quoteRequest(symbol), (answer) => deliver(symbol, answer)),
      ask(profileRequest(symbol), () => {}),
    ])
    const quote = quoteAnswer.body as { c?: unknown; pc?: unknown }
    const profile = profileAnswer.body as { name?: unknown }
    const price = typeof quote.c === "number" && quote.c > 0 ? quote.c : null
    const previousClose = typeof quote.pc === "number" && quote.pc > 0 ? quote.pc : null
    const name = typeof profile.name === "string" && profile.name.length > 0 ? profile.name : null
    if (price == null && name == null) return { symbol, name: null, previousClose: null, price: null }
    return { symbol, name: name ?? symbol, previousClose, price, timeMs: quoteAnswer.at }
  }

  return {
    limits: { maxSymbols },
    subscribe(symbols, onQuote) {
      const registration = { symbols, listener: onQuote }
      registrations.push(registration)
      ensurePolling()
      emitStatus()
      return () => {
        const index = registrations.indexOf(registration)
        if (index >= 0) registrations.splice(index, 1)
        if (desiredSymbols().length === 0) stop()
        emitStatus()
      }
    },
    getSnapshot(symbol: Symbol): Promise<Snapshot> {
      // A ticker edit asks for every row again. Rows already loaded this poll period are reused.
      const cached = snapshots.get(symbol)
      if (cached && clock.now() - cached.at < pollMs) return cached.result
      const result = fetchSnapshot(symbol)
      snapshots.set(symbol, { at: clock.now(), result })
      result.catch(() => {
        if (snapshots.get(symbol)?.result === result) snapshots.delete(symbol)
      })
      return result
    },
    onStatus(listener) {
      statusListeners.add(listener)
      listener(currentStatus())
      return () => {
        statusListeners.delete(listener)
      }
    },
  }
}

export async function probeFinnhubKey(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<"ok" | "invalid" | "rate-limited" | "network"> {
  try {
    const response = await fetchImpl(
      `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(token)}`,
    )
    if (response.status === 401 || response.status === 403) return "invalid"
    if (response.status === 429) return "rate-limited"
    if (!response.ok) return "network"
    const body = (await response.json()) as { c?: unknown }
    if (typeof body.c !== "number") return "invalid"
    return "ok"
  } catch {
    return "network"
  }
}
