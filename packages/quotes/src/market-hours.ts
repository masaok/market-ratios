const OPEN_MINUTE = 9 * 60 + 30
const CLOSE_MINUTE = 16 * 60

export function isUsEquitySessionOpen(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
  const weekday = part("weekday")
  if (weekday === "Sat" || weekday === "Sun") return false
  const minute = Number(part("hour")) * 60 + Number(part("minute"))
  return minute >= OPEN_MINUTE && minute < CLOSE_MINUTE
}
