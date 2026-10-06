import { useEffect, useRef, type ReactNode } from "react"
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
  className?: string
  node?: ReactNode
}

export type ColumnModel = {
  label: string
  className?: string
}

export function Grid({
  state,
  columns,
  dispatch,
  cell,
  selectable = false,
}: {
  state: GridState
  columns: readonly ColumnModel[]
  dispatch: (action: GridAction) => void
  cell: (addr: Addr) => CellModel
  selectable?: boolean
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

  const filled = state.tickers.flatMap((ticker, index) => (ticker === "" ? [] : [index]))
  const allChecked = filled.length > 0 && filled.every((row) => state.selected.includes(row))
  const someChecked = filled.some((row) => state.selected.includes(row))

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
        ref.current?.focus({ preventScroll: true })
      }}
    >
      <table>
        <colgroup>
          {selectable ? <col className="check" /> : null}
          {columns.map((column) => (
            <col key={column.label} className={column.className} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {selectable ? (
              <th className="check" scope="col">
                <SelectAll
                  checked={allChecked}
                  indeterminate={someChecked && !allChecked}
                  onChange={() => dispatch({ type: "toggle-all" })}
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column.label} scope="col" className={column.className}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {selectable ? (
                <td className="check">
                  {state.tickers[r] ? (
                    <input
                      type="checkbox"
                      aria-label={`Select ${state.tickers[r]}`}
                      checked={state.selected.includes(r)}
                      onChange={() => dispatch({ type: "toggle-row", row: r })}
                    />
                  ) : null}
                </td>
              ) : null}
              {Array.from({ length: COL_COUNT }, (_, c) => {
                const addr = { c, r }
                const model = cell(addr)
                const focused = state.focus.c === c && state.focus.r === r
                const ranged = inRange(state.anchor, state.focus, addr)
                const editing = state.editing?.addr.c === c && state.editing.addr.r === r
                return (
                  <td
                    key={c}
                    role="gridcell"
                    aria-selected={focused}
                    className={[
                      columns[c]?.className,
                      model.className,
                      ranged ? "range" : "",
                      focused ? "focus" : "",
                      editing && !model.node ? "editing" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={(event) => dispatch({ type: "select", addr, shift: event.shiftKey })}
                    onDoubleClick={() => dispatch({ type: "begin-edit" })}
                  >
                    {model.node ?? (editing && state.editing ? state.editing.draft : model.text)}
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

function SelectAll({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input ref={ref} type="checkbox" aria-label="Select all rows" checked={checked} onChange={onChange} />
  )
}
