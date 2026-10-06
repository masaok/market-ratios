import { useRef, type ReactNode } from "react"
import {
  COL_COUNT,
  inRange,
  rowCount,
  type Addr,
  type GridAction,
  type GridState,
} from "./model"

export type CellModel = {
  text: string
  colSpan?: number
  skip?: boolean
  className?: string
  node?: ReactNode
}

const LETTERS = ["A", "B", "C", "D", "E", "F"]

export function Grid({
  state,
  dispatch,
  cell,
}: {
  state: GridState
  dispatch: (action: GridAction) => void
  cell: (addr: Addr) => CellModel
}) {
  const ref = useRef<HTMLDivElement>(null)
  const rows = rowCount(state)

  function onKeyDown(event: React.KeyboardEvent) {
    const target = event.target as HTMLElement
    if (target.closest("input, textarea")) return
    if (state.editing) {
      if (event.key === "Escape") {
        event.preventDefault()
        dispatch({ type: "cancel" })
        ref.current?.focus()
        return
      }
      if (event.key === "Enter") {
        move(event, 0, 1)
        return
      }
      if (event.key === "Tab") {
        event.preventDefault()
        dispatch({ type: "move", dc: event.shiftKey ? -1 : 1, dr: 0, shift: false })
        return
      }
      if (event.key === "Backspace") {
        event.preventDefault()
        dispatch({ type: "draft", text: state.editing.draft.slice(0, -1) })
        return
      }
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        dispatch({ type: "draft", text: state.editing.draft + event.key })
      }
      return
    }
    if (event.key === "ArrowUp") move(event, 0, -1)
    else if (event.key === "ArrowDown") move(event, 0, 1)
    else if (event.key === "ArrowLeft") move(event, -1, 0)
    else if (event.key === "ArrowRight") move(event, 1, 0)
    else if (event.key === "Tab") {
      event.preventDefault()
      dispatch({ type: "move", dc: event.shiftKey ? -1 : 1, dr: 0, shift: false })
    } else if (event.key === "Enter") {
      event.preventDefault()
      dispatch({ type: "move", dc: 0, dr: 1, shift: false })
    } else if (event.key === "F2") {
      event.preventDefault()
      dispatch({ type: "begin-edit" })
    } else if (event.key === "Escape") {
      dispatch({ type: "cancel" })
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault()
      dispatch({ type: "clear" })
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      dispatch({ type: "begin-edit", seed: event.key })
    }
  }

  function move(event: React.KeyboardEvent, dc: number, dr: number) {
    event.preventDefault()
    dispatch({ type: "move", dc, dr, shift: event.shiftKey })
  }

  return (
    <div
      ref={ref}
      className="grid-scroll"
      data-testid="grid"
      role="grid"
      tabIndex={0}
      aria-label="Stock monitor"
      onKeyDown={onKeyDown}
      onMouseDown={(event) => {
        const target = event.target as HTMLElement
        if (target.closest("input, textarea, button, a")) return
        event.preventDefault()
        ref.current?.focus()
      }}
    >
      <table>
        <colgroup>
          <col className="gutter" />
          <col className="col-a" />
          <col className="col-company" />
          <col className="col-ticker" />
          <col className="col-price" />
          <col className="col-change" />
          <col className="col-f" />
        </colgroup>
        <thead>
          <tr>
            <th className="corner" />
            {LETTERS.map((letter) => (
              <th key={letter} className="colhead">
                {letter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <th className="rowhead">{r + 1}</th>
              {Array.from({ length: COL_COUNT }, (_, c) => {
                const addr = { c, r }
                const model = cell(addr)
                if (model.skip) return null
                const focused = state.focus.c === c && state.focus.r === r
                const ranged = inRange(state.anchor, state.focus, addr)
                const editing = state.editing?.addr.c === c && state.editing.addr.r === r
                return (
                  <td
                    key={c}
                    colSpan={model.colSpan}
                    role="gridcell"
                    aria-selected={focused}
                    className={[model.className, ranged ? "range" : "", focused ? "focus" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={(event) => dispatch({ type: "select", addr, shift: event.shiftKey })}
                    onDoubleClick={() => dispatch({ type: "begin-edit" })}
                  >
                    {editing && state.editing ? state.editing.draft : (model.node ?? model.text)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
