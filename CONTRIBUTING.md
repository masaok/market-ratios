# Add a provider

A provider turns a list of tickers into prices. The sheet never imports a vendor SDK. It only sees `QuoteProvider` from `@market-ratios/quotes`.

1. Add `packages/quotes/src/<name>.ts` that exports `create<Name>Provider`.
2. Implement `subscribe`, `getSnapshot`, and `onStatus`. Hide the refresh interval, rate limits, and the symbol cap inside that file.
3. Parse vendor JSON in that file. Return `Quote` and `Snapshot` only.
4. Add tests with a fake `fetch`. Do not call the real vendor from tests.
5. Export the factory from `packages/quotes/src/index.ts`.
6. Document the free-tier limits and the licence in `docs/providers.md`.

`pnpm test` runs the suite. `pnpm typecheck` and `pnpm lint` match CI.

The demo app and the hosted site stay thin. They create a provider and render `StockMonitor`. Product behavior belongs in `packages/quotes` or `packages/sheet`.
