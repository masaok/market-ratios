/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { Grid } from "./grid"
import { addrName, initialGrid, reduceGrid, symbolForRow, type Addr, type GridState } from "./model"

function Harness() {
  const [state, setState] = useState<GridState>(() => initialGrid(["AAPL", "MSFT"]))
  return (
    <>
      <div data-testid="name-box">{addrName(state.focus)}</div>
      <Grid
        state={state}
        dispatch={(action) => setState((current) => reduceGrid(current, action))}
        cell={(addr: Addr) => ({ text: symbolForRow(state, addr.r) })}
      />
    </>
  )
}

describe("grid keyboard", () => {
  it("moves the selection with the arrow keys and edits a ticker with F2", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByTestId("name-box").textContent).toBe("C5")
    await user.click(screen.getByTestId("grid"))
    await user.keyboard("{ArrowDown}")
    expect(screen.getByTestId("name-box").textContent).toBe("C6")
    await user.keyboard("{F2}{Escape}")
    expect(screen.getByTestId("name-box").textContent).toBe("C6")
    screen.getByTestId("grid").focus()
    await user.keyboard("ko{Enter}")
    expect(screen.getAllByText("KO").length).toBeGreaterThan(0)
    expect(screen.getByTestId("name-box").textContent).toBe("C7")
  })
})
