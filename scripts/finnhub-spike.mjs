const key = process.env.FINNHUB_API_KEY ?? ""
const now = new Date()
const open = isUsEquitySessionOpen(now)

console.log(`at ${now.toISOString()}`)
console.log(`us equity session open: ${open}`)

if (!key) {
  console.log("no FINNHUB_API_KEY, skipped the quote calls")
  process.exit(0)
}

const symbols = ["AAPL", "WMM"]
for (const symbol of symbols) {
  const response = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${encodeURIComponent(key)}`,
  )
  const body = await response.text()
  console.log(`quote ${symbol} status ${response.status} body ${body.slice(0, 240)}`)
}

function isUsEquitySessionOpen(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const part = (type) => parts.find((item) => item.type === type)?.value
  const weekday = part("weekday")
  if (weekday === "Sat" || weekday === "Sun") return false
  const minute = Number(part("hour")) * 60 + Number(part("minute"))
  return minute >= 9 * 60 + 30 && minute < 16 * 60
}
