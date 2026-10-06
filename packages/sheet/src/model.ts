export const COL_COUNT = 4
export const COL = { company: 0, ticker: 1, price: 2, change: 3 } as const

export type Addr = { c: number; r: number }

export type GridState = {
  tickers: string[]
  anchor: Addr
  focus: Addr
  editing: { addr: Addr; draft: string } | null
  selected: number[]
}

export type GridAction =
  | { type: "select"; addr: Addr; shift: boolean }
  | { type: "move"; dc: number; dr: number; shift: boolean }
  | { type: "begin-edit"; seed?: string }
  | { type: "edit-ticker"; row: number }
  | { type: "draft"; text: string }
  | { type: "commit" }
  | { type: "cancel" }
  | { type: "clear" }
  | { type: "add-row" }
  | { type: "toggle-row"; row: number }
  | { type: "toggle-all" }
  | { type: "delete-selected" }

export function changePercent(price: number, previousClose: number): number | null {
  if (!Number.isFinite(price) || !Number.isFinite(previousClose) || previousClose === 0) return null
  return ((price - previousClose) / previousClose) * 100
}

export function formatPrice(price: number): string {
  return price.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export function formatPercent(percent: number): string {
  const rounded = Math.round(percent * 100) / 100
  const digits = Math.abs(rounded).toFixed(2)
  return rounded < 0 ? `-${digits}%` : `${digits}%`
}

export function rowCount(state: GridState): number {
  return state.tickers.length
}

export function symbolForRow(state: GridState, row: number): string {
  return state.tickers[row] ?? ""
}

export function initialGrid(tickers: readonly string[]): GridState {
  const list = tickers.map((ticker) => ticker.trim().toUpperCase()).filter((ticker) => ticker.length > 0)
  list.push("")
  const focus = { c: COL.ticker, r: 0 }
  return { tickers: list, anchor: focus, focus, editing: null, selected: [] }
}

function filledRows(tickers: readonly string[]): number[] {
  const rows: number[] = []
  tickers.forEach((ticker, index) => {
    if (ticker !== "") rows.push(index)
  })
  return rows
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function withTrailingBlank(tickers: string[]): string[] {
  if (tickers.length === 0 || tickers[tickers.length - 1] !== "") return [...tickers, ""]
  return tickers
}

function commitEditing(state: GridState): GridState {
  if (!state.editing) return state
  const { addr, draft } = state.editing
  const idle = { ...state, editing: null }
  if (addr.c !== COL.ticker) return idle
  const index = addr.r
  if (index < 0 || index >= state.tickers.length) return idle
  const next = draft.trim().toUpperCase()
  const tickers = state.tickers.slice()
  tickers[index] = next
  if (next === "") {
    if (tickers.length > 1) tickers.splice(index, 1)
    if (tickers[tickers.length - 1] !== "") tickers.push("")
  } else if (tickers[tickers.length - 1] !== "") {
    tickers.push("")
  }
  return { ...idle, tickers }
}

export function reduceGrid(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case "draft":
      if (!state.editing) return state
      return { ...state, editing: { ...state.editing, draft: action.text.toUpperCase() } }
    case "cancel":
      return { ...state, editing: null }
    case "commit":
      return commitEditing(state)
    case "clear": {
      if (state.focus.c !== COL.ticker) return state
      const editing = { addr: state.focus, draft: "" }
      return commitEditing({ ...state, editing })
    }
    case "begin-edit": {
      if (state.focus.c !== COL.ticker) return state
      const index = state.focus.r
      if (index < 0 || index >= state.tickers.length) return state
      const current = state.tickers[index] ?? ""
      const draft = action.seed != null ? action.seed.toUpperCase() : current
      return { ...state, editing: { addr: state.focus, draft } }
    }
    case "edit-ticker": {
      const committed = commitEditing(state)
      if (action.row < 0 || action.row >= committed.tickers.length) return committed
      const addr = { c: COL.ticker, r: action.row }
      return {
        ...committed,
        focus: addr,
        anchor: addr,
        editing: { addr, draft: committed.tickers[action.row] ?? "" },
      }
    }
    case "toggle-row": {
      const ticker = state.tickers[action.row]
      if (!ticker) return state
      const selected = state.selected.includes(action.row)
        ? state.selected.filter((row) => row !== action.row)
        : [...state.selected, action.row]
      return { ...state, selected }
    }
    case "toggle-all": {
      const rows = filledRows(state.tickers)
      const all = rows.length > 0 && rows.every((row) => state.selected.includes(row))
      return { ...state, selected: all ? [] : rows }
    }
    case "delete-selected": {
      const drop = new Set(state.selected)
      const tickers = state.tickers.filter((ticker, index) => ticker === "" || !drop.has(index))
      if (tickers.at(-1) !== "") tickers.push("")
      const focus = { c: COL.ticker, r: 0 }
      return { tickers, anchor: focus, focus, editing: null, selected: [] }
    }
    case "add-row": {
      const committed = commitEditing(state)
      const tickers = withTrailingBlank(committed.tickers)
      const addr = { c: COL.ticker, r: tickers.length - 1 }
      return { tickers, anchor: addr, focus: addr, editing: { addr, draft: "" }, selected: committed.selected }
    }
    case "select": {
      const committed = commitEditing(state)
      const rows = rowCount(committed)
      const addr = {
        c: clamp(action.addr.c, 0, COL_COUNT - 1),
        r: clamp(action.addr.r, 0, rows - 1),
      }
      return {
        ...committed,
        focus: addr,
        anchor: action.shift ? committed.anchor : addr,
      }
    }
    case "move": {
      const committed = commitEditing(state)
      const rows = rowCount(committed)
      const focus = {
        c: clamp(committed.focus.c + action.dc, 0, COL_COUNT - 1),
        r: clamp(committed.focus.r + action.dr, 0, rows - 1),
      }
      return {
        ...committed,
        focus,
        anchor: action.shift ? committed.anchor : focus,
      }
    }
    default: {
      const neverAction: never = action
      return neverAction
    }
  }
}

export function inRange(anchor: Addr, focus: Addr, addr: Addr): boolean {
  const c1 = Math.min(anchor.c, focus.c)
  const c2 = Math.max(anchor.c, focus.c)
  const r1 = Math.min(anchor.r, focus.r)
  const r2 = Math.max(anchor.r, focus.r)
  return addr.c >= c1 && addr.c <= c2 && addr.r >= r1 && addr.r <= r2
}
