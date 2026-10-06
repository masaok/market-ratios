import type { Quote, Snapshot } from "@market-ratios/quotes"

export type PriceSlice = {
  price: number | null
  previousClose: number | null
  flash: boolean
  unknown: boolean
}

export type NameSlice = {
  name: string | null
  unknown: boolean
}

const EMPTY_PRICE: PriceSlice = { price: null, previousClose: null, flash: false, unknown: false }
const EMPTY_NAME: NameSlice = { name: null, unknown: false }

export class QuoteBook {
  private prices = new Map<string, PriceSlice>()
  private names = new Map<string, NameSlice>()
  private priceListeners = new Map<string, Set<() => void>>()
  private nameListeners = new Map<string, Set<() => void>>()
  private flashTimers = new Map<string, ReturnType<typeof setTimeout>>()

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

  applySnapshot(snapshot: Snapshot) {
    const unknown = snapshot.name == null && snapshot.price == null
    this.names.set(snapshot.symbol, { name: snapshot.name, unknown })
    const previous = this.prices.get(snapshot.symbol) ?? EMPTY_PRICE
    this.prices.set(snapshot.symbol, {
      price: snapshot.price ?? previous.price,
      previousClose: snapshot.previousClose,
      flash: false,
      unknown,
    })
    emit(this.nameListeners, snapshot.symbol)
    emit(this.priceListeners, snapshot.symbol)
  }

  applyQuote(quote: Quote) {
    const previous = this.prices.get(quote.symbol) ?? EMPTY_PRICE
    if (previous.unknown) return
    this.prices.set(quote.symbol, {
      price: quote.price,
      previousClose: quote.previousClose ?? previous.previousClose,
      flash: true,
      unknown: false,
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
