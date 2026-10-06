declare const symbolBrand: unique symbol

export type Symbol = string & { readonly [symbolBrand]: true }

export type Quote = {
  symbol: Symbol
  price: number
  timeMs: number
  // Sent when the provider learned it with the price, so a sheet open past a close stays right.
  previousClose?: number
}

export type Snapshot = {
  symbol: Symbol
  name: string | null
  previousClose: number | null
  price: number | null
}

export type ProviderStatus =
  | { kind: "simulated" }
  | { kind: "live" }
  | { kind: "reconnecting" }
  | { kind: "market-closed" }
  | { kind: "rate-limited" }
  | { kind: "invalid-key"; message: string }

export type QuoteProvider = {
  readonly limits: { maxSymbols: number }
  subscribe(symbols: readonly Symbol[], onQuote: (quote: Quote) => void): () => void
  getSnapshot(symbol: Symbol): Promise<Snapshot>
  onStatus(listener: (status: ProviderStatus) => void): () => void
}

export class ProviderRequestError extends Error {
  readonly reason: "invalid-key" | "rate-limited" | "network"

  constructor(reason: ProviderRequestError["reason"], message: string) {
    super(message)
    this.name = "ProviderRequestError"
    this.reason = reason
  }
}
