/** @vitest-environment jsdom */
import { createSimulatedProvider, type Clock } from "@market-ratios/quotes"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { StockMonitor } from "./monitor"

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

describe("stock monitor", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(cleanup)

  it("shows the sheet in demo mode and changes a price", async () => {
    const clock = manualClock()
    const provider = createSimulatedProvider({ intervalMs: 500, random: () => 0.99, clock })
    render(<StockMonitor provider={provider} />)
    expect(screen.getByText("Real-Time Stock Monitor")).toBeTruthy()
    expect(screen.getByText(/Simulated data/)).toBeTruthy()
    await act(async () => {
      await Promise.resolve()
    })
    const price = screen.getByTestId("price-AAPL")
    expect(price.getAttribute("data-price")).toBe("180.22")
    await act(async () => {
      clock.advance(500)
    })
    expect(screen.getByTestId("price-AAPL").getAttribute("data-price")).toBe("180.32")
  })

  it("uses the supplied tickers and leaves browser storage alone", async () => {
    const seen: string[][] = []
    const clock = manualClock()
    const provider = createSimulatedProvider({ intervalMs: 60_000, random: () => 0.5, clock })
    render(
      <StockMonitor
        provider={provider}
        tickers={["ZZZZ"]}
        onTickersChange={(next) => seen.push(next)}
      />,
    )
    expect(screen.getByText("ZZZZ")).toBeTruthy()
    expect(seen.at(-1)).toEqual(["ZZZZ"])
    expect(localStorage.getItem("market-ratios.sheet.v1")).toBeNull()
  })

  it("hands a key change to the host that owns the key and leaves browser storage alone", async () => {
    const seen: (string | null)[] = []
    const clock = manualClock()
    const provider = createSimulatedProvider({ intervalMs: 60_000, random: () => 0.5, clock })
    render(
      <StockMonitor
        provider={provider}
        tickers={["ZZZZ"]}
        onTickersChange={() => {}}
        apiKey="abc123"
        onApiKeyChange={(next) => seen.push(next)}
      />,
    )
    fireEvent.click(screen.getByText("Add a Finnhub key"))
    fireEvent.click(screen.getByText("Remove key"))
    expect(seen).toEqual([null])
    expect(localStorage.getItem("market-ratios.sheet.v1")).toBeNull()
  })
})
