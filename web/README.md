# GiftHub web app

The React app and the Cloudflare Worker. Setup, commands and deployment are in the [main README](../README.md).

- `src/` is the app: `pages/` holds one file per screen, `components/` the shared pieces, and `lib/` the data hooks and helpers (tests sit next to them).
- `worker/` is the Worker that answers `/api/*`. Everything else is static files from `dist/`.
- `wrangler.jsonc` holds the Cloudflare config: static assets, the Worker, and the link-reading rate limit.
- `scripts/` holds build helpers.
