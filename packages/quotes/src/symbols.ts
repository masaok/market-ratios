import type { Symbol } from "./types"

export function parseSymbol(raw: string): Symbol | null {
  const symbol = raw.trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(symbol)) return null
  return symbol as Symbol
}
