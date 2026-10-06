/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest"
import { loadApiKey, loadSheet, saveApiKey, saveSheet } from "./storage"

describe("saved key", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("is empty before a key is saved", () => {
    expect(loadApiKey()).toBeNull()
  })

  it("saves and removes the key without touching the saved tickers", () => {
    saveSheet({ tickers: ["AAPL", "KO"], apiKey: null })
    saveApiKey("abc123")
    expect(loadApiKey()).toBe("abc123")
    expect(loadSheet()?.tickers).toEqual(["AAPL", "KO"])
    saveApiKey(null)
    expect(loadApiKey()).toBeNull()
    expect(loadSheet()?.tickers).toEqual(["AAPL", "KO"])
  })
})
