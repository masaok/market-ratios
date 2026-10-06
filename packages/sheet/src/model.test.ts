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
    expect(symbolForRow(state, 0)).toBe("AAPL")
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
    expect(state.focus.r).toBe(1)
    state = reduceGrid(state, { type: "cancel" })
    state = reduceGrid(state, { type: "select", addr: { c: 1, r: 0 }, shift: false })
    state = reduceGrid(state, { type: "move", dc: 0, dr: 1, shift: true })
    expect(state.anchor).toEqual({ c: 1, r: 0 })
    expect(state.focus).toEqual({ c: 1, r: 1 })
  })

  it("checks rows and deletes them together", () => {
    let state = initialGrid(["AAPL", "MSFT", "KO"])
    state = reduceGrid(state, { type: "toggle-row", row: 0 })
    state = reduceGrid(state, { type: "toggle-row", row: 2 })
    state = reduceGrid(state, { type: "toggle-row", row: 3 })
    expect(state.selected).toEqual([0, 2])
    state = reduceGrid(state, { type: "delete-selected" })
    expect(state.tickers.filter((ticker) => ticker !== "")).toEqual(["MSFT"])
    expect(state.selected).toEqual([])
  })

  it("checks every filled row, then clears that check", () => {
    let state = initialGrid(["AAPL", "MSFT"])
    state = reduceGrid(state, { type: "toggle-all" })
    expect(state.selected).toEqual([0, 1])
    state = reduceGrid(state, { type: "toggle-all" })
    expect(state.selected).toEqual([])
  })
})
