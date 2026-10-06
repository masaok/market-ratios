import type { Quote, Snapshot } from "@market-ratios/quotes"

export type PriceSlice = {
  price: number | null
  previousClose: number | null
  flash: boolean
  unknown: boolean
  // A price is on its way. The sheet shows a placeholder until it lands.
  loading: boolean
}

export type NameSlice = {
  name: string | null
  unknown: boolean
  loading: boolean
}

// A price older than this is hidden with its change, so an old number is never read as current.
export const PRICE_MAX_AGE_MS = 60 * 60 * 1000

const EMPTY_PRICE: PriceSlice = { price: null, previousClose: null, flash: false, unknown: false, loading: false }
const EMPTY_NAME: NameSlice = { name: null, unknown: false, loading: false }

export class QuoteBook {
  private prices = new Map<string, PriceSlice>()
  private names = new Map<string, NameSlice>()
  private priceListeners = new Map<string, Set<() => void>>()
  private nameListeners = new Map<string, Set<() => void>>()
  private flashTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private priceTimes = new Map<string, number>()

  getPrice(symbol: string): PriceSlice {
    return this.prices.get(symbol) ?? EMPTY_PRICE
  }

  getName(symbol: string): NameSlice {
    return this.names.get(symbol) ?? EMPTY_NAME
  }

  subscribePrice(symbol: string, listener: () => void): () => void {
    return subscribe(this.priceListeners, symbol, listener)
  }

  subscribeName(symbol: string, listener: () => void): () => void {
    return subscribe(this.nameListeners, symbol, listener)
  }

  // Marks what a row is still missing as loading. A row that already shows data is left alone.
  beginLoad(symbol: string) {
    const name = this.names.get(symbol) ?? EMPTY_NAME
    if (name.name == null && !name.loading) {
      this.names.set(symbol, { ...name, unknown: false, loading: true })
      emit(this.nameListeners, symbol)
    }
    const price = this.prices.get(symbol) ?? EMPTY_PRICE
    if (price.price == null && !price.loading) {
      this.prices.set(symbol, { ...price, unknown: false, loading: true })
      emit(this.priceListeners, symbol)
    }
  }

  failLoad(symbol: string) {
    const name = this.names.get(symbol)
    if (name?.loading) {
      this.names.set(symbol, { ...name, loading: false })
      emit(this.nameListeners, symbol)
    }
    const price = this.prices.get(symbol)
    if (price?.loading) {
      this.prices.set(symbol, { ...price, loading: false })
      emit(this.priceListeners, symbol)
    }
  }

  applySnapshot(snapshot: Snapshot, nowMs: number = Date.now()) {
    const unknown = snapshot.name == null && snapshot.price == null
    this.names.set(snapshot.symbol, { name: snapshot.name, unknown, loading: false })
    const previous = this.prices.get(snapshot.symbol) ?? EMPTY_PRICE
    const timeMs = snapshot.timeMs ?? nowMs
    if (nowMs - timeMs > PRICE_MAX_AGE_MS) {
      // The provider is already fetching a newer price behind this one.
      this.prices.set(snapshot.symbol, { price: null, previousClose: null, flash: false, unknown, loading: !unknown })
      this.priceTimes.delete(snapshot.symbol)
    } else {
      this.prices.set(snapshot.symbol, {
        price: snapshot.price ?? previous.price,
        previousClose: snapshot.previousClose,
        flash: false,
        unknown,
        loading: false,
      })
      this.priceTimes.set(snapshot.symbol, timeMs)
    }
    emit(this.nameListeners, snapshot.symbol)
    emit(this.priceListeners, snapshot.symbol)
  }

  // Hides each price that has aged out. The sheet calls this on a timer.
  expire(nowMs: number = Date.now()) {
    for (const [symbol, timeMs] of this.priceTimes) {
      if (nowMs - timeMs <= PRICE_MAX_AGE_MS) continue
      this.priceTimes.delete(symbol)
      const current = this.prices.get(symbol)
      if (!current) continue
      this.prices.set(symbol, { ...current, price: null, previousClose: null, flash: false, loading: false })
      emit(this.priceListeners, symbol)
    }
  }

  applyQuote(quote: Quote, nowMs: number = Date.now()) {
    const previous = this.prices.get(quote.symbol) ?? EMPTY_PRICE
    if (previous.unknown) return
    if (nowMs - quote.timeMs > PRICE_MAX_AGE_MS) return
    this.priceTimes.set(quote.symbol, quote.timeMs)
    this.prices.set(quote.symbol, {
      price: quote.price,
      previousClose: quote.previousClose ?? previous.previousClose,
      flash: true,
      unknown: false,
      loading: false,
    })
    emit(this.priceListeners, quote.symbol)
    const pending = this.flashTimers.get(quote.symbol)
    if (pending) clearTimeout(pending)
    const timer = setTimeout(() => {
      const current = this.prices.get(quote.symbol)
      if (!current) return
      this.prices.set(quote.symbol, { ...current, flash: false })
      emit(this.priceListeners, quote.symbol)
    }, 180)
    this.flashTimers.set(quote.symbol, timer)
  }
}

function subscribe(map: Map<string, Set<() => void>>, symbol: string, listener: () => void): () => void {
  const set = map.get(symbol) ?? new Set()
  set.add(listener)
  map.set(symbol, set)
  return () => {
    set.delete(listener)
  }
}

function emit(map: Map<string, Set<() => void>>, symbol: string) {
  const set = map.get(symbol)
  if (!set) return
  for (const listener of set) listener()
}
