# Free US stock feeds

Prices below are from provider pages and summaries checked on 2026-10-05. Confirm the current plan before you rely on a number.

| Provider | Free real-time US stocks | Free limits | Streaming | Use here |
| --- | --- | --- | --- | --- |
| Finnhub | Yes | 60 REST calls a minute, websocket up to 50 symbols | Websocket trades | First adapter. This app polls `/quote` every 5 minutes |
| Alpaca Basic | IEX only | 200 REST calls a minute, websocket 30 symbols, one connection | Websocket trades and quotes | Second adapter, after the MVP |
| Tiingo | IEX | 50 requests an hour, 1,000 a day | REST and websocket | Fallback only. The hourly cap rules out polling |
| Twelve Data | No for display | 8 credits a minute, websocket trial of 8 symbols | Trial only | No |
| Alpha Vantage | Delayed | 25 requests a day | None | No |
| Massive (Polygon.io) | End of day | 5 calls a minute | Paid | No. Real time starts near $199 a month |
| Yahoo Finance, unofficial | Near real time | Undocumented, and worse from cloud addresses | None | No |
| Simulated | None needed | None | Local timer | Demo mode and tests |

Licence notes for Finnhub and Alpaca are in [licensing](licensing.md).
