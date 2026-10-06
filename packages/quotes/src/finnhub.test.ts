import { describe, expect, it } from "vitest"
import type { Clock } from "./clock"
import { FINNHUB_POLL_MS, createFinnhubProvider, probeFinnhubKey } from "./finnhub"
import { parseSymbol } from "./symbols"
import { ProviderRequestError, type ProviderStatus } from "./types"

function manualClock(): Clock & { advance: (ms: number) => void } {
  let now = 1_000_000
  const timers: { id: number; at: number; fn: () => void }[] = []
  let nextId = 1
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = nextId
      nextId += 1
      timers.push({ id, at: now + ms, fn })
      return id
    },
    clearTimeout(id) {
      const index = timers.findIndex((timer) => timer.id === id)
      if (index >= 0) timers.splice(index, 1)
    },
    advance(ms) {
      now += ms
      const due = timers.filter((timer) => timer.at <= now).sort((a, b) => a.at - b.at)
      for (const timer of due) {
        const index = timers.indexOf(timer)
        if (index < 0) continue
        timers.splice(index, 1)
        timer.fn()
      }
    },
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("Finnhub provider", () => {
  it("polls once on subscribe and again after five minutes", async () => {
    const clock = manualClock()
    const quotes: number[] = []
    let price = 181.5
    const provider = createFinnhubProvider({
      token: "test-key",
      clock,
      marketOpen: () => true,
      fetch: async () => json({ c: price, pc: 180 }),
    })
    const symbol = parseSymbol("AAPL")
    if (!symbol) throw new Error("AAPL")
    provider.subscribe([symbol], (quote) => quotes.push(quote.price))
    await flush()
    expect(quotes).toEqual([181.5])
    price = 182
    clock.advance(FINNHUB_POLL_MS)
    await flush()
    expect(quotes).toEqual([181.5, 182])
  })

  it("skips a zero price and a bad payload", async () => {
    const quotes: number[] = []
    const provider = createFinnhubProvider({
      token: "test-key",
      minIntervalMs: 0,
      marketOpen: () => true,
      fetch: async (url) => {
        if (String(url).includes("NOPE")) return json({ c: 0, pc: 0 })
        return json({ c: "nope" })
      },
    })
    const aapl = parseSymbol("AAPL")
    const nope = parseSymbol("NOPE")
    if (!aapl || !nope) throw new Error("symbols")
    provider.subscribe([aapl, nope], (quote) => quotes.push(quote.price))
    await flush()
    expect(quotes).toEqual([])
  })

  it("caps a poll at the symbol limit", async () => {
    const requested: string[] = []
    const provider = createFinnhubProvider({
      token: "test-key",
      marketOpen: () => true,
      minIntervalMs: 0,
      maxSymbols: 50,
      fetch: async (url) => {
        const symbol = new URL(String(url)).searchParams.get("symbol")
        if (symbol) requested.push(symbol)
        return json({ c: 1 })
      },
    })
    const symbols = Array.from({ length: 51 }, (_, index) => parseSymbol(`S${index}`)).filter(
      (symbol): symbol is NonNullable<typeof symbol> => symbol != null,
    )
    expect(symbols).toHaveLength(51)
    provider.subscribe(symbols, () => {})
    await flush()
    expect(requested).toHaveLength(50)
    expect(requested.includes("S50")).toBe(false)
  })

  it("waits out the REST window before the next snapshot", async () => {
    const clock = manualClock()
    let calls = 0
    const provider = createFinnhubProvider({
      token: "test-key",
      clock,
      minIntervalMs: 0,
      restPerMinute: 2,
      marketOpen: () => true,
      fetch: async (url) => {
        calls += 1
        if (String(url).includes("profile2")) return json({ name: "Apple Inc." })
        return json({ c: 10, pc: 8 })
      },
    })
    const aapl = parseSymbol("AAPL")
    const msft = parseSymbol("MSFT")
    if (!aapl || !msft) throw new Error("symbols")
    expect(await provider.getSnapshot(aapl)).toMatchObject({ name: "Apple Inc.", price: 10, previousClose: 8 })
    expect(calls).toBe(2)
    let finished = false
    const second = provider.getSnapshot(msft).then((snapshot) => {
      finished = true
      return snapshot
    })
    await Promise.resolve()
    expect(finished).toBe(false)
    expect(calls).toBe(2)
    clock.advance(60_001)
    expect(await second).toMatchObject({ name: "Apple Inc.", price: 10 })
    expect(calls).toBe(4)
  })

  it("starts calls a second apart and does not call that rate limited", async () => {
    const clock = manualClock()
    const statuses: ProviderStatus[] = []
    const requested: string[] = []
    const provider = createFinnhubProvider({
      token: "test-key",
      clock,
      marketOpen: () => true,
      fetch: async (url) => {
        requested.push(new URL(String(url)).searchParams.get("symbol") ?? "")
        return json({ c: 1 })
      },
    })
    const symbols = ["AAPL", "MSFT", "KO"].flatMap((raw) => parseSymbol(raw) ?? [])
    provider.onStatus((status) => statuses.push(status))
    provider.subscribe(symbols, () => {})
    await flush()
    expect(requested).toEqual(["AAPL"])
    clock.advance(999)
    await flush()
    expect(requested).toEqual(["AAPL"])
    clock.advance(1)
    await flush()
    expect(requested).toEqual(["AAPL", "MSFT"])
    clock.advance(1000)
    await flush()
    expect(requested).toEqual(["AAPL", "MSFT", "KO"])
    expect(statuses.some((status) => status.kind === "rate-limited")).toBe(false)
  })

  it("reuses a loaded snapshot until the next poll period, and retries a failed one", async () => {
    const clock = manualClock()
    let calls = 0
    let fail = true
    const provider = createFinnhubProvider({
      token: "test-key",
      clock,
      minIntervalMs: 0,
      marketOpen: () => true,
      fetch: async (url) => {
        calls += 1
        if (fail) return json({}, 500)
        if (String(url).includes("profile2")) return json({ name: "Apple Inc." })
        return json({ c: 10, pc: 8 })
      },
    })
    const aapl = parseSymbol("AAPL")
    if (!aapl) throw new Error("AAPL")
    await expect(provider.getSnapshot(aapl)).rejects.toBeInstanceOf(ProviderRequestError)
    expect(calls).toBe(2)
    fail = false
    expect(await provider.getSnapshot(aapl)).toMatchObject({ name: "Apple Inc.", price: 10 })
    expect(calls).toBe(4)
    await provider.getSnapshot(aapl)
    expect(calls).toBe(4)
    clock.advance(FINNHUB_POLL_MS)
    await provider.getSnapshot(aapl)
    expect(calls).toBe(6)
  })

  it("rejects an invalid key and keeps an unknown ticker empty", async () => {
    const statuses: ProviderStatus[] = []
    const provider = createFinnhubProvider({
      minIntervalMs: 0,
      token: "bad",
      marketOpen: () => true,
      fetch: async (url) => {
        if (String(url).includes("profile2")) return json({})
        if (String(url).includes("NOPE")) return json({ c: 0, pc: 0 })
        return json({ error: "no" }, 401)
      },
    })
    provider.onStatus((status) => statuses.push(status))
    const aapl = parseSymbol("AAPL")
    const nope = parseSymbol("NOPE")
    if (!aapl || !nope) throw new Error("symbols")
    await expect(provider.getSnapshot(aapl)).rejects.toBeInstanceOf(ProviderRequestError)
    expect(statuses.at(-1)).toEqual({ kind: "invalid-key", message: "Finnhub rejected the API key." })
    const unknown = createFinnhubProvider({
      minIntervalMs: 0,
      token: "ok",
      marketOpen: () => false,
      fetch: async (url) => json(String(url).includes("profile2") ? {} : { c: 0, pc: 0 }),
    })
    expect(await unknown.getSnapshot(nope)).toEqual({
      symbol: nope,
      name: null,
      previousClose: null,
      price: null,
    })
  })

  it("reports the market as closed while a poll succeeds", async () => {
    const statuses: ProviderStatus[] = []
    const provider = createFinnhubProvider({
      token: "test-key",
      marketOpen: () => false,
      fetch: async () => json({ c: 10, pc: 9 }),
    })
    const symbol = parseSymbol("AAPL")
    if (!symbol) throw new Error("AAPL")
    provider.onStatus((status) => statuses.push(status))
    provider.subscribe([symbol], () => {})
    await flush()
    expect(statuses.at(-1)).toEqual({ kind: "market-closed" })
  })
})

describe("probeFinnhubKey", () => {
  it("accepts a quote payload and rejects a 401", async () => {
    expect(await probeFinnhubKey("ok", async () => json({ c: 1 }))).toBe("ok")
    expect(await probeFinnhubKey("bad", async () => json({}, 401))).toBe("invalid")
  })
})
