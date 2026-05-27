# ProfAI v2 — Cloudflare-native AI tutor

Adaptive AI tutor: tell it a topic, take a 5-question diagnostic, then learn through a Socratic chat with auto-generated diagrams. Multi-chat history (ChatGPT-style sidebar), saved reports with PDF export, progress dashboard, free signup with email + password.

## Stack

- **Frontend:** [vinext](https://github.com/cloudflare/vinext) (Next.js API surface on Vite), React 19, Tailwind 3, shadcn/ui
- **Backend:** Same Worker via vinext route handlers (`app/api/*`)
- **DB:** Cloudflare D1 (SQLite) via [drizzle-orm](https://orm.drizzle.team)
- **Storage:** R2 for uploaded images, generated diagrams, and PDF reports
- **AI:** `env.AI.run("google/gemini-3-flash", ...)` for tutoring, `@cf/black-forest-labs/flux-1-schnell` for diagrams
- **PDF:** Cloudflare Browser Rendering (`@cloudflare/puppeteer`)
- **Auth:** email + password, scrypt hashing (`@noble/hashes`), D1-backed session tokens, `__Host-` cookie, sliding 30-day TTL
- **Crypto:** AES-GCM at-rest encryption for chat message content (key derived via HKDF from `CONTENT_KEY` Worker secret)

## Local development

Prereqs: Node.js 20+, a Cloudflare account, `wrangler` CLI logged in.

```bash
cp .dev.vars.example .dev.vars
# Fill in the placeholders:
#   CONTENT_KEY      = openssl rand -base64 32
#   IP_HASH_SALT     = any random string
#   AI_GATEWAY_GOOGLE_API_KEY = your Google AI Studio API key

npm install
npx wrangler d1 create profai_db                 # paste UUID into wrangler.jsonc
npx wrangler kv namespace create profai_kv       # paste id into wrangler.jsonc
npx wrangler r2 bucket create profai-uploads
npm run db:migrate:local
npm run dev                                      # http://localhost:3000
```

## Tests

```bash
npm test                  # unit tests (28 currently)
npm run typecheck
npm run build
```

## Deploy

```bash
npm run db:migrate:remote
npm run deploy
```

Set Worker secrets in production:

```bash
wrangler secret put CONTENT_KEY
wrangler secret put IP_HASH_SALT
wrangler secret put AI_GATEWAY_GOOGLE_API_KEY
wrangler secret put TURNSTILE_SECRET_KEY        # optional
```

## Architecture & specs

- Spec: [`docs/superpowers/specs/2026-04-26-profai-v2-cloudflare-rewrite-design.md`](docs/superpowers/specs/2026-04-26-profai-v2-cloudflare-rewrite-design.md)
- Plan: [`docs/superpowers/plans/2026-04-26-profai-v2-cloudflare-rewrite.md`](docs/superpowers/plans/2026-04-26-profai-v2-cloudflare-rewrite.md)
- Legacy v1 prompt history is preserved at `lib/ai/prompts/legacy/` for reference.

## Notes / known caveats

- **vinext is experimental** (Cloudflare-built Next.js reimplementation, ~94% of Next 16 surface). The fallback path is documented in the spec — if vinext blocks production, swap to Vite + React SPA + a separate Hono Worker; business logic in `lib/` is unaffected.
- **Workers Rate Limiting API only supports 10s and 60s windows** — limits are tuned to 60s buckets (signup 2/min, login 10/min, chat 60/min, upload 6/min, PDF 2/min).
- **Tailwind is pinned to v3** — v4 changed the PostCSS pipeline incompatibly with vinext at this time.
- **Workers Browser Rendering** powers PDF export; first-time render is slower than cached, hence the R2 cache.
