import { parseSymbol } from "@market-ratios/quotes"
import { describe, expect, it } from "vitest"
import { PRICE_MAX_AGE_MS, QuoteBook } from "./quote-book"

const aapl = parseSymbol("AAPL")
if (!aapl) throw new Error("AAPL")
const now = 10_000_000_000

describe("quote book price age", () => {
  it("hides the price and previous close of a snapshot fetched over an hour ago, and keeps the name", () => {
    const book = new QuoteBook()
    book.applySnapshot(
      { symbol: aapl, name: "Apple Inc.", price: 10, previousClose: 8, timeMs: now - PRICE_MAX_AGE_MS - 1 },
      now,
    )
    expect(book.getPrice(aapl)).toMatchObject({ price: null, previousClose: null })
    expect(book.getName(aapl).name).toBe("Apple Inc.")
  })

  it("shows a price inside the hour, then hides it once it ages out", () => {
    const book = new QuoteBook()
    let notified = 0
    book.subscribePrice(aapl, () => {
      notified += 1
    })
    book.applySnapshot({ symbol: aapl, name: "Apple Inc.", price: 10, previousClose: 8, timeMs: now }, now)
    expect(book.getPrice(aapl)).toMatchObject({ price: 10, previousClose: 8 })
    book.expire(now + PRICE_MAX_AGE_MS)
    expect(book.getPrice(aapl).price).toBe(10)
    const before = notified
    book.expire(now + PRICE_MAX_AGE_MS + 1)
    expect(book.getPrice(aapl)).toMatchObject({ price: null, previousClose: null })
    expect(notified).toBe(before + 1)
  })

  it("brings a hidden price back with a new quote", () => {
    const book = new QuoteBook()
    book.applySnapshot({ symbol: aapl, name: "Apple Inc.", price: 10, previousClose: 8, timeMs: now }, now)
    const later = now + PRICE_MAX_AGE_MS + 1
    book.expire(later)
    book.applyQuote({ symbol: aapl, price: 11, previousClose: 10, timeMs: later }, later)
    expect(book.getPrice(aapl)).toMatchObject({ price: 11, previousClose: 10 })
  })
})

describe("quote book loading", () => {
  it("marks an empty row as loading until its snapshot lands", () => {
    const book = new QuoteBook()
    book.beginLoad(aapl)
    expect(book.getName(aapl).loading).toBe(true)
    expect(book.getPrice(aapl).loading).toBe(true)
    book.applySnapshot({ symbol: aapl, name: "Apple Inc.", price: 10, previousClose: 8, timeMs: now }, now)
    expect(book.getName(aapl).loading).toBe(false)
    expect(book.getPrice(aapl).loading).toBe(false)
  })

  it("leaves a row that already shows data alone, and stops loading when the request fails", () => {
    const book = new QuoteBook()
    book.applySnapshot({ symbol: aapl, name: "Apple Inc.", price: 10, previousClose: 8, timeMs: now }, now)
    book.beginLoad(aapl)
    expect(book.getPrice(aapl).loading).toBe(false)
    const ko = parseSymbol("KO")
    if (!ko) throw new Error("KO")
    book.beginLoad(ko)
    book.failLoad(ko)
    expect(book.getName(ko).loading).toBe(false)
    expect(book.getPrice(ko).loading).toBe(false)
  })

  it("keeps the price loading when the saved one is too old, until a new quote lands", () => {
    const book = new QuoteBook()
    book.applySnapshot(
      { symbol: aapl, name: "Apple Inc.", price: 10, previousClose: 8, timeMs: now - PRICE_MAX_AGE_MS - 1 },
      now,
    )
    expect(book.getPrice(aapl)).toMatchObject({ price: null, loading: true })
    book.applyQuote({ symbol: aapl, price: 11, previousClose: 10, timeMs: now }, now)
    expect(book.getPrice(aapl)).toMatchObject({ price: 11, loading: false })
  })
})

