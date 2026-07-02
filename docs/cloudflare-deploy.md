# Cloudflare Deploy

Roadbook Studio needs Cloudflare Pages Functions for:

- `POST /api/parse`: Workers AI extracts route places from preferences, pasted text, and screenshots.
- `POST /api/route`: geocodes and orders each day.
- `POST /api/share`: stores the generated HTML in KV and returns `/share/:id`.
- `GET /share/:id`: renders the saved roadbook HTML for phone/web access.

## One-time setup

```bash
npx wrangler login
npm run cloudflare:setup
```

`cloudflare:setup` creates the KV namespace and writes this binding into `wrangler.toml`:

```text
ROADBOOKS
```

Create the Cloudflare Pages project if it does not exist:

```bash
npx wrangler pages project create roadbook-studio
```

Also configure these secrets on the Pages project:

```text
AI                Workers AI binding
GOOGLE_MAPS_API_KEY
AMAP_API_KEY      optional, or GAODE_API_KEY
```

## Local cloud-share check

```bash
npm run dev:share
```

This starts Pages Functions locally with local `ROADBOOKS` KV. Use it to verify that `发布云端网页` returns a `/share/:id` URL instead of the static-server warning.

For the full AI-backed local path, log in to Cloudflare first and run:

```bash
npm run dev:cloudflare
```

## Deploy

```bash
npm run deploy:cloudflare
```

For GitHub Actions deploys, set these repository secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The deployed app returns cloud URLs like:

```text
https://roadbook-studio.pages.dev/share/<id>
```

Those URLs are generated from the final roadbook HTML and can be opened directly on mobile or desktop browsers.
