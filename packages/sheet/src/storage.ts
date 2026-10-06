const KEY = "market-ratios.sheet.v1"

export type SavedSheet = {
  tickers: string[]
  apiKey: string | null
}

export function loadSheet(): SavedSheet | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedSheet>
    const tickers = Array.isArray(parsed.tickers)
      ? parsed.tickers.filter((ticker): ticker is string => typeof ticker === "string")
      : []
    const apiKey = typeof parsed.apiKey === "string" && parsed.apiKey.length > 0 ? parsed.apiKey : null
    return { tickers, apiKey }
  } catch {
    return null
  }
}

export function saveSheet(saved: SavedSheet) {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    // Private mode can reject storage. The sheet still runs for this visit.
  }
}

export function loadApiKey(): string | null {
  return loadSheet()?.apiKey ?? null
}

// Keeps the saved tickers, so a host that stores its own list can still keep the key here.
export function saveApiKey(apiKey: string | null) {
  saveSheet({ tickers: loadSheet()?.tickers ?? [], apiKey })
}
