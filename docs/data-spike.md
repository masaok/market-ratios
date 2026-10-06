# Finnhub spike

Ran `node scripts/finnhub-spike.mjs` at 2026-10-06T06:10:32Z.

The US cash session was closed. `FINNHUB_API_KEY` was not set, so the script did not call `/quote`.

Run it again during the session, 9:30 to 16:00 America/New_York, with `FINNHUB_API_KEY` set. It prints the quote payload for AAPL and WMM. WMM is the ticker to check. The screenshot uses it for Wal Mart de Mexico, and it may not resolve as a US symbol. The sheet refreshes those quotes every 5 minutes.
