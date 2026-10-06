import { describe, expect, it } from "vitest"
import {
  changePercent,
  formatPercent,
  initialGrid,
  reduceGrid,
  symbolForRow,
} from "./model"

describe("sheet model", () => {
  it("computes change percent from price and previous close", () => {
    expect(changePercent(110, 100)).toBe(10)
    expect(formatPercent(-0.4)).toBe("-0.40%")
    expect(formatPercent(1.2)).toBe("1.20%")
    expect(changePercent(10, 0)).toBeNull()
  })

  it("commits a ticker edit and removes a cleared row", () => {
    let state = initialGrid(["AAPL", "MSFT"])
    expect(symbolForRow(state, 4)).toBe("AAPL")
    state = reduceGrid(state, { type: "begin-edit" })
    state = reduceGrid(state, { type: "draft", text: "ko" })
    state = reduceGrid(state, { type: "commit" })
    expect(state.tickers[0]).toBe("KO")
    state = reduceGrid(state, { type: "clear" })
    expect(state.tickers[0]).toBe("MSFT")
    expect(state.tickers.at(-1)).toBe("")
  })

  it("adds a blank row and extends a shift selection", () => {
    let state = initialGrid(["AAPL"])
    state = reduceGrid(state, { type: "add-row" })
    expect(state.editing?.draft).toBe("")
    expect(state.focus.r).toBe(5)
    state = reduceGrid(state, { type: "cancel" })
    state = reduceGrid(state, { type: "select", addr: { c: 2, r: 4 }, shift: false })
    state = reduceGrid(state, { type: "move", dc: 0, dr: 1, shift: true })
    expect(state.anchor).toEqual({ c: 2, r: 4 })
    expect(state.focus).toEqual({ c: 2, r: 5 })
  })
})
