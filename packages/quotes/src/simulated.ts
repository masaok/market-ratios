import { realClock, type Clock } from "./clock"
import { SIMULATED_SEEDS } from "./seeds"
import { parseSymbol } from "./symbols"
import type { Quote, QuoteProvider, Snapshot, Symbol } from "./types"

const seedBySymbol = new Map(SIMULATED_SEEDS.map((seed) => [seed.symbol, seed]))

type Registration = {
  symbols: readonly Symbol[]
  listener: (quote: Quote) => void
}

export function createSimulatedProvider(options?: {
  intervalMs?: number
  random?: () => number
  clock?: Clock
}): QuoteProvider {
  const intervalMs = options?.intervalMs ?? 600
  const random = options?.random ?? Math.random
  const clock = options?.clock ?? realClock
  const prices = new Map<string, number>()
  for (const seed of SIMULATED_SEEDS) prices.set(seed.symbol, seed.price)

  const registrations: Registration[] = []
  let timer: number | null = null

  function tick() {
    const active = new Set<string>()
    for (const registration of registrations) {
      for (const symbol of registration.symbols) active.add(symbol)
    }
    const updates = new Map<string, Quote>()
    for (const symbol of active) {
      const seed = seedBySymbol.get(symbol)
      if (!seed) continue
      const previous = prices.get(symbol) ?? seed.price
      const price = Math.round((previous + (random() - 0.5) * 0.2) * 100) / 100
      prices.set(symbol, price)
      const parsed = parseSymbol(symbol)
      if (!parsed) continue
      updates.set(symbol, { symbol: parsed, price, timeMs: clock.now() })
    }
    for (const registration of registrations) {
      for (const symbol of registration.symbols) {
        const quote = updates.get(symbol)
        if (quote) registration.listener(quote)
      }
    }
    timer = clock.setTimeout(tick, intervalMs)
  }

  function ensureTicking() {
    if (timer != null) return
    if (registrations.length === 0) return
    timer = clock.setTimeout(tick, intervalMs)
  }

  return {
    limits: { maxSymbols: 500 },
    subscribe(symbols, onQuote) {
      const registration = { symbols, listener: onQuote }
      registrations.push(registration)
      ensureTicking()
      return () => {
        const index = registrations.indexOf(registration)
        if (index >= 0) registrations.splice(index, 1)
        if (registrations.length === 0 && timer != null) {
          clock.clearTimeout(timer)
          timer = null
        }
      }
    },
    async getSnapshot(symbol: Symbol): Promise<Snapshot> {
      const seed = seedBySymbol.get(symbol)
      if (!seed) return { symbol, name: null, previousClose: null, price: null }
      return {
        symbol,
        name: seed.name,
        previousClose: seed.price,
        price: prices.get(symbol) ?? seed.price,
      }
    },
    onStatus(listener) {
      listener({ kind: "simulated" })
      return () => {}
    },
  }
}
