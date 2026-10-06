<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Engineering practices

This repo and `market-ratios-cloud` follow [Engineering practices that survive the stack](https://www.expeditionlabs.co/resources/engineering-practices/llms.txt): 33 techniques across gates, boundaries, single sources of truth, honest checks, state, adoption and trust. Read it before adding or changing a check, hook, CI job, migration or config file, and start with the P0 items. Never bypass a hook or weaken a check to get green.
