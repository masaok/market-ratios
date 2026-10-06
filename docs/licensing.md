# Bring your own key

Market Ratios does not proxy prices. The browser talks to the data provider with a key the visitor pastes in. The server never sees the key or a price.

## Finnhub

Read on 2026-10-06 from the [terms of service](https://finnhub.io/terms-of-service) and the [FAQ](https://finnhub.io/faq).

The terms say every plan on the site is for personal use unless Finnhub says otherwise. You agree not to redistribute data, or results derived from that data, without written approval. A personal plan cannot be used by a business, even internally, without written approval. All data from a subscription must be deleted when that subscription ends. The FAQ says commercial use exists and points businesses to sales@finnhub.io. A free account does not require a card.

That rules out one shared free key on our server. It allows a person to use their own free key in their own browser.

## Alpaca

Read on 2026-10-06 from the [market data overview](https://docs.alpaca.markets/us/docs/about-market-data-api), the [terms and conditions](https://files.alpaca.markets/disclosures/library/TermsAndConditions.pdf), the [customer agreement](https://files.alpaca.markets/disclosures/library/AcctAppMarginAndCustAgmt.pdf), and [Alpaca's support answer on redistribution](https://alpaca.markets/support/redistribute-alpaca-api).

The free Basic plan is real-time for the IEX exchange only, with 30 websocket symbols and 200 REST calls a minute. The terms limit the service to personal, non-commercial use unless you give Alpaca 30 days' notice before offering it to other people, and Alpaca can refuse that use. The customer agreement says not to reproduce, distribute, sell, or commercially exploit the market data without written consent. Support's short answer is that you cannot redistribute Alpaca API data.

Alpaca stays the second adapter, after the MVP, and only as a bring-your-own-key provider.
