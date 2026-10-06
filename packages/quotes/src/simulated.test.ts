import { describe, expect, it } from "vitest"
import type { Clock } from "./clock"
import { parseSymbol } from "./symbols"
import { createSimulatedProvider } from "./simulated"

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

describe("simulated provider", () => {
  it("returns the seed snapshot and then a different trade price", async () => {
    const clock = manualClock()
    const provider = createSimulatedProvider({ intervalMs: 1000, random: () => 0.99, clock })
    const symbol = parseSymbol("AAPL")
    if (!symbol) throw new Error("AAPL")
    const snapshot = await provider.getSnapshot(symbol)
    expect(snapshot).toEqual({
      symbol,
      name: "APPLE INC.",
      previousClose: 180.22,
      price: 180.22,
    })
    const prices: number[] = []
    provider.subscribe([symbol], (quote) => prices.push(quote.price))
    clock.advance(1000)
    expect(prices).toEqual([180.32])
  })

  it("reports an unknown ticker as an empty snapshot", async () => {
    const provider = createSimulatedProvider({ clock: manualClock() })
    const symbol = parseSymbol("ZZZZ")
    if (!symbol) throw new Error("ZZZZ")
    expect(await provider.getSnapshot(symbol)).toEqual({
      symbol,
      name: null,
      previousClose: null,
      price: null,
    })
  })
})
