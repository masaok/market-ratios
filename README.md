# Market Ratios

A spreadsheet in the browser that fills itself with stock prices.

The sheet starts in demo mode, so you can see it move before you create an account with a data vendor. Paste a free [Finnhub](https://finnhub.io/register) key when you want that vendor's prices. The browser sends the key to Finnhub. This app does not.

![The Monitor sheet running on simulated prices](docs/monitor.png)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/masaok/market-ratios&project-name=market-ratios&root-directory=apps/demo)

## Run the demo

Install pnpm 12, then from this directory:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The Monitor sheet lists 22 tickers and the prices change on a timer. The banner says the data is simulated.

To use Finnhub, choose **Add a Finnhub key**, paste the key, and choose **Use key**. Prices refresh every 5 minutes. An invalid key stays on the key panel and the sheet keeps the simulated prices. The ticker list and the key are stored in this browser.

`WMM` is in the default list because it is on the reference screenshot. Finnhub may not resolve it as a US ticker. That row shows `#N/A` when the provider has no name and no price.

## Packages

`@market-ratios/quotes` is the provider interface, the simulated provider, and the Finnhub adapter. It does not depend on React.

`@market-ratios/sheet` is the grid and the stock monitor. Give it a page and it renders the sheet.

Both packages are version 0.1.0 and are not published yet.

The comparison of free feeds is in [docs/providers.md](docs/providers.md). The licence position is in [docs/licensing.md](docs/licensing.md). To add a provider, read [CONTRIBUTING.md](CONTRIBUTING.md).

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
```

`scripts/finnhub-spike.mjs` records a live Finnhub session when `FINNHUB_API_KEY` is set. Without that variable it prints whether the US cash session is open and exits.
