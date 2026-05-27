# ProfAI v2 — Cloudflare-Native Rewrite Design

**Date:** 2026-04-26
**Status:** Draft, pending user review
**Replaces:** existing single-screen Gemini SPA (`App.tsx`, `services/geminiService.ts`)

## 1. Goal

Rewrite the existing in-browser Gemini tutoring SPA into a production-grade Cloudflare-native web app with:

- Email/password auth and persistent sessions.
- Multi-chat history (ChatGPT-style sidebar): a user can run many tutoring topics, leave, and resume any of them.
- Persistent diagnostic assessments, chat messages, and uploaded images.
- Saved reports (assessment, progress checkpoints, completion) viewable in the app and downloadable as PDF.
- A progress dashboard summarising activity across chats.
- All inference, storage, auth, and serving on Cloudflare's stack — no third-party hosting, no client-side AI keys.

## 2. Non-goals (explicit YAGNI)

OAuth / SSO / magic links · 2FA · mobile native apps · offline mode · real-time collab · bookmarks · flashcards · study streaks · social/sharing features · public reports · i18n · admin panel · payment / subscription · email-based password reset (deferred — flagged in §11).

## 3. High-level architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                      Single Cloudflare Worker                      │
│                                                                    │
│  vinext (Next.js 16 API surface on Vite, native Workers deploy)    │
│  ├─ pages: /, /login, /signup, /chat, /chat/[id],                  │
│  │         /dashboard, /reports, /reports/[id], /settings          │
│  ├─ middleware.ts: cookie → user_id attach for /api/*              │
│  └─ app/api/*: route handlers                                      │
│                                                                    │
│  Bindings:                                                         │
│  ├─ env.DB           → D1   (users, auth_sessions, chats,         │
│  │                          messages, assessments, reports, audit) │
│  ├─ env.KV           → KV   (declared but unused in v2;           │
│  │                          reserved for future read-through cache)│
│  ├─ env.R2           → R2   (uploaded images, generated PDFs)     │
│  ├─ env.AI           → Workers AI binding (CF native + Gemini)    │
│  ├─ env.BROWSER      → Browser Rendering (PDF generation)         │
│  └─ env.RATE_LIMITER → Workers Rate Limiting API (multi-namespace)│
└────────────────────────────────────────────────────────────────────┘
```

One repo, one `wrangler.jsonc`, one deploy. No separate API service.

### 3.1 vinext risk + fallback

**Risk:** [vinext](https://github.com/cloudflare/vinext) is experimental (released by Cloudflare in early 2026, ~94% of Next.js 16 surface, AI-assisted implementation). Open issues exist around streaming/HMR and SPA-fallback routing conflicts. We accept this risk because the user explicitly chose vinext over OpenNext.

**Fallback path** (if vinext blocks production): drop vinext, keep the same `app/` and `components/` structure as a Vite + React SPA, replace `app/api/*` route handlers with a Hono Worker mounted on the same Worker via Workers Static Assets. Only routing/SSR changes — business logic in `lib/` is unaffected. This is documented in §13 to keep migration cheap.

## 4. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **vinext** (Vite plugin re-implementing Next.js 16 surface) | User-chosen; Cloudflare-native. |
| Language | TypeScript strict | |
| Styling | **Tailwind CSS** built locally (postcss in vite) | Replace v1's CDN script. |
| UI primitives | **shadcn/ui** | Copy-paste, no runtime dep on a UI lib. |
| Markdown / math | `react-markdown` + `remark-math` + `rehype-katex` + `remark-gfm` | Kept from v1. |
| Validation | `zod` (in `shared/validation.ts`, dep-free) | Shared client/server. |
| ORM | `drizzle-orm` for D1 | Typed schema; `drizzle-kit` to author SQL only. |
| Migrations | `wrangler d1 migrations apply` | Canonical for D1; not `drizzle-kit push`. |
| Crypto | `@noble/hashes` (scrypt) + Web Crypto (rand, AES-GCM) | No native bcrypt/argon2 on Workers. |
| Logging | `lib/log.ts` (structured JSON, request-id) | |
| Errors | `lib/errors.ts` (`AppError` → HTTP) | |
| Testing | `vitest` + `@cloudflare/vitest-pool-workers` (miniflare) + `playwright` (one smoke) | Unit, integration with real bindings, e2e floor. |
| CI | GitHub Actions: lint, typecheck, vitest, migrations apply --remote (preview DB), playwright | |

## 5. AI integration

All inference goes through `env.AI.run(...)` — Workers AI's unified binding.

- **Gemini 3 Flash** (`google/gemini-3-flash`) for tutoring, assessment generation, analysis, title generation.
  - Routes through Cloudflare AI Gateway. Honest restatement: this requires a **Google AI Studio API key** stored as a Cloudflare secret on the AI Gateway. The benefit is that the key never reaches the browser and we get unified billing/observability via Cloudflare. It is not "zero credentials."
- **Flux Schnell** (`@cf/black-forest-labs/flux-1-schnell`) for diagram generation.
  - Native Workers AI; no external key.
- **Browser Rendering** (`env.BROWSER`) for PDF generation of reports.

### 5.1 Long-history strategy

Although Gemini 3 Flash supports 1M tokens of input, the **Worker CPU budget (30s on paid)** and **per-token cost** make blindly sending full history a bad default. Strategy:

- Compute approximate input token count (`chars / 4` heuristic) before each turn.
- **If ≤ 40 messages AND < 50K approx input tokens:** send the full message history.
- **Otherwise:** send the last 20 messages verbatim plus the chat's `rolling_summary` (a one-paragraph summary of all earlier messages). The rolling summary is regenerated and persisted to `chats.rolling_summary` whenever the cutover threshold is crossed.

### 5.2 Module layout (`lib/ai/`)

```
lib/ai/
  client.ts      # env.AI.run wrapper; retries; structured-output helper
  stream.ts      # SSE producer/consumer, abort wiring
  tools.ts       # tool-call schemas (startAssessment, generateDiagram)
  prompts/
    assessment.ts   # generateAssessment + analyseAssessment prompts
    tutor.ts        # tutoring system prompt + history shaping
    title.ts        # 6-word title from first turn
```

Public API (re-exported from `lib/ai/index.ts`):

```ts
generateAssessment(topic, imageR2Key?) → AssessmentQuestion[]
analyseAssessment(topic, qs, answers) → { level, summary, recommendedPath }
streamTutorReply(chatId, history, newUserText, newImageR2Key?, level, topic, signal)
  → AsyncIterable<{ type: "text"; text: string } | { type: "diagram"; r2Key: string }>
generateTitle(firstUserText) → string
```

## 6. Data model

### 6.1 D1 schema

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- ulid
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,            -- "scrypt$N$r$p$saltB64$hashB64"
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  deleted_at INTEGER                      -- soft-delete for GDPR
);

-- Auth sessions (was KV in v0 design; D1 for strong consistency on logout)
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,                    -- 32-byte hex token (also the cookie value)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_agent TEXT,
  ip_hash TEXT                            -- sha256(ip + salt) for audit, not raw IP
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires ON auth_sessions(expires_at);

-- Tutoring chats (renamed from "tutoring_sessions" to avoid collision with auth_sessions / KV)
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  level TEXT,                             -- Beginner|Intermediate|Advanced (set after assessment)
  status TEXT NOT NULL DEFAULT 'active',  -- active|completed|abandoned
  title TEXT,                             -- AI-generated short label for sidebar; falls back to topic
  rolling_summary TEXT,                   -- §5.1 long-history rollup
  started_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX idx_chats_user_active ON chats(user_id, last_active_at DESC);

-- Diagnostic assessment, one per chat
CREATE TABLE assessments (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
  questions_json TEXT NOT NULL,           -- write-once-read-once → blob is fine
  answers_json TEXT,                      -- nullable until completed
  score INTEGER,
  summary TEXT,
  recommended_path TEXT,
  completed_at INTEGER
);

-- Chat messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                     -- user|model
  content_ciphertext BLOB NOT NULL,       -- AES-GCM-encrypted (§7.5)
  content_iv BLOB NOT NULL,
  image_r2_key TEXT,                      -- nullable
  is_diagram INTEGER NOT NULL DEFAULT 0,  -- 0|1
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_messages_chat_created ON messages(chat_id, created_at);

-- Reports (assessment | progress | completion)
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                     -- assessment|progress|completion
  version INTEGER NOT NULL DEFAULT 1,     -- regeneration history
  title TEXT NOT NULL,
  content_md TEXT NOT NULL,
  pdf_r2_key TEXT,                        -- generated on demand, cached
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX idx_reports_user_created ON reports(user_id, created_at DESC);
CREATE INDEX idx_reports_chat ON reports(chat_id, created_at DESC);

-- Audit log
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,                           -- nullable for failed-login attempts
  event TEXT NOT NULL,                    -- signup|login|login_failed|logout|password_change|account_delete|export
  meta_json TEXT,
  created_at INTEGER NOT NULL,
  ip_hash TEXT
);
CREATE INDEX idx_audit_user_created ON audit_log(user_id, created_at DESC);
```

### 6.2 KV (`env.KV`)

Declared in `wrangler.jsonc` but **not consumed by any v2 code path**. Rate limiting uses the Workers Rate Limiting API (`env.RATE_LIMITER`); auth sessions live in D1; AI inference is per-request. KV is reserved for a v3 read-through cache (e.g., dashboard aggregates) so the binding is in place to avoid a wrangler change later.

### 6.3 R2 layout

```
uploads/{user_id}/{ulid}.{ext}    # user-uploaded images (private, served via Worker proxy)
diagrams/{chat_id}/{ulid}.png     # AI-generated diagrams
reports/{user_id}/{report_id}-v{n}.pdf  # generated PDFs (cached)
```

All R2 access goes through `/api/uploads/:key` proxy with `requireUser` + ownership check. **No raw signed URLs** are issued to the browser.

## 7. Auth & sessions

### 7.1 Password hashing

```
scrypt(password, salt) with N=2^17, r=8, p=1
hash := base64(scryptResult(64))
salt := base64(crypto.getRandomValues(16))
stored := "scrypt$17$8$1$" + saltB64 + "$" + hashB64
```

`@noble/hashes/scrypt` runs on Workers without WASM tricks. ~80–150 ms per hash on the paid plan — within budget.

### 7.2 Session token

```
token := hex(crypto.getRandomValues(32))   // 256-bit
```

Stored in D1 `auth_sessions` (id = token). Set as cookie:

```
__Host-session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

`__Host-` prefix locks cookie to apex domain — no subdomain split planned, OK.

### 7.3 Sliding renewal

On each authenticated request the middleware updates `last_seen_at`. If `expires_at - now < 7 days`, it extends `expires_at` to now + 30 days and re-issues the cookie. Avoids a write per request and dodges KV's old 1-write/sec/key limit (we're on D1, but the principle keeps writes cheap).

### 7.4 CSRF defence

Two layers:

1. `SameSite=Lax` on the session cookie blocks cross-site cookie attachment for top-level POST.
2. Every state-changing API route checks `Origin` header against the deployed origin (exact match). If `Origin` is missing or differs → 403.

We do **not** rely on `X-Requested-With`.

### 7.5 Encryption-at-rest for chat content

`messages.content_ciphertext` is AES-GCM-encrypted with a key derived from `env.CONTENT_KEY` (Worker secret) + `chat_id` salt. Image bytes in R2 are not encrypted (R2 is single-tenant; objects are private; cost not worth it for now).

### 7.6 Abuse / rate limiting

- **Cloudflare Turnstile** widget on `/signup` and `/login`.
- **Rate limits** via Workers Rate Limiting API:
  - signup: 5/IP/hour
  - login: 10/IP/15min, 5/email/15min
  - chat send: 60/user/min
  - upload: 30/user/hour
  - PDF gen: 20/user/day
- Failed-login increments + audit_log entry.
- Session rotation on password change (delete all auth_sessions for user, force re-login).

### 7.7 Upload validation

On `POST /api/uploads`:
- `Content-Length` ≤ 10 MB (strict).
- MIME via **magic-byte sniffing** (first 32 bytes), allowlist: `image/jpeg`, `image/png`, `image/webp`, `image/gif`. **Reject SVG.**
- **EXIF strip** via the `exifr` library on the Worker before R2 PUT (Workers-compatible, no native deps). On strip failure, the upload is rejected with 400 — we never store images we couldn't sanitise.
- Stored as `uploads/{user_id}/{ulid}.{ext}` with `httpMetadata.contentType` set from the sniffed MIME (not the client header).

## 8. API surface

All routes are in `app/api/*/route.ts`. Auth-protected unless noted "(anon)".

```
# Auth
POST   /api/auth/signup            (anon)  email,password,turnstile_token → set-cookie
POST   /api/auth/login             (anon)  email,password,turnstile_token → set-cookie
POST   /api/auth/logout                    delete auth_session, clear cookie
GET    /api/auth/me                        user profile
PATCH  /api/auth/me                        update display name etc
POST   /api/auth/password                  current_password, new_password → rotates all sessions
DELETE /api/auth/me                        soft-delete account, queue hard-delete job
GET    /api/auth/me/export                 GDPR data dump (JSON)

# Chats (was "sessions" — renamed)
GET    /api/chats?cursor=<lastActive>&limit=30
POST   /api/chats                          {topic, image_key?} → create + start assessment
GET    /api/chats/:id                      chat + messages + assessment + reports (parallel selects)
PATCH  /api/chats/:id                      {title?, status?}
DELETE /api/chats/:id                      soft-delete

POST   /api/chats/:id/answer               {question_id, option_index} → next Q or finish + analysis
POST   /api/chats/:id/chat                 {text, image_key?} → SSE stream
POST   /api/chats/:id/messages/:mid/retry  retry a failed model turn

# Uploads
POST   /api/uploads                        multipart (≤10MB, MIME-validated) → {r2_key}
GET    /api/uploads/:key                   ownership-checked Worker proxy

# Reports
GET    /api/reports?cursor=<created>&limit=30
GET    /api/reports/:id
POST   /api/reports/:id/regenerate         creates new version
POST   /api/reports/:id/pdf                returns PDF (regenerate if missing or stale)

# Dashboard
GET    /api/dashboard                      aggregate counts, recent activity
```

All POST/PATCH/DELETE routes validate body with zod (from `shared/validation.ts`). All errors flow through `lib/errors.ts` `AppError → HTTP`.

## 9. Streaming pattern (`/api/chats/:id/chat`)

```ts
export const POST = async (req) => {
  const ctx = await requireUser(req);
  const { text, image_key } = parseBody(req, ChatSendSchema);
  await assertChatOwnedByUser(ctx, params.id);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamTutorReply(...args, req.signal)) {
          controller.enqueue(sseFrame("delta", event));
        }
        controller.enqueue(sseFrame("done", {}));
      } catch (e) {
        controller.enqueue(sseFrame("error", { message: e.message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
};
```

`streamTutorReply` honours `req.signal` and aborts the upstream `env.AI.run` on client disconnect.

## 10. File structure

```
profai/
├─ wrangler.jsonc
├─ vite.config.ts
├─ package.json
├─ drizzle.config.ts
├─ drizzle/                              # generated SQL migrations
│
├─ app/                                  # vinext (Next.js App Router)
│  ├─ layout.tsx                         # auth-gate wrapper
│  ├─ page.tsx                           # landing (redirects)
│  ├─ login/page.tsx
│  ├─ signup/page.tsx
│  ├─ chat/page.tsx                      # new chat
│  ├─ chat/[id]/page.tsx                 # resume chat
│  ├─ dashboard/page.tsx
│  ├─ reports/page.tsx
│  ├─ reports/[id]/page.tsx
│  ├─ settings/page.tsx
│  └─ api/                               # route handlers (one /route.ts per endpoint)
│     ├─ auth/{signup,login,logout,me,password}/route.ts
│     ├─ auth/me/export/route.ts
│     ├─ chats/route.ts
│     ├─ chats/[id]/route.ts
│     ├─ chats/[id]/answer/route.ts
│     ├─ chats/[id]/chat/route.ts        # SSE
│     ├─ chats/[id]/messages/[mid]/retry/route.ts
│     ├─ uploads/route.ts
│     ├─ uploads/[key]/route.ts
│     ├─ reports/route.ts
│     ├─ reports/[id]/route.ts
│     ├─ reports/[id]/regenerate/route.ts
│     ├─ reports/[id]/pdf/route.ts
│     └─ dashboard/route.ts
│
├─ middleware.ts                         # cookie → ctx.user attach for /api/*
│
├─ components/
│  ├─ chat/{ChatView,Sidebar,MessageBubble,AssessmentBubble,Composer,ImagePreview}.tsx
│  ├─ layout/{AppShell,Header,UserMenu}.tsx
│  ├─ markdown/MarkdownRenderer.tsx
│  └─ ui/                                # shadcn primitives, copy-pasted
│
├─ lib/
│  ├─ ai/                                # see §5.2
│  │  ├─ index.ts
│  │  ├─ client.ts
│  │  ├─ stream.ts
│  │  ├─ tools.ts
│  │  └─ prompts/{assessment,tutor,title}.ts
│  ├─ auth/
│  │  ├─ password.ts                     # scrypt hash + verify
│  │  ├─ session.ts                      # token mint, cookie helpers, D1 ops
│  │  └─ require.ts                      # requireUser(req), requireOwner
│  ├─ db/
│  │  ├─ schema.ts                       # drizzle table defs
│  │  ├─ client.ts                       # drizzle(env.DB)
│  │  └─ queries/{auth,chats,messages,reports,dashboard,audit}.ts
│  ├─ r2.ts                              # put, get, delete; ownership-checked proxy
│  ├─ pdf.ts                             # Browser Rendering wrapper
│  ├─ env.ts                             # zod-validated env binding shape
│  ├─ log.ts                             # structured JSON logger w/ request id
│  ├─ errors.ts                          # AppError, codes, http mapping
│  ├─ rate.ts                            # rate-limit helpers
│  └─ csrf.ts                            # origin check
│
├─ shared/
│  └─ validation.ts                      # zod schemas, dep-free (importable client+server)
│
└─ tests/
   ├─ unit/                              # vitest, no Workers env
   ├─ integration/                       # vitest-pool-workers (miniflare bindings)
   └─ e2e/profai.spec.ts                 # one playwright smoke
```

**Hard rule:** no file > 300 lines. If a file approaches the limit, split it.

## 11. UX surfacing of system behaviour

- **Login page:** Sessions are 30-day sliding by default (no toggle in v2). Inline microcopy: "We'll keep you signed in for 30 days. The session refreshes every time you use ProfAI."
- **Sidebar items:** show "Last active 2h ago" relative timestamp, lazy-load.
- **Header (logged in):** user menu shows email, "Settings", "Logout".
- **Settings page:** change password, delete account, download my data (GDPR).
- **Failed-login throttle:** explicit "Too many attempts, try again in 5 minutes."
- **Account-delete confirmation:** modal with explicit "type your email" pattern.
- **Password-reset email** is **not in scope for v2** — surfaced in the password page as "Forgot password? Contact support" placeholder until v3.

## 12. Testing strategy

- **Unit (`tests/unit/`):** scrypt round-trip, cookie parsing, validation schemas, prompt builders, AI stream parsing, rate-limit math.
- **Component (`tests/component/`, vitest + React Testing Library):** `AssessmentBubble` (option click → callback, disabled-after-answer state), `Composer` (paste image, drag-drop, submit-on-enter), `MarkdownRenderer` (math, code fences, link rewriting).
- **Integration (`tests/integration/`, `@cloudflare/vitest-pool-workers`):** auth happy/sad paths, chat creation → assessment → reply flow, uploads + ownership, R2 proxy 403/200, rate limiting trips at the right counts. Real D1+KV+R2 via miniflare.
- **e2e (`tests/e2e/`, playwright):** signup → start a topic → answer assessment → receive a tutoring reply → save report → log out → log in → resume chat. Single smoke; runs against `wrangler dev`.
- **CI:** lint → typecheck → unit → component → integration → migrations apply --remote (preview DB) → e2e.

## 13. Migration plan from v1

1. Stand up `profai-v2/` alongside v1 (this design lives at `docs/superpowers/specs/`).
2. v1 stays running; v2 is built from scratch — no incremental refactor (the existing 700 LOC is small enough that rewrite < port).
3. Existing `migrated_prompt_history/` directory contents are copied to `lib/ai/prompts/legacy/` for reference, not used at runtime.
4. Cut over by changing the deployment target. v1 has no users, so no data migration needed.

## 14. Risks & open questions

| Risk | Mitigation |
|---|---|
| vinext blocks production | §3.1 fallback to Hono+Vite SPA, business logic in `lib/` is unaffected |
| Gemini cost spikes on long sessions | §5.1 truncate+summarise above thresholds; budget alerts via CF dashboard |
| Workers CPU cap on scrypt | Benchmark in dev; if > 200ms, lower scrypt N or use PBKDF2-600k |
| Browser Rendering binding limits | If PDF gen fails / queues, defer PDF as a "request a copy" with email when ready (v3) |
| Prompt injection from uploaded images | Tool-calls only triggered by validated function-call schema, not free-text in model output; sanitise before D1 |
| KV/D1 jurisdictional defaults | EU residency not requested; defaults are fine for now |

**Open questions for user (review gate):** none blocking — design is internally consistent. Ready for plan-writing once approved.

## 15. Acceptance criteria

The rewrite is "done" when:

- [ ] A new user can sign up, complete a tutoring chat (topic → quiz → tutoring → diagram), see a saved report, log out, log back in, and resume the same chat.
- [ ] All API routes return zod-validated responses; all error paths route through `AppError`.
- [ ] All R2 access is ownership-checked.
- [ ] No AI keys are present in the client bundle (verified by inspecting built JS).
- [ ] CI is green: lint, typecheck, vitest unit + integration, playwright smoke.
- [ ] `wrangler deploy` deploys the full Worker; the URL serves the SPA, login works, chat streams, PDFs generate.
- [ ] No file in `lib/`, `app/`, or `components/` exceeds 300 lines.
- [ ] All §11 UX surfacing is present.

---

*End of design.*
