import { describe, expect, it } from "vitest"
import { isUsEquitySessionOpen } from "./market-hours"

describe("US equity session", () => {
  it("is open at 9:30 New York and closed at the closing bell", () => {
    expect(isUsEquitySessionOpen(new Date("2026-10-05T09:30:00-04:00"))).toBe(true)
    expect(isUsEquitySessionOpen(new Date("2026-10-05T09:29:00-04:00"))).toBe(false)
    expect(isUsEquitySessionOpen(new Date("2026-10-05T15:59:00-04:00"))).toBe(true)
    expect(isUsEquitySessionOpen(new Date("2026-10-05T16:00:00-04:00"))).toBe(false)
  })

  it("is closed on Saturday and before the open on a weekday", () => {
    expect(isUsEquitySessionOpen(new Date("2026-10-03T14:00:00-04:00"))).toBe(false)
    expect(isUsEquitySessionOpen(new Date("2026-10-06T01:58:00-04:00"))).toBe(false)
  })
})
