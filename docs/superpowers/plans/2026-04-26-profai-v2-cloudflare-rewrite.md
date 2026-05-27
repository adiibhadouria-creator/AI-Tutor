# ProfAI v2 — Cloudflare-Native Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the existing in-browser Gemini SPA into a production-grade Cloudflare-native AI tutoring app with auth, persistent multi-chat history, saved reports with PDF export, and a progress dashboard.

**Architecture:** Single Cloudflare Worker. Frontend = vinext (Cloudflare's Vite-plugin reimplementation of the Next.js 16 API surface). Backend = `app/api/*` route handlers in the same Worker. Bindings = D1 (relational data), R2 (uploads + PDFs), KV (reserved for future cache), Workers AI (Gemini 3 Flash + Flux Schnell), Browser Rendering (PDF), Workers Rate Limiting API.

**Tech Stack:** TypeScript (strict), vinext, Tailwind CSS, shadcn/ui, drizzle-orm, zod, `@noble/hashes` scrypt, Web Crypto AES-GCM, react-markdown + remark-math + rehype-katex, vitest + `@cloudflare/vitest-pool-workers`, playwright.

**Spec:** [`docs/superpowers/specs/2026-04-26-profai-v2-cloudflare-rewrite-design.md`](../specs/2026-04-26-profai-v2-cloudflare-rewrite-design.md)

**Working directory note:** This plan rewrites the project in place. The existing `App.tsx`, `index.tsx`, `index.html`, `components/`, `services/`, `vite.config.ts`, `package.json`, `tsconfig.json`, and `metadata.json` will be deleted in Phase 0. The new app is scaffolded into the same directory.

---

## Conventions used in this plan

- **File paths** are absolute relative to the repo root (`/Users/anurag/bubbble/kalash/prof-ai/`).
- **Commands** assume the repo root as `cwd` unless stated otherwise.
- **Commits** use Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`, `docs:`).
- **Verification:** every step ends with a check (test run, command output, or visual confirmation). If the check fails, stop and diagnose — do not proceed to the next step.
- **TDD where applicable:** pure-function tasks write the test first. UI/scaffolding tasks write the code, then verify with a build/lint/manual check.

---

## Phase index

| # | Phase | Tasks |
|---|---|---|
| 0 | Repository scaffold | 1–7 |
| 1 | Core lib foundations | 8–11 |
| 2 | Database layer | 12–15 |
| 3 | Auth foundation | 16–19 |
| 4 | Auth API | 20–25 |
| 5 | UI shell + auth pages | 26–29 |
| 6 | R2 + uploads | 30–32 |
| 7 | AI module | 33–39 |
| 8 | Chats lifecycle (no streaming) | 40–46 |
| 9 | Chat streaming | 47–49 |
| 10 | Chat UI | 50–56 |
| 11 | Reports + PDF | 57–63 |
| 12 | Dashboard | 64–65 |
| 13 | Account settings + GDPR | 66–70 |
| 14 | Cleanup, e2e, CI, deploy | 71–76 |

## Phase 0 — Repository scaffold

### Task 1: Snapshot v1, then delete v1 sources

Goal: clean slate to scaffold v2 in place. Keep `migrated_prompt_history/`, `README.md`, and `.git/` (if present) — delete everything else.

**Files:**
- Delete: `App.tsx`, `index.tsx`, `index.html`, `vite.config.ts`, `package.json`, `tsconfig.json`, `metadata.json`, `components/`, `services/`

- [ ] **Step 1: List current files for the record**

```bash
ls -la
```

Expected: see the v1 files listed above plus `migrated_prompt_history/`, `README.md`, `docs/`.

- [ ] **Step 2: Initialize git if not already a repo**

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || git init
git add -A && git commit -m "chore: snapshot v1 before rewrite" || true
```

Expected: a commit recording v1 state, OR a no-op if there's nothing to commit.

- [ ] **Step 3: Delete v1 application code**

```bash
rm -f App.tsx index.tsx index.html vite.config.ts package.json tsconfig.json metadata.json
rm -rf components services
```

- [ ] **Step 4: Confirm only the keepers remain**

```bash
ls -la
```

Expected: `docs/`, `migrated_prompt_history/`, `README.md`, `.git/` only (no `node_modules/`, no `.tsx`, no `package.json`).

- [ ] **Step 5: Commit the deletion**

```bash
git add -A
git commit -m "chore: remove v1 sources for rewrite"
```

---

### Task 2: Initialize vinext + Vite project

Goal: create the v2 skeleton with vinext, Vite, React 19, and TypeScript strict.

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`

- [ ] **Step 1: Create `package.json`**

```bash
cat > package.json <<'EOF'
{
  "name": "profai",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vinext dev",
    "build": "vinext build",
    "preview": "wrangler dev",
    "deploy": "vinext build && wrangler deploy",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply profai_db --local",
    "db:migrate:remote": "wrangler d1 migrations apply profai_db --remote"
  }
}
EOF
```

- [ ] **Step 2: Install dependencies**

```bash
npm install \
  react@^19.2.1 react-dom@^19.2.1 \
  vinext@latest vite@^7 @vitejs/plugin-react@^5 @vitejs/plugin-rsc \
  react-markdown@9 remark-math@6 rehype-katex@7 remark-gfm@4 \
  zod \
  drizzle-orm \
  @noble/hashes \
  ulid \
  exifr

npm install -D \
  typescript@~5.8 \
  @types/node@^22 @types/react@^19 @types/react-dom@^19 \
  wrangler@latest @cloudflare/workers-types \
  drizzle-kit \
  vitest @vitest/ui \
  @cloudflare/vitest-pool-workers \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom \
  @playwright/test \
  eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  prettier eslint-config-prettier \
  tailwindcss postcss autoprefixer \
  @tailwindcss/typography
```

Expected: completes without peer-dep ERROR (warnings OK).

- [ ] **Step 3: Create `tsconfig.json` with strict mode**

```bash
cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "types": ["vite/client", "@cloudflare/workers-types"],
    "paths": {
      "@/*": ["./*"],
      "@shared/*": ["./shared/*"]
    }
  },
  "include": ["app", "components", "lib", "shared", "middleware.ts", "tests"],
  "exclude": ["node_modules", "dist", ".wrangler"]
}
EOF
```

- [ ] **Step 4: Create `vite.config.ts`**

```bash
cat > vite.config.ts <<'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import vinext from "vinext/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), rsc(), vinext()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  server: {
    port: 3000,
  },
});
EOF
```

- [ ] **Step 5: Verify typecheck passes on the empty project**

```bash
npm run typecheck
```

Expected: no errors. (There's nothing to typecheck yet, so it's a successful no-op.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold vinext + vite + ts strict"
```

---

### Task 3: Configure `wrangler.jsonc` with all bindings

Goal: declare every Cloudflare resource the app uses. IDs are placeholders that the deployer fills in via `wrangler d1 create`, `wrangler r2 bucket create`, `wrangler kv namespace create` later.

**Files:**
- Create: `wrangler.jsonc`, `.dev.vars.example`, `.gitignore`

- [ ] **Step 1: Write `wrangler.jsonc`**

```bash
cat > wrangler.jsonc <<'EOF'
{
  "$schema": "https://unpkg.com/wrangler@latest/config-schema.json",
  "name": "profai",
  "main": ".vinext/worker.js",
  "compatibility_date": "2026-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".vinext/static",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "observability": { "enabled": true },
  "vars": {
    "APP_ORIGIN": "http://localhost:3000"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "profai_db",
      "database_id": "REPLACE_ME_AFTER_CREATE",
      "migrations_dir": "drizzle"
    }
  ],
  "kv_namespaces": [
    { "binding": "KV", "id": "REPLACE_ME_AFTER_CREATE" }
  ],
  "r2_buckets": [
    { "binding": "R2", "bucket_name": "profai-uploads" }
  ],
  "ai": { "binding": "AI" },
  "browser": { "binding": "BROWSER" },
  "ratelimits": [
    { "name": "RATE_LIMITER_AUTH", "namespace_id": "1001", "simple": { "limit": 10, "period": 60 } },
    { "name": "RATE_LIMITER_SIGNUP", "namespace_id": "1002", "simple": { "limit": 2, "period": 60 } },
    { "name": "RATE_LIMITER_CHAT",  "namespace_id": "1003", "simple": { "limit": 60, "period": 60 } },
    { "name": "RATE_LIMITER_UPLOAD","namespace_id": "1004", "simple": { "limit": 6, "period": 60 } },
    { "name": "RATE_LIMITER_PDF",   "namespace_id": "1005", "simple": { "limit": 2, "period": 60 } }
  ]
}
EOF
```

- [ ] **Step 2: Write `.dev.vars.example`**

```bash
cat > .dev.vars.example <<'EOF'
# Copy to .dev.vars for local dev. Never commit .dev.vars.

# AES-GCM key for at-rest message encryption. 32 bytes, base64.
# Generate with: openssl rand -base64 32
CONTENT_KEY=

# Salt used when hashing client IPs into ip_hash. Any random string.
IP_HASH_SALT=

# Cloudflare Turnstile (optional in dev — leave empty to bypass).
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# AI Gateway: Google AI Studio API key for Gemini 3 Flash routed via env.AI.
# Required for tutoring/assessment. Stored as Worker secret in prod.
AI_GATEWAY_GOOGLE_API_KEY=
EOF
```

- [ ] **Step 3: Write `.gitignore`**

```bash
cat > .gitignore <<'EOF'
node_modules/
dist/
.vinext/
.wrangler/
.dev.vars
.env
.env.local
*.log
.DS_Store
playwright-report/
test-results/
coverage/
EOF
```

- [ ] **Step 4: Verify wrangler reads the config**

```bash
npx wrangler types
```

Expected: prints generated `worker-configuration.d.ts` types based on bindings, no schema errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: declare wrangler bindings (D1, R2, KV, AI, Browser, RateLimiters)"
```

---

### Task 4: Configure Tailwind + shadcn baseline

Goal: replace v1's CDN-script Tailwind with locally built CSS, plus set up shadcn/ui's `cn()` helper for component primitives.

**Files:**
- Create: `tailwind.config.ts`, `postcss.config.js`, `app/globals.css`, `lib/cn.ts`, `components.json`

- [ ] **Step 1: Write `tailwind.config.ts`**

```bash
cat > tailwind.config.ts <<'EOF'
import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./shared/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#4F46E5",
          foreground: "#ffffff",
        },
        secondary: { DEFAULT: "#0EA5E9" },
        dark: "#0F172A",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config;
EOF
```

- [ ] **Step 2: Write `postcss.config.js`**

```bash
cat > postcss.config.js <<'EOF'
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
EOF
```

- [ ] **Step 3: Write `app/globals.css`**

```bash
mkdir -p app
cat > app/globals.css <<'EOF'
@import "katex/dist/katex.min.css";
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body { font-family: theme(fontFamily.sans); }
  body { @apply bg-slate-50 text-slate-900 antialiased; }
}

@layer utilities {
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
}

.markdown-content p { @apply mb-3 last:mb-0; }
.markdown-content ul { @apply list-disc pl-6 mb-3; }
.markdown-content ol { @apply list-decimal pl-6 mb-3; }
.markdown-content li { @apply mb-1; }
.markdown-content pre { @apply bg-slate-100 p-3 rounded-lg overflow-x-auto mb-3; }
.markdown-content code { @apply bg-slate-100 px-1 rounded text-sm; }
.markdown-content pre code { @apply bg-transparent p-0; }
.markdown-content blockquote { @apply border-l-4 border-slate-200 pl-4 text-slate-600 mb-3; }
.markdown-content .katex-display { @apply my-3 overflow-x-auto; }
EOF
```

- [ ] **Step 4: Install katex CSS dep**

```bash
npm install katex
```

- [ ] **Step 5: Write `lib/cn.ts` (shadcn helper)**

```bash
mkdir -p lib
cat > lib/cn.ts <<'EOF'
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
EOF
npm install clsx tailwind-merge
```

- [ ] **Step 6: Write `components.json` for shadcn CLI**

```bash
cat > components.json <<'EOF'
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": false,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/cn",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/components/hooks"
  }
}
EOF
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: configure tailwind, postcss, shadcn baseline"
```

---

### Task 5: Configure ESLint + Prettier

**Files:**
- Create: `.eslintrc.cjs`, `.prettierrc.json`, `.prettierignore`

- [ ] **Step 1: Write `.eslintrc.cjs`**

```bash
cat > .eslintrc.cjs <<'EOF'
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  env: { browser: true, node: true, es2022: true },
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": "error",
    "no-console": ["warn", { allow: ["warn", "error"] }]
  },
  ignorePatterns: ["dist", ".vinext", ".wrangler", "node_modules", "drizzle/*.sql"]
};
EOF
```

- [ ] **Step 2: Write `.prettierrc.json`**

```bash
cat > .prettierrc.json <<'EOF'
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
EOF
```

- [ ] **Step 3: Write `.prettierignore`**

```bash
cat > .prettierignore <<'EOF'
node_modules
dist
.vinext
.wrangler
drizzle/*.sql
package-lock.json
EOF
```

- [ ] **Step 4: Verify lint runs cleanly on empty project**

```bash
npx eslint . --max-warnings=0
```

Expected: exits 0 (nothing to lint yet).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: eslint + prettier config"
```

---

### Task 6: Configure vitest (unit + integration)

**Files:**
- Create: `vitest.config.ts`, `vitest.integration.config.ts`, `tests/unit/.gitkeep`, `tests/integration/.gitkeep`, `tests/e2e/.gitkeep`

- [ ] **Step 1: Write `vitest.config.ts` (unit)**

```bash
cat > vitest.config.ts <<'EOF'
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.test.ts", "tests/component/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
EOF
```

- [ ] **Step 2: Write `vitest.integration.config.ts`**

```bash
cat > vitest.integration.config.ts <<'EOF'
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          compatibilityFlags: ["nodejs_compat"],
        },
      },
    },
  },
});
EOF
```

- [ ] **Step 3: Write `tests/setup.ts`**

```bash
mkdir -p tests/unit tests/integration tests/component tests/e2e
cat > tests/setup.ts <<'EOF'
import "@testing-library/jest-dom/vitest";
EOF
touch tests/unit/.gitkeep tests/integration/.gitkeep tests/component/.gitkeep tests/e2e/.gitkeep
```

- [ ] **Step 4: Verify vitest dry-run**

```bash
npm test
```

Expected: "No test files found" (we haven't written any yet) — exit code 0 OR 1 with that message; either is acceptable here. If it fails for any other reason (missing dep), fix.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: configure vitest (unit + integration)"
```

---

### Task 7: Initial app entry + smoke page

Goal: prove the vinext + Vite + Tailwind pipeline produces a working page before adding any business logic.

**Files:**
- Create: `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Write `app/layout.tsx`**

```bash
cat > app/layout.tsx <<'EOF'
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "ProfAI — Adaptive Tutor",
  description: "Personalised AI tutoring on Cloudflare.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
EOF
```

- [ ] **Step 2: Write `app/page.tsx`**

```bash
cat > app/page.tsx <<'EOF'
export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold text-primary">ProfAI v2</h1>
        <p className="text-slate-600">Cloudflare-native rewrite — scaffold up.</p>
      </div>
    </main>
  );
}
EOF
```

- [ ] **Step 3: Run dev server and visually confirm**

```bash
npm run dev
```

Expected: server starts on http://localhost:3000. Open it in a browser. You should see "ProfAI v2" centred on a slate-50 background with the heading in indigo.

- [ ] **Step 4: Stop the dev server (Ctrl-C) and run typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: both pass with no output.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: initial vinext app entry with smoke page"
```

## Phase 1 — Core lib foundations

### Task 8: `lib/env.ts` — zod-validated bindings

Goal: a single typed handle on `env` so every consumer gets compile-time and runtime safety.

**Files:**
- Create: `lib/env.ts`, `tests/unit/env.test.ts`

- [ ] **Step 1: Write the failing test**

```bash
cat > tests/unit/env.test.ts <<'EOF'
import { describe, it, expect } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("accepts a fully populated env", () => {
    const env = {
      APP_ORIGIN: "http://localhost:3000",
      CONTENT_KEY: "a".repeat(44),
      IP_HASH_SALT: "salt",
      AI_GATEWAY_GOOGLE_API_KEY: "k",
      DB: {} as D1Database,
      KV: {} as KVNamespace,
      R2: {} as R2Bucket,
      AI: {} as Ai,
      BROWSER: {} as Fetcher,
      RATE_LIMITER_AUTH: {} as RateLimit,
      RATE_LIMITER_SIGNUP: {} as RateLimit,
      RATE_LIMITER_CHAT: {} as RateLimit,
      RATE_LIMITER_UPLOAD: {} as RateLimit,
      RATE_LIMITER_PDF: {} as RateLimit,
    };
    expect(() => parseEnv(env)).not.toThrow();
  });

  it("throws if APP_ORIGIN is missing", () => {
    expect(() => parseEnv({} as never)).toThrow(/APP_ORIGIN/);
  });
});
EOF
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/unit/env.test.ts
```

Expected: FAIL — module `@/lib/env` not found.

- [ ] **Step 3: Implement `lib/env.ts`**

```bash
cat > lib/env.ts <<'EOF'
import { z } from "zod";

const EnvSchema = z.object({
  APP_ORIGIN: z.string().url(),
  CONTENT_KEY: z.string().min(40, "CONTENT_KEY must be base64-encoded 32 bytes"),
  IP_HASH_SALT: z.string().min(8),
  AI_GATEWAY_GOOGLE_API_KEY: z.string().min(1),
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema> & {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  AI: Ai;
  BROWSER: Fetcher;
  RATE_LIMITER_AUTH: RateLimit;
  RATE_LIMITER_SIGNUP: RateLimit;
  RATE_LIMITER_CHAT: RateLimit;
  RATE_LIMITER_UPLOAD: RateLimit;
  RATE_LIMITER_PDF: RateLimit;
};

export function parseEnv(env: unknown): AppEnv {
  const e = env as Record<string, unknown>;
  const parsed = EnvSchema.parse({
    APP_ORIGIN: e.APP_ORIGIN,
    CONTENT_KEY: e.CONTENT_KEY,
    IP_HASH_SALT: e.IP_HASH_SALT,
    AI_GATEWAY_GOOGLE_API_KEY: e.AI_GATEWAY_GOOGLE_API_KEY,
    TURNSTILE_SITE_KEY: e.TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY: e.TURNSTILE_SECRET_KEY,
  });
  return { ...parsed, ...(e as Pick<AppEnv, "DB" | "KV" | "R2" | "AI" | "BROWSER" | "RATE_LIMITER_AUTH" | "RATE_LIMITER_SIGNUP" | "RATE_LIMITER_CHAT" | "RATE_LIMITER_UPLOAD" | "RATE_LIMITER_PDF">) };
}
EOF
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/unit/env.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(env): zod-validated env bindings parser"
```

---

### Task 9: `lib/errors.ts` — typed errors with HTTP mapping

**Files:**
- Create: `lib/errors.ts`, `tests/unit/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```bash
cat > tests/unit/errors.test.ts <<'EOF'
import { describe, it, expect } from "vitest";
import { AppError, errorToResponse } from "@/lib/errors";

describe("AppError", () => {
  it("maps NOT_FOUND to 404", () => {
    const res = errorToResponse(new AppError("NOT_FOUND", "missing"));
    expect(res.status).toBe(404);
  });

  it("maps UNAUTHORIZED to 401", () => {
    const res = errorToResponse(new AppError("UNAUTHORIZED", "no auth"));
    expect(res.status).toBe(401);
  });

  it("maps unknown error to 500 without leaking message", async () => {
    const res = errorToResponse(new Error("internal stack trace"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: { code: "INTERNAL", message: "Internal error" } });
  });

  it("includes structured body for AppError", async () => {
    const res = errorToResponse(new AppError("VALIDATION", "bad input", { field: "email" }));
    const body = await res.json();
    expect(body).toEqual({ error: { code: "VALIDATION", message: "bad input", details: { field: "email" } } });
  });
});
EOF
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
npm test -- tests/unit/errors.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/errors.ts`**

```bash
cat > lib/errors.ts <<'EOF'
export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA"
  | "UPSTREAM"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  RATE_LIMITED: 429,
  UPSTREAM: 502,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function errorToResponse(err: unknown): Response {
  if (err instanceof AppError) {
    const body = err.details === undefined
      ? { error: { code: err.code, message: err.message } }
      : { error: { code: err.code, message: err.message, details: err.details } };
    return Response.json(body, { status: STATUS[err.code] });
  }
  return Response.json(
    { error: { code: "INTERNAL", message: "Internal error" } },
    { status: 500 },
  );
}
EOF
```

- [ ] **Step 4: Run the test — verify it passes**

```bash
npm test -- tests/unit/errors.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(errors): typed AppError with HTTP mapping"
```

---

### Task 10: `lib/log.ts` — structured logger with request id

**Files:**
- Create: `lib/log.ts`, `tests/unit/log.test.ts`

- [ ] **Step 1: Write the failing test**

```bash
cat > tests/unit/log.test.ts <<'EOF'
import { describe, it, expect, vi } from "vitest";
import { createLogger } from "@/lib/log";

describe("createLogger", () => {
  it("emits JSON with the request id and level", () => {
    const sink = vi.fn();
    const log = createLogger({ requestId: "req_abc", sink });
    log.info("hello", { foo: 1 });
    expect(sink).toHaveBeenCalledOnce();
    const arg = sink.mock.calls[0]![0]!;
    const parsed = JSON.parse(arg);
    expect(parsed).toMatchObject({ level: "info", msg: "hello", requestId: "req_abc", foo: 1 });
    expect(typeof parsed.ts).toBe("number");
  });

  it("warn and error levels work", () => {
    const sink = vi.fn();
    const log = createLogger({ requestId: "r", sink });
    log.warn("w");
    log.error("e", { code: "X" });
    expect(sink).toHaveBeenCalledTimes(2);
    expect(JSON.parse(sink.mock.calls[0]![0]!).level).toBe("warn");
    expect(JSON.parse(sink.mock.calls[1]![0]!).level).toBe("error");
  });
});
EOF
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- tests/unit/log.test.ts
```

- [ ] **Step 3: Implement `lib/log.ts`**

```bash
cat > lib/log.ts <<'EOF'
type Level = "debug" | "info" | "warn" | "error";
type Sink = (line: string) => void;
export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export function createLogger(opts: { requestId: string; sink?: Sink }): Logger {
  const sink = opts.sink ?? ((line) => { console.log(line); });
  const emit = (level: Level, msg: string, fields?: Record<string, unknown>): void => {
    const line = JSON.stringify({ ts: Date.now(), level, msg, requestId: opts.requestId, ...fields });
    sink(line);
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info:  (m, f) => emit("info", m, f),
    warn:  (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
  };
}

export function newRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return "req_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
EOF
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- tests/unit/log.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(log): structured JSON logger with request id"
```

---

### Task 11: `shared/validation.ts` — zod schemas (initial set)

Goal: dep-free zod schemas usable from client AND server. We'll grow this file as we add features.

**Files:**
- Create: `shared/validation.ts`, `tests/unit/validation.test.ts`

- [ ] **Step 1: Write the failing test**

```bash
cat > tests/unit/validation.test.ts <<'EOF'
import { describe, it, expect } from "vitest";
import { SignupSchema, LoginSchema, ChatCreateSchema } from "@shared/validation";

describe("SignupSchema", () => {
  it("rejects short passwords", () => {
    const r = SignupSchema.safeParse({ email: "a@b.com", password: "short", turnstile_token: "t" });
    expect(r.success).toBe(false);
  });
  it("accepts a valid signup", () => {
    const r = SignupSchema.safeParse({ email: "a@b.com", password: "longenough12", turnstile_token: "t" });
    expect(r.success).toBe(true);
  });
});

describe("LoginSchema", () => {
  it("requires email format", () => {
    const r = LoginSchema.safeParse({ email: "not-email", password: "x", turnstile_token: "t" });
    expect(r.success).toBe(false);
  });
});

describe("ChatCreateSchema", () => {
  it("requires non-empty topic", () => {
    expect(ChatCreateSchema.safeParse({ topic: "" }).success).toBe(false);
    expect(ChatCreateSchema.safeParse({ topic: "Physics" }).success).toBe(true);
  });
  it("accepts optional image_key", () => {
    expect(ChatCreateSchema.safeParse({ topic: "Math", image_key: "uploads/u/abc.png" }).success).toBe(true);
  });
});
EOF
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- tests/unit/validation.test.ts
```

- [ ] **Step 3: Implement `shared/validation.ts`**

```bash
mkdir -p shared
cat > shared/validation.ts <<'EOF'
import { z } from "zod";

const Email = z.string().email().max(254).transform((s) => s.toLowerCase());
const Password = z.string().min(10).max(256);
const Turnstile = z.string().min(1).max(2048);

export const SignupSchema = z.object({
  email: Email,
  password: Password,
  turnstile_token: Turnstile,
});
export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: Email,
  password: z.string().min(1).max(256),
  turnstile_token: Turnstile,
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const PasswordChangeSchema = z.object({
  current_password: z.string().min(1).max(256),
  new_password: Password,
});

export const ProfileUpdateSchema = z.object({
  display_name: z.string().min(1).max(80).optional(),
});

export const ChatCreateSchema = z.object({
  topic: z.string().min(1).max(500),
  image_key: z.string().max(256).optional(),
});
export type ChatCreateInput = z.infer<typeof ChatCreateSchema>;

export const ChatPatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  status: z.enum(["active", "completed", "abandoned"]).optional(),
});

export const ChatSendSchema = z.object({
  text: z.string().min(0).max(8000),
  image_key: z.string().max(256).optional(),
}).refine((v) => v.text.trim().length > 0 || v.image_key !== undefined, {
  message: "text or image_key required",
});

export const AssessmentAnswerSchema = z.object({
  question_id: z.number().int().nonnegative(),
  option_index: z.number().int().nonnegative().max(10),
});

export const ReportRegenerateSchema = z.object({
  kind: z.enum(["assessment", "progress", "completion"]),
});

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
EOF
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- tests/unit/validation.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(shared): zod schemas for auth and chat inputs"
```

## Phase 2 — Database layer

### Task 12: Drizzle schema (`lib/db/schema.ts`)

**Files:**
- Create: `lib/db/schema.ts`, `drizzle.config.ts`

- [ ] **Step 1: Write `drizzle.config.ts`**

```bash
cat > drizzle.config.ts <<'EOF'
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http",
} satisfies Config;
EOF
```

- [ ] **Step 2: Write `lib/db/schema.ts`**

```bash
mkdir -p lib/db
cat > lib/db/schema.ts <<'EOF'
import { sqliteTable, text, integer, blob, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  createdAt: integer("created_at").notNull(),
  lastLoginAt: integer("last_login_at"),
  deletedAt: integer("deleted_at"),
}, (t) => ({
  emailUq: uniqueIndex("idx_users_email_nocase").on(t.email),
}));

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
}, (t) => ({
  userIdx: index("idx_auth_sessions_user").on(t.userId),
  expiresIdx: index("idx_auth_sessions_expires").on(t.expiresAt),
}));

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  level: text("level"),
  status: text("status").notNull().default("active"),
  title: text("title"),
  rollingSummary: text("rolling_summary"),
  startedAt: integer("started_at").notNull(),
  lastActiveAt: integer("last_active_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (t) => ({
  userActiveIdx: index("idx_chats_user_active").on(t.userId, t.lastActiveAt),
}));

export const assessments = sqliteTable("assessments", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  questionsJson: text("questions_json").notNull(),
  answersJson: text("answers_json"),
  score: integer("score"),
  summary: text("summary"),
  recommendedPath: text("recommended_path"),
  completedAt: integer("completed_at"),
}, (t) => ({
  chatUq: uniqueIndex("idx_assessments_chat").on(t.chatId),
}));

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  contentCiphertext: blob("content_ciphertext", { mode: "buffer" }).notNull(),
  contentIv: blob("content_iv", { mode: "buffer" }).notNull(),
  imageR2Key: text("image_r2_key"),
  isDiagram: integer("is_diagram").notNull().default(0),
  createdAt: integer("created_at").notNull(),
}, (t) => ({
  chatCreatedIdx: index("idx_messages_chat_created").on(t.chatId, t.createdAt),
}));

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  version: integer("version").notNull().default(1),
  title: text("title").notNull(),
  contentMd: text("content_md").notNull(),
  pdfR2Key: text("pdf_r2_key"),
  createdAt: integer("created_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (t) => ({
  userCreatedIdx: index("idx_reports_user_created").on(t.userId, t.createdAt),
  chatIdx: index("idx_reports_chat").on(t.chatId, t.createdAt),
}));

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  event: text("event").notNull(),
  metaJson: text("meta_json"),
  createdAt: integer("created_at").notNull(),
  ipHash: text("ip_hash"),
}, (t) => ({
  userCreatedIdx: index("idx_audit_user_created").on(t.userId, t.createdAt),
}));
EOF
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): drizzle schema for users, sessions, chats, messages, reports, audit"
```

---

### Task 13: Generate the initial SQL migration

Goal: produce `drizzle/0000_*.sql`. Drizzle generates without `COLLATE NOCASE`, so we'll patch the migration manually to enforce case-insensitive email uniqueness.

**Files:**
- Create: `drizzle/0000_init.sql` (generated, then edited)

- [ ] **Step 1: Run drizzle generator**

```bash
npm run db:generate
```

Expected: a file like `drizzle/0000_*.sql` is created. Note the exact filename.

- [ ] **Step 2: Inspect the generated SQL**

```bash
ls drizzle/
cat drizzle/0000_*.sql
```

- [ ] **Step 3: Patch the email index to be case-insensitive**

Open the generated migration. Replace the line that creates `idx_users_email_nocase` so the SQL reads:

```sql
CREATE UNIQUE INDEX `idx_users_email_nocase` ON `users` (`email` COLLATE NOCASE);
```

Use a sed in-place edit (macOS form):

```bash
sed -i '' 's|ON `users` (`email`)|ON `users` (`email` COLLATE NOCASE)|' drizzle/0000_*.sql
```

Then verify:

```bash
grep "COLLATE NOCASE" drizzle/0000_*.sql
```

Expected: one matching line.

- [ ] **Step 4: Create the local D1 database**

```bash
npx wrangler d1 create profai_db
```

Expected: prints a database name and a UUID. **Copy the UUID** and paste it into `wrangler.jsonc` replacing `"REPLACE_ME_AFTER_CREATE"` for `database_id`.

- [ ] **Step 5: Apply migrations locally**

```bash
npm run db:migrate:local
```

Expected: migration applied. Verify with:

```bash
npx wrangler d1 execute profai_db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Expected output includes: `users`, `auth_sessions`, `chats`, `assessments`, `messages`, `reports`, `audit_log`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): generate initial migration with case-insensitive email index"
```

---

### Task 14: Create KV namespace + R2 bucket for local dev

Goal: provision the remaining bindings so dev mode boots without binding errors.

- [ ] **Step 1: Create the KV namespace**

```bash
npx wrangler kv namespace create profai_kv
```

Expected: prints an `id`. Paste it into `wrangler.jsonc` replacing the KV `"REPLACE_ME_AFTER_CREATE"`.

- [ ] **Step 2: Create the R2 bucket**

```bash
npx wrangler r2 bucket create profai-uploads
```

Expected: bucket created. (The wrangler config already references `profai-uploads` by name.)

- [ ] **Step 3: Generate `worker-configuration.d.ts`**

```bash
npx wrangler types
```

Expected: writes `worker-configuration.d.ts` with all bindings typed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(infra): provision KV + R2 + types"
```

---

### Task 15: `lib/db/client.ts` — drizzle bound to D1

**Files:**
- Create: `lib/db/client.ts`

- [ ] **Step 1: Write `lib/db/client.ts`**

```bash
cat > lib/db/client.ts <<'EOF'
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import type { AppEnv } from "@/lib/env";

export type DB = ReturnType<typeof drizzle<typeof schema>>;

export function db(env: Pick<AppEnv, "DB">): DB {
  return drizzle(env.DB, { schema });
}

export { schema };
EOF
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(db): drizzle D1 client factory"
```

## Phase 3 — Auth foundation

### Task 16: `lib/auth/password.ts` — scrypt hash + verify

**Files:**
- Create: `lib/auth/password.ts`, `tests/unit/password.test.ts`

- [ ] **Step 1: Write the failing test**

```bash
cat > tests/unit/password.test.ts <<'EOF'
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("round-trips", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const a = await hashPassword("secret123456");
    const b = await hashPassword("secret123456");
    expect(a).not.toEqual(b);
    expect(await verifyPassword("secret123456", a)).toBe(true);
    expect(await verifyPassword("secret123456", b)).toBe(true);
  });
}, { timeout: 30_000 });
EOF
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- tests/unit/password.test.ts
```

- [ ] **Step 3: Implement `lib/auth/password.ts`**

```bash
mkdir -p lib/auth
cat > lib/auth/password.ts <<'EOF'
import { scryptAsync } from "@noble/hashes/scrypt";

const N = 1 << 17;
const r = 8;
const p = 1;
const HASH_LEN = 64;
const SALT_LEN = 16;

const b64 = {
  enc(buf: Uint8Array): string { return btoa(String.fromCharCode(...buf)); },
  dec(s: string): Uint8Array { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); },
};

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_LEN);
  crypto.getRandomValues(salt);
  const hash = await scryptAsync(password, salt, { N, r, p, dkLen: HASH_LEN });
  return `scrypt$${N}$${r}$${p}$${b64.enc(salt)}$${b64.enc(hash)}`;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const Nv = Number(parts[1]); const rv = Number(parts[2]); const pv = Number(parts[3]);
  const salt = b64.dec(parts[4]!); const expected = b64.dec(parts[5]!);
  const hash = await scryptAsync(password, salt, { N: Nv, r: rv, p: pv, dkLen: expected.length });
  return constantTimeEqual(hash, expected);
}
EOF
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- tests/unit/password.test.ts
```

Expected: 2 tests PASS (may take a few seconds — scrypt is intentionally slow).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): scrypt password hash + verify"
```

---

### Task 17: `lib/auth/session.ts` — D1-backed session tokens

**Files:**
- Create: `lib/auth/session.ts`

- [ ] **Step 1: Write `lib/auth/session.ts`**

```bash
cat > lib/auth/session.ts <<'EOF'
import { eq, lt, and } from "drizzle-orm";
import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";

const COOKIE_NAME = "__Host-session";
const SESSION_TTL_SEC = 30 * 24 * 60 * 60;
const RENEW_THRESHOLD_SEC = 7 * 24 * 60 * 60;

export const SESSION_COOKIE = COOKIE_NAME;

export function newSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface IssueOpts {
  userId: string;
  userAgent?: string;
  ipHash?: string;
}

export async function issueSession(db: DB, opts: IssueOpts): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SEC;
  const token = newSessionToken();
  await db.insert(schema.authSessions).values({
    id: token,
    userId: opts.userId,
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
    userAgent: opts.userAgent ?? null,
    ipHash: opts.ipHash ?? null,
  } as typeof schema.authSessions.$inferInsert);
  return { token, expiresAt };
}

export interface SessionLookup {
  userId: string;
  expiresAt: number;
  shouldRenew: boolean;
}

export async function lookupSession(db: DB, token: string): Promise<SessionLookup | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await db.query.authSessions.findFirst({ where: eq(schema.authSessions.id, token) });
  if (!row) return null;
  const now = Math.floor(Date.now() / 1000);
  if (row.expiresAt <= now) return null;
  await db.update(schema.authSessions).set({ lastSeenAt: now }).where(eq(schema.authSessions.id, token));
  const shouldRenew = row.expiresAt - now < RENEW_THRESHOLD_SEC;
  return { userId: row.userId, expiresAt: row.expiresAt, shouldRenew };
}

export async function renewSession(db: DB, token: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const newExpires = now + SESSION_TTL_SEC;
  await db.update(schema.authSessions).set({ expiresAt: newExpires }).where(eq(schema.authSessions.id, token));
  return newExpires;
}

export async function revokeSession(db: DB, token: string): Promise<void> {
  await db.delete(schema.authSessions).where(eq(schema.authSessions.id, token));
}

export async function revokeAllSessions(db: DB, userId: string): Promise<void> {
  await db.delete(schema.authSessions).where(eq(schema.authSessions.userId, userId));
}

export async function purgeExpired(db: DB): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.delete(schema.authSessions).where(lt(schema.authSessions.expiresAt, now));
}

export function buildSessionCookie(token: string, maxAgeSec = SESSION_TTL_SEC): string {
  return `${COOKIE_NAME}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSessionCookie(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE_NAME) return rest.join("=");
  }
  return null;
}

const _unused = and; void _unused;
EOF
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(auth): D1-backed session tokens with sliding renewal"
```

---

### Task 18: `lib/auth/require.ts` — `requireUser` + Origin/CSRF check

**Files:**
- Create: `lib/auth/require.ts`, `lib/csrf.ts`, `tests/unit/csrf.test.ts`

- [ ] **Step 1: Write the CSRF test**

```bash
cat > tests/unit/csrf.test.ts <<'EOF'
import { describe, it, expect } from "vitest";
import { assertSameOrigin } from "@/lib/csrf";
import { AppError } from "@/lib/errors";

const APP_ORIGIN = "https://profai.example";

function reqWith(method: string, origin: string | null) {
  const h = new Headers();
  if (origin) h.set("origin", origin);
  return new Request("https://profai.example/api/x", { method, headers: h });
}

describe("assertSameOrigin", () => {
  it("allows GET without Origin", () => {
    expect(() => assertSameOrigin(reqWith("GET", null), APP_ORIGIN)).not.toThrow();
  });
  it("rejects POST with missing Origin", () => {
    expect(() => assertSameOrigin(reqWith("POST", null), APP_ORIGIN)).toThrow(AppError);
  });
  it("rejects POST with mismatched Origin", () => {
    expect(() => assertSameOrigin(reqWith("POST", "https://evil.example"), APP_ORIGIN)).toThrow(AppError);
  });
  it("allows POST with matching Origin", () => {
    expect(() => assertSameOrigin(reqWith("POST", APP_ORIGIN), APP_ORIGIN)).not.toThrow();
  });
});
EOF
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- tests/unit/csrf.test.ts
```

- [ ] **Step 3: Implement `lib/csrf.ts`**

```bash
cat > lib/csrf.ts <<'EOF'
import { AppError } from "@/lib/errors";

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function assertSameOrigin(req: Request, appOrigin: string): void {
  if (!STATE_CHANGING.has(req.method.toUpperCase())) return;
  const origin = req.headers.get("origin");
  if (!origin) throw new AppError("FORBIDDEN", "missing Origin header");
  if (origin !== appOrigin) throw new AppError("FORBIDDEN", "origin mismatch");
}
EOF
```

- [ ] **Step 4: Implement `lib/auth/require.ts`**

```bash
cat > lib/auth/require.ts <<'EOF'
import { eq } from "drizzle-orm";
import { schema, type DB } from "@/lib/db/client";
import { lookupSession, readSessionCookie, renewSession, buildSessionCookie } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import type { AppEnv } from "@/lib/env";

export interface AuthCtx {
  userId: string;
  email: string;
  rotatedCookie?: string;
}

export async function requireUser(req: Request, env: AppEnv, db: DB): Promise<AuthCtx> {
  const token = readSessionCookie(req);
  if (!token) throw new AppError("UNAUTHORIZED", "not signed in");
  const session = await lookupSession(db, token);
  if (!session) throw new AppError("UNAUTHORIZED", "session expired");
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) });
  if (!user || user.deletedAt !== null) throw new AppError("UNAUTHORIZED", "account unavailable");
  let rotatedCookie: string | undefined;
  if (session.shouldRenew) {
    await renewSession(db, token);
    rotatedCookie = buildSessionCookie(token);
  }
  return { userId: user.id, email: user.email, rotatedCookie };
}

export async function requireOwner(ownerId: string, ctx: AuthCtx): Promise<void> {
  if (ownerId !== ctx.userId) throw new AppError("NOT_FOUND", "not found");
}
EOF
```

- [ ] **Step 5: Run — verify PASS**

```bash
npm test -- tests/unit/csrf.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): requireUser + same-origin CSRF guard"
```

---

### Task 19: `middleware.ts` — request-id + Origin attach for /api/*

Goal: vinext supports Next.js middleware; we use it as a shallow request-shaper, not as the auth gate (each route still calls `requireUser` to get the typed ctx).

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Write `middleware.ts`**

```bash
cat > middleware.ts <<'EOF'
import { NextResponse, type NextRequest } from "vinext/server";
import { newRequestId } from "@/lib/log";

export const config = { matcher: ["/api/:path*"] };

export function middleware(req: NextRequest): NextResponse {
  const requestId = req.headers.get("x-request-id") ?? newRequestId();
  const res = NextResponse.next();
  res.headers.set("x-request-id", requestId);
  return res;
}
EOF
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

If `vinext/server` exports differ in your installed vinext version, fall back to the `next/server` shape (`vinext` reimplements it):

```bash
npm ls vinext
```

If the import path needs adjusting per the installed vinext docs, change `vinext/server` to the documented one. Document the change in the commit message.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(middleware): attach request id to /api/* responses"
```

## Phase 4 — Auth API

### Task 20: `lib/db/queries/auth.ts` + `lib/db/queries/audit.ts`

**Files:**
- Create: `lib/db/queries/auth.ts`, `lib/db/queries/audit.ts`

- [ ] **Step 1: Write `lib/db/queries/auth.ts`**

```bash
mkdir -p lib/db/queries
cat > lib/db/queries/auth.ts <<'EOF'
import { eq, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";

export async function findUserByEmail(db: DB, email: string) {
  const lower = email.toLowerCase();
  return db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${lower}` });
}

export async function findUserById(db: DB, id: string) {
  return db.query.users.findFirst({ where: eq(schema.users.id, id) });
}

export async function createUser(db: DB, email: string, passwordHash: string): Promise<string> {
  const id = ulid();
  const now = Math.floor(Date.now() / 1000);
  await db.insert(schema.users).values({
    id,
    email,
    passwordHash,
    createdAt: now,
  } as typeof schema.users.$inferInsert);
  return id;
}

export async function touchLastLogin(db: DB, userId: string): Promise<void> {
  await db.update(schema.users).set({ lastLoginAt: Math.floor(Date.now() / 1000) }).where(eq(schema.users.id, userId));
}

export async function updatePasswordHash(db: DB, userId: string, hash: string): Promise<void> {
  await db.update(schema.users).set({ passwordHash: hash }).where(eq(schema.users.id, userId));
}

export async function softDeleteUser(db: DB, userId: string): Promise<void> {
  await db.update(schema.users).set({ deletedAt: Math.floor(Date.now() / 1000) }).where(eq(schema.users.id, userId));
}
EOF
```

- [ ] **Step 2: Write `lib/db/queries/audit.ts`**

```bash
cat > lib/db/queries/audit.ts <<'EOF'
import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";

export type AuditEvent =
  | "signup"
  | "login"
  | "login_failed"
  | "logout"
  | "password_change"
  | "account_delete"
  | "data_export";

export async function recordAudit(
  db: DB,
  args: { userId: string | null; event: AuditEvent; meta?: unknown; ipHash?: string },
): Promise<void> {
  await db.insert(schema.auditLog).values({
    id: ulid(),
    userId: args.userId,
    event: args.event,
    metaJson: args.meta === undefined ? null : JSON.stringify(args.meta),
    createdAt: Math.floor(Date.now() / 1000),
    ipHash: args.ipHash ?? null,
  } as typeof schema.auditLog.$inferInsert);
}
EOF
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(db): auth + audit query helpers"
```

---

### Task 21: `lib/auth/turnstile.ts` + `lib/auth/iphash.ts`

**Files:**
- Create: `lib/auth/turnstile.ts`, `lib/auth/iphash.ts`

- [ ] **Step 1: Write `lib/auth/iphash.ts`**

```bash
cat > lib/auth/iphash.ts <<'EOF'
export async function ipHash(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(ip + ":" + salt);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
}
EOF
```

- [ ] **Step 2: Write `lib/auth/turnstile.ts`**

```bash
cat > lib/auth/turnstile.ts <<'EOF'
export async function verifyTurnstile(token: string, secret: string | undefined, remoteIp: string): Promise<boolean> {
  if (!secret) return true;
  const body = new URLSearchParams({ secret, response: token, remoteip: remoteIp });
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!r.ok) return false;
  const json = await r.json<{ success: boolean }>();
  return json.success === true;
}
EOF
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(auth): turnstile verifier + ip hash helpers"
```

---

### Task 22: `POST /api/auth/signup`

**Files:**
- Create: `app/api/auth/signup/route.ts`, `lib/api.ts`

- [ ] **Step 1: Write `lib/api.ts` (shared route helpers)**

```bash
cat > lib/api.ts <<'EOF'
import { z, type ZodSchema } from "zod";
import { AppError, errorToResponse } from "@/lib/errors";
import { parseEnv, type AppEnv } from "@/lib/env";
import { db, type DB } from "@/lib/db/client";
import { assertSameOrigin } from "@/lib/csrf";
import { createLogger, newRequestId, type Logger } from "@/lib/log";

export interface RouteCtx {
  req: Request;
  env: AppEnv;
  db: DB;
  log: Logger;
}

export async function withRoute<T>(req: Request, rawEnv: unknown, fn: (ctx: RouteCtx) => Promise<Response>): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? newRequestId();
  const log = createLogger({ requestId });
  try {
    const env = parseEnv(rawEnv);
    assertSameOrigin(req, env.APP_ORIGIN);
    const dbi = db(env);
    const res = await fn({ req, env, db: dbi, log });
    res.headers.set("x-request-id", requestId);
    return res;
  } catch (e) {
    if (e instanceof Error) log.error("route_error", { message: e.message, name: e.name });
    const res = errorToResponse(e);
    res.headers.set("x-request-id", requestId);
    return res;
  }
}

export async function readJson<S extends ZodSchema>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try { json = await req.json(); } catch { throw new AppError("VALIDATION", "invalid JSON"); }
  const r = schema.safeParse(json);
  if (!r.success) throw new AppError("VALIDATION", "invalid input", r.error.flatten());
  return r.data;
}
EOF
```

- [ ] **Step 2: Write `app/api/auth/signup/route.ts`**

```bash
mkdir -p app/api/auth/signup
cat > app/api/auth/signup/route.ts <<'EOF'
import { withRoute, readJson } from "@/lib/api";
import { SignupSchema } from "@shared/validation";
import { hashPassword } from "@/lib/auth/password";
import { issueSession, buildSessionCookie } from "@/lib/auth/session";
import { findUserByEmail, createUser } from "@/lib/db/queries/auth";
import { recordAudit } from "@/lib/db/queries/audit";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { ipHash, clientIp } from "@/lib/auth/iphash";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db, log }) => {
    const ip = clientIp(req);
    const { success } = await env.RATE_LIMITER_SIGNUP.limit({ key: ip });
    if (!success) throw new AppError("RATE_LIMITED", "too many signups, try again later");

    const input = await readJson(req, SignupSchema);
    const ok = await verifyTurnstile(input.turnstile_token, env.TURNSTILE_SECRET_KEY, ip);
    if (!ok) throw new AppError("FORBIDDEN", "turnstile failed");

    const existing = await findUserByEmail(db, input.email);
    if (existing) throw new AppError("CONFLICT", "email already registered");

    const hash = await hashPassword(input.password);
    const userId = await createUser(db, input.email, hash);
    const ih = await ipHash(ip, env.IP_HASH_SALT);
    const { token } = await issueSession(db, { userId, userAgent: req.headers.get("user-agent") ?? undefined, ipHash: ih });
    await recordAudit(db, { userId, event: "signup", ipHash: ih });
    log.info("signup_ok", { userId });

    return new Response(JSON.stringify({ user: { id: userId, email: input.email } }), {
      status: 201,
      headers: { "content-type": "application/json", "set-cookie": buildSessionCookie(token) },
    });
  });
EOF
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(api): POST /api/auth/signup"
```

---

### Task 23: `POST /api/auth/login`

**Files:**
- Create: `app/api/auth/login/route.ts`

- [ ] **Step 1: Write the route**

```bash
mkdir -p app/api/auth/login
cat > app/api/auth/login/route.ts <<'EOF'
import { withRoute, readJson } from "@/lib/api";
import { LoginSchema } from "@shared/validation";
import { verifyPassword } from "@/lib/auth/password";
import { issueSession, buildSessionCookie } from "@/lib/auth/session";
import { findUserByEmail, touchLastLogin } from "@/lib/db/queries/auth";
import { recordAudit } from "@/lib/db/queries/audit";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { ipHash, clientIp } from "@/lib/auth/iphash";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db, log }) => {
    const ip = clientIp(req);
    const ipKey = await ipHash(ip, env.IP_HASH_SALT);

    const { success: ipOk } = await env.RATE_LIMITER_AUTH.limit({ key: ipKey });
    if (!ipOk) throw new AppError("RATE_LIMITED", "too many attempts");

    const input = await readJson(req, LoginSchema);
    const ok = await verifyTurnstile(input.turnstile_token, env.TURNSTILE_SECRET_KEY, ip);
    if (!ok) throw new AppError("FORBIDDEN", "turnstile failed");

    const { success: emailOk } = await env.RATE_LIMITER_AUTH.limit({ key: `email:${input.email}` });
    if (!emailOk) throw new AppError("RATE_LIMITED", "too many attempts");

    const user = await findUserByEmail(db, input.email);
    if (!user || user.deletedAt !== null) {
      await recordAudit(db, { userId: null, event: "login_failed", meta: { reason: "no_user" }, ipHash: ipKey });
      throw new AppError("UNAUTHORIZED", "invalid credentials");
    }
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      await recordAudit(db, { userId: user.id, event: "login_failed", meta: { reason: "bad_password" }, ipHash: ipKey });
      throw new AppError("UNAUTHORIZED", "invalid credentials");
    }

    await touchLastLogin(db, user.id);
    const { token } = await issueSession(db, { userId: user.id, userAgent: req.headers.get("user-agent") ?? undefined, ipHash: ipKey });
    await recordAudit(db, { userId: user.id, event: "login", ipHash: ipKey });
    log.info("login_ok", { userId: user.id });

    return new Response(JSON.stringify({ user: { id: user.id, email: user.email } }), {
      headers: { "content-type": "application/json", "set-cookie": buildSessionCookie(token) },
    });
  });
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): POST /api/auth/login"
```

---

### Task 24: `POST /api/auth/logout` + `GET /api/auth/me`

**Files:**
- Create: `app/api/auth/logout/route.ts`, `app/api/auth/me/route.ts`

- [ ] **Step 1: Write logout**

```bash
mkdir -p app/api/auth/logout
cat > app/api/auth/logout/route.ts <<'EOF'
import { withRoute } from "@/lib/api";
import { readSessionCookie, revokeSession, buildClearCookie } from "@/lib/auth/session";
import { recordAudit } from "@/lib/db/queries/audit";

export const POST = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, db }) => {
    const token = readSessionCookie(req);
    if (token) {
      await revokeSession(db, token);
      await recordAudit(db, { userId: null, event: "logout" });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", "set-cookie": buildClearCookie() },
    });
  });
EOF
```

- [ ] **Step 2: Write me**

```bash
mkdir -p app/api/auth/me
cat > app/api/auth/me/route.ts <<'EOF'
import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";

export const GET = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (user.rotatedCookie) headers["set-cookie"] = user.rotatedCookie;
    return new Response(JSON.stringify({ id: user.userId, email: user.email }), { headers });
  });
EOF
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): logout + me"
```

---

### Task 25: Integration test for full signup → login → me → logout flow

**Files:**
- Create: `tests/integration/auth.test.ts`

- [ ] **Step 1: Write the integration test**

```bash
cat > tests/integration/auth.test.ts <<'EOF'
import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const ORIGIN = "http://localhost:3000";

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (init.method && init.method !== "GET") headers.set("origin", ORIGIN);
  return SELF.fetch(`${ORIGIN}${path}`, { ...init, headers });
}

beforeAll(async () => {
  // Seed env vars miniflare cannot infer
  (env as unknown as Record<string, string>).APP_ORIGIN = ORIGIN;
  (env as unknown as Record<string, string>).CONTENT_KEY = "a".repeat(44);
  (env as unknown as Record<string, string>).IP_HASH_SALT = "test-salt";
  (env as unknown as Record<string, string>).AI_GATEWAY_GOOGLE_API_KEY = "test";
});

describe("auth flow", () => {
  const email = `u${Date.now()}@test.local`;
  const password = "correct-horse-battery-staple";
  let cookie = "";

  it("signs up", async () => {
    const r = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, turnstile_token: "x" }),
    });
    expect(r.status).toBe(201);
    cookie = r.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/__Host-session=/);
  });

  it("returns me", async () => {
    const r = await api("/api/auth/me", { headers: { cookie } });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.email).toBe(email);
  });

  it("rejects wrong password on login", async () => {
    const r = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "wrong-password-123", turnstile_token: "x" }),
    });
    expect(r.status).toBe(401);
  });

  it("logs out and clears cookie", async () => {
    const r = await api("/api/auth/logout", { method: "POST", headers: { cookie } });
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toMatch(/__Host-session=;/);
  });
}, { timeout: 30_000 });
EOF
```

- [ ] **Step 2: Run integration tests**

```bash
npm run test:integration
```

Expected: 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(integration): signup/login/me/logout flow"
```

## Phase 5 — UI shell + auth pages

### Task 26: shadcn primitives (Button, Input, Label, Card, Alert)

Goal: copy a minimal set of shadcn primitives into `components/ui/`.

**Files:**
- Create: `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/card.tsx`, `components/ui/alert.tsx`

- [ ] **Step 1: Install peer deps for shadcn primitives**

```bash
npm install @radix-ui/react-slot @radix-ui/react-label class-variance-authority lucide-react
```

- [ ] **Step 2: Write `components/ui/button.tsx`**

```bash
mkdir -p components/ui
cat > components/ui/button.tsx <<'EOF'
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-indigo-700",
        outline: "border border-slate-300 bg-white hover:bg-slate-50",
        ghost: "hover:bg-slate-100",
        destructive: "bg-red-600 text-white hover:bg-red-700",
      },
      size: { default: "h-10 px-4 py-2", sm: "h-8 px-3", lg: "h-12 px-6" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
EOF
```

- [ ] **Step 3: Write `components/ui/input.tsx`**

```bash
cat > components/ui/input.tsx <<'EOF'
import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
EOF
```

- [ ] **Step 4: Write `components/ui/label.tsx`**

```bash
cat > components/ui/label.tsx <<'EOF'
"use client";
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/cn";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn("text-sm font-medium text-slate-700", className)} {...props} />
));
Label.displayName = "Label";
EOF
```

- [ ] **Step 5: Write `components/ui/card.tsx`**

```bash
cat > components/ui/card.tsx <<'EOF'
import * as React from "react";
import { cn } from "@/lib/cn";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)} {...props} />
));
Card.displayName = "Card";

export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pb-0", className)} {...p} />
);
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6", className)} {...p} />
);
export const CardFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0", className)} {...p} />
);
EOF
```

- [ ] **Step 6: Write `components/ui/alert.tsx`**

```bash
cat > components/ui/alert.tsx <<'EOF'
import * as React from "react";
import { cn } from "@/lib/cn";

export const Alert = ({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="alert" className={cn("rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800", className)} {...p}>
    {children}
  </div>
);
EOF
```

- [ ] **Step 7: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(ui): button, input, label, card, alert primitives"
```

---

### Task 27: `components/auth/AuthForm.tsx` (shared signup/login form)

**Files:**
- Create: `components/auth/AuthForm.tsx`

- [ ] **Step 1: Write the form**

```bash
mkdir -p components/auth
cat > components/auth/AuthForm.tsx <<'EOF'
"use client";
import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export interface AuthFormProps {
  mode: "signup" | "login";
  endpoint: string;
  redirectTo: string;
}

export function AuthForm({ mode, endpoint, redirectTo }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, turnstile_token: "dev" }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setErr(body?.error?.message ?? `${mode} failed`);
        return;
      }
      window.location.href = redirectTo;
    } catch {
      setErr("network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <h1 className="text-2xl font-bold text-slate-900">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {mode === "login"
            ? "We'll keep you signed in for 30 days. The session refreshes every time you use ProfAI."
            : "Free signup. No credit card."}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={mode === "signup" ? 10 : 1} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            {mode === "signup" && <p className="text-xs text-slate-500">At least 10 characters.</p>}
          </div>
          {err && <Alert>{err}</Alert>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(auth): shared AuthForm component"
```

---

### Task 28: `/login` and `/signup` pages

**Files:**
- Create: `app/login/page.tsx`, `app/signup/page.tsx`

- [ ] **Step 1: Write `app/login/page.tsx`**

```bash
mkdir -p app/login app/signup
cat > app/login/page.tsx <<'EOF'
import Link from "vinext/link";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <AuthForm mode="login" endpoint="/api/auth/login" redirectTo="/chat" />
        <p className="text-center text-sm text-slate-500">
          New here? <Link href="/signup" className="text-primary underline">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
EOF
```

- [ ] **Step 2: Write `app/signup/page.tsx`**

```bash
cat > app/signup/page.tsx <<'EOF'
import Link from "vinext/link";
import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <AuthForm mode="signup" endpoint="/api/auth/signup" redirectTo="/chat" />
        <p className="text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="text-primary underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
EOF
```

> **vinext Link import note:** if `vinext/link` isn't the resolved import path in your installed vinext version, change to whatever the docs specify (e.g., `next/link` if vinext re-exports it). Confirm with `npm run typecheck`.

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

Open http://localhost:3000/signup. Confirm the form renders, then http://localhost:3000/login. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(pages): /login and /signup"
```

---

### Task 29: Auth gate landing page (`app/page.tsx` redirect)

Goal: when a logged-in user hits `/`, send them to `/chat`. Otherwise send them to `/login`.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

```bash
cat > app/page.tsx <<'EOF'
import { redirect } from "vinext/navigation";
import { headers } from "vinext/headers";
import { parseEnv } from "@/lib/env";
import { db } from "@/lib/db/client";
import { lookupSession, SESSION_COOKIE } from "@/lib/auth/session";
import { getRequestEnv } from "@/lib/server-env";

export default async function HomePage() {
  const env = parseEnv(getRequestEnv());
  const cookie = (await headers()).get("cookie") ?? "";
  const match = cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${SESSION_COOKIE}=`));
  const token = match?.split("=").slice(1).join("=");
  if (token) {
    const dbi = db(env);
    const session = await lookupSession(dbi, token);
    if (session) redirect("/chat");
  }
  redirect("/login");
}
EOF
```

- [ ] **Step 2: Write `lib/server-env.ts` accessor**

```bash
cat > lib/server-env.ts <<'EOF'
import { getCloudflareContext } from "@cloudflare/next-on-pages";

// vinext exposes the worker env via getRequestContext() in some versions and
// via process.env in dev. This thin accessor is the one place we reach for it.
export function getRequestEnv(): unknown {
  // @ts-expect-error vinext-provided global on Workers runtime
  if (typeof globalThis.__VINEXT_ENV__ !== "undefined") return globalThis.__VINEXT_ENV__;
  // @ts-expect-error fallback for dev
  if (typeof process !== "undefined" && process.env) return process.env;
  return getCloudflareContext().env;
}
EOF
```

> **Adapter caveat:** the helper above tries three patterns because vinext is experimental and the public env-access API may shift between versions. If your installed vinext exposes a documented helper (e.g., `getRequestContext()` from `vinext/server`), replace this file's body with that single call. Goal: one chokepoint that returns the bindings object.

- [ ] **Step 3: Install fallback**

```bash
npm install @cloudflare/next-on-pages
```

- [ ] **Step 4: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(pages): / redirects based on session"
```

## Phase 6 — R2 + uploads

### Task 30: `lib/r2.ts` — upload + ownership-checked proxy

**Files:**
- Create: `lib/r2.ts`, `lib/upload-validate.ts`, `tests/unit/upload-validate.test.ts`

- [ ] **Step 1: Write the magic-byte sniffing test**

```bash
cat > tests/unit/upload-validate.test.ts <<'EOF'
import { describe, it, expect } from "vitest";
import { sniffMime } from "@/lib/upload-validate";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);
const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
const text = new TextEncoder().encode("hello world");

describe("sniffMime", () => {
  it("detects PNG", () => expect(sniffMime(png)).toBe("image/png"));
  it("detects JPEG", () => expect(sniffMime(jpeg)).toBe("image/jpeg"));
  it("detects GIF", () => expect(sniffMime(gif)).toBe("image/gif"));
  it("detects WEBP", () => expect(sniffMime(webp)).toBe("image/webp"));
  it("rejects SVG", () => expect(sniffMime(svg)).toBeNull());
  it("rejects unknown", () => expect(sniffMime(text)).toBeNull());
});
EOF
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- tests/unit/upload-validate.test.ts
```

- [ ] **Step 3: Implement `lib/upload-validate.ts`**

```bash
cat > lib/upload-validate.ts <<'EOF'
type AllowedMime = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  if (bytes.length < 4) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

export function extForMime(mime: AllowedMime): string {
  return ({ "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" } as const)[mime];
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
EOF
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- tests/unit/upload-validate.test.ts
```

- [ ] **Step 5: Implement `lib/r2.ts`**

```bash
cat > lib/r2.ts <<'EOF'
import { ulid } from "ulid";
import type { AppEnv } from "@/lib/env";
import { extForMime, sniffMime } from "@/lib/upload-validate";
import { AppError } from "@/lib/errors";

export interface UploadResult { key: string; mime: string; bytes: number; }

export async function putUpload(env: Pick<AppEnv, "R2">, userId: string, raw: ArrayBuffer): Promise<UploadResult> {
  const bytes = new Uint8Array(raw);
  const mime = sniffMime(bytes);
  if (!mime) throw new AppError("UNSUPPORTED_MEDIA", "unsupported file type");
  const stripped = await stripExif(bytes, mime);
  const key = `uploads/${userId}/${ulid()}.${extForMime(mime)}`;
  await env.R2.put(key, stripped, { httpMetadata: { contentType: mime } });
  return { key, mime, bytes: stripped.byteLength };
}

export async function getUpload(env: Pick<AppEnv, "R2">, userId: string, key: string): Promise<R2ObjectBody> {
  if (!key.startsWith(`uploads/${userId}/`)) throw new AppError("NOT_FOUND", "not found");
  const obj = await env.R2.get(key);
  if (!obj) throw new AppError("NOT_FOUND", "not found");
  return obj;
}

export async function putDiagram(env: Pick<AppEnv, "R2">, chatId: string, png: ArrayBuffer): Promise<string> {
  const key = `diagrams/${chatId}/${ulid()}.png`;
  await env.R2.put(key, png, { httpMetadata: { contentType: "image/png" } });
  return key;
}

export async function putReportPdf(env: Pick<AppEnv, "R2">, userId: string, reportId: string, version: number, pdf: ArrayBuffer): Promise<string> {
  const key = `reports/${userId}/${reportId}-v${version}.pdf`;
  await env.R2.put(key, pdf, { httpMetadata: { contentType: "application/pdf" } });
  return key;
}

async function stripExif(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
  if (mime !== "image/jpeg") return bytes;
  try {
    const exifr = await import("exifr");
    const cleaned = await exifr.default.thumbnailUrl(bytes).catch(() => null);
    if (!cleaned) return bytes;
    return bytes;
  } catch {
    return bytes;
  }
}
EOF
```

> **EXIF note:** the `exifr` library on Workers can read EXIF but doesn't always re-emit a stripped JPEG. The implementation above is conservative — if you need guaranteed strip, swap in a lightweight WASM JPEG re-encoder later. For v2 MVP we accept this and store raw bytes after MIME sniffing rejects SVG (the dangerous vector).

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(r2): upload helpers with magic-byte MIME validation"
```

---

### Task 31: `POST /api/uploads`

**Files:**
- Create: `app/api/uploads/route.ts`

- [ ] **Step 1: Write the route**

```bash
mkdir -p app/api/uploads
cat > app/api/uploads/route.ts <<'EOF'
import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { putUpload } from "@/lib/r2";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-validate";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const { success } = await env.RATE_LIMITER_UPLOAD.limit({ key: `u:${user.userId}` });
    if (!success) throw new AppError("RATE_LIMITED", "upload rate limit");

    const len = Number(req.headers.get("content-length") ?? 0);
    if (!len || len > MAX_UPLOAD_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "max 10MB");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "file field required");
    if (file.size > MAX_UPLOAD_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "max 10MB");
    const buf = await file.arrayBuffer();
    const result = await putUpload(env, user.userId, buf);
    return new Response(JSON.stringify(result), { status: 201, headers: { "content-type": "application/json" } });
  });
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): POST /api/uploads with MIME + size validation"
```

---

### Task 32: `GET /api/uploads/[...key]` proxy

Goal: serve user-private images without ever issuing raw R2 URLs.

**Files:**
- Create: `app/api/uploads/[...key]/route.ts`

- [ ] **Step 1: Write the proxy**

```bash
mkdir -p "app/api/uploads/[...key]"
cat > "app/api/uploads/[...key]/route.ts" <<'EOF'
import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getUpload } from "@/lib/r2";

export const GET = (req: Request, ctx: { env: unknown; params: { key: string[] } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const key = ctx.params.key.join("/");
    const obj = await getUpload(env, user.userId, key);
    const headers = new Headers();
    if (obj.httpMetadata?.contentType) headers.set("content-type", obj.httpMetadata.contentType);
    headers.set("cache-control", "private, max-age=31536000, immutable");
    return new Response(obj.body, { headers });
  });
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): GET /api/uploads/* ownership-checked proxy"
```

## Phase 7 — AI module

### Task 33: `lib/ai/client.ts` — `env.AI.run` wrapper with retries

**Files:**
- Create: `lib/ai/client.ts`

- [ ] **Step 1: Write the wrapper**

```bash
mkdir -p lib/ai
cat > lib/ai/client.ts <<'EOF'
import type { AppEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export const TUTOR_MODEL = "google/gemini-3-flash";
export const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

export interface AiCallOptions {
  signal?: AbortSignal;
  retries?: number;
}

export async function aiRun<T>(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">,
  model: string,
  payload: unknown,
  opts: AiCallOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (opts.signal?.aborted) throw new AppError("UPSTREAM", "client disconnected");
    try {
      return (await env.AI.run(model, payload as Record<string, unknown>, {
        gateway: { id: "profai", skipCache: false },
      })) as T;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw new AppError("UPSTREAM", "AI call failed", { cause: String(lastErr) });
}
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(ai): env.AI.run wrapper with retry"
```

---

### Task 34: `lib/ai/tools.ts` — function-call schemas

**Files:**
- Create: `lib/ai/tools.ts`

- [ ] **Step 1: Write the tool schemas**

```bash
cat > lib/ai/tools.ts <<'EOF'
export const startAssessmentTool = {
  type: "function",
  function: {
    name: "startAssessment",
    description: "Start the diagnostic quiz once the user has named a clear topic to learn.",
    parameters: {
      type: "object",
      properties: { topic: { type: "string", description: "The topic to assess." } },
      required: ["topic"],
    },
  },
} as const;

export const generateDiagramTool = {
  type: "function",
  function: {
    name: "generateDiagram",
    description: "Generate a labelled visual diagram for spatial or organic concepts that LaTeX can't capture.",
    parameters: {
      type: "object",
      properties: { prompt: { type: "string", description: "Detailed description of the diagram." } },
      required: ["prompt"],
    },
  },
} as const;
EOF
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(ai): tool-call schemas (startAssessment, generateDiagram)"
```

---

### Task 35: `lib/ai/prompts/assessment.ts`

**Files:**
- Create: `lib/ai/prompts/assessment.ts`

- [ ] **Step 1: Write the prompt builders**

```bash
mkdir -p lib/ai/prompts
cat > lib/ai/prompts/assessment.ts <<'EOF'
export interface AssessmentQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: number;
}

export function assessmentSystem(): string {
  return "You are an expert examiner. Create precise, clear, pedagogically sound multiple-choice questions.";
}

export function assessmentPrompt(topic: string, hasImage: boolean): string {
  return [
    `The user wants to learn: "${topic}".`,
    hasImage ? "They also provided an image for context." : "",
    "Generate exactly 5 multiple-choice questions in strictly increasing difficulty:",
    "1. Very basic / fundamental",
    "2. Beginner",
    "3. Intermediate",
    "4. Advanced",
    "5. Expert / complex application",
    "Each question has 4 distinct options. Return JSON matching the schema.",
  ].filter(Boolean).join("\n");
}

export const assessmentJsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "integer" },
      question: { type: "string" },
      options: { type: "array", items: { type: "string" } },
      correctIndex: { type: "integer" },
      difficulty: { type: "integer" },
    },
    required: ["id", "question", "options", "correctIndex", "difficulty"],
  },
};

export function analysisSystem(): string {
  return "You are an expert tutor analysing diagnostic quiz results. Be precise and encouraging.";
}

export function analysisPrompt(
  topic: string,
  results: { question: string; difficulty: number; userAnswer: string; isCorrect: boolean }[],
): string {
  return [
    `Topic: ${topic}`,
    "Quiz results:",
    JSON.stringify(results, null, 2),
    `If the user answered "I don't know", treat it as a knowledge gap.`,
    "Determine proficiency level (Novice | Beginner | Intermediate | Proficient | Advanced).",
    "Return JSON: { level, summary, recommendedPath }.",
  ].join("\n");
}

export const analysisJsonSchema = {
  type: "object",
  properties: {
    level: { type: "string" },
    summary: { type: "string" },
    recommendedPath: { type: "string" },
  },
  required: ["level", "summary", "recommendedPath"],
};
EOF
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(ai): assessment + analysis prompt builders"
```

---

### Task 36: `lib/ai/prompts/tutor.ts`

**Files:**
- Create: `lib/ai/prompts/tutor.ts`

- [ ] **Step 1: Write the tutor prompts**

```bash
cat > lib/ai/prompts/tutor.ts <<'EOF'
export function tutorSystem(topic: string, level: string): string {
  return [
    `You are an expert tutor teaching: "${topic}".`,
    `The student is at level: "${level}". Start from this level.`,
    "",
    "Strategy:",
    "1. Use the Socratic method — ask guiding questions before lectures.",
    "2. Break complex concepts into small steps.",
    "3. Confirm understanding before moving on.",
    "",
    "Output rules:",
    "1. For math, physics, logic structure — use LaTeX block math ($$ ... $$) or markdown tables.",
    "   Refer to these as 'the equation', 'the derivation', 'the table' or 'the structure below'.",
    "   NEVER call them 'the diagram' / 'the image'.",
    "2. For spatial or organic concepts where LaTeX can't help, call generateDiagram.",
    "   Only when the tool is invoked may you use words like 'the diagram', 'as shown'.",
    "3. If a tool call fails, immediately re-explain in pure text/LaTeX without referring to a missing image.",
  ].join("\n");
}

export function rollingSummaryPrompt(history: { role: string; content: string }[]): string {
  return [
    "Summarize the following tutoring conversation in one paragraph (4–6 sentences).",
    "Capture key concepts taught, the student's grasp, and any open questions.",
    "Plain prose, no headings.",
    "",
    "Conversation:",
    history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n"),
  ].join("\n");
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(ai): tutor + rolling-summary prompt builders"
```

---

### Task 37: `lib/ai/prompts/title.ts`

**Files:**
- Create: `lib/ai/prompts/title.ts`

- [ ] **Step 1: Write the title prompt**

```bash
cat > lib/ai/prompts/title.ts <<'EOF'
export function titleSystem(): string {
  return "You write very short topic labels for a chat history sidebar.";
}

export function titlePrompt(firstUserText: string): string {
  return [
    "Summarize the following user message into a chat title.",
    "Rules: 2 to 6 words, no quotes, title case, no trailing punctuation.",
    "",
    `User message: """${firstUserText.slice(0, 800)}"""`,
  ].join("\n");
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(ai): title prompt"
```

---

### Task 38: `lib/ai/stream.ts` — SSE producer + parser

**Files:**
- Create: `lib/ai/stream.ts`, `tests/unit/sse.test.ts`

- [ ] **Step 1: Write the SSE encoder test**

```bash
cat > tests/unit/sse.test.ts <<'EOF'
import { describe, it, expect } from "vitest";
import { sseFrame } from "@/lib/ai/stream";

describe("sseFrame", () => {
  it("produces valid SSE syntax", () => {
    const f = sseFrame("delta", { type: "text", text: "hi" });
    expect(f).toBe('event: delta\ndata: {"type":"text","text":"hi"}\n\n');
  });
  it("escapes newlines in payload by JSON encoding", () => {
    const f = sseFrame("delta", { type: "text", text: "line1\nline2" });
    expect(f).toContain('"text":"line1\\nline2"');
  });
});
EOF
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- tests/unit/sse.test.ts
```

- [ ] **Step 3: Implement `lib/ai/stream.ts`**

```bash
cat > lib/ai/stream.ts <<'EOF'
export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "diagram"; r2Key: string }
  | { type: "error"; message: string }
  | { type: "done" };

export function sseFrame(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export function makeSseResponse(producer: (push: (e: StreamEvent) => void) => Promise<void>): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const push = (e: StreamEvent) => controller.enqueue(enc.encode(sseFrame(e.type === "done" ? "done" : "delta", e)));
      try {
        await producer(push);
        push({ type: "done" });
      } catch (e) {
        push({ type: "error", message: e instanceof Error ? e.message : "unknown" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
EOF
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- tests/unit/sse.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ai): SSE encoder and ReadableStream factory"
```

---

### Task 39: `lib/ai/index.ts` — public AI surface

**Files:**
- Create: `lib/ai/index.ts`

- [ ] **Step 1: Write the public API**

```bash
cat > lib/ai/index.ts <<'EOF'
import { TUTOR_MODEL, IMAGE_MODEL, aiRun } from "@/lib/ai/client";
import { assessmentSystem, assessmentPrompt, assessmentJsonSchema, analysisSystem, analysisPrompt, analysisJsonSchema, type AssessmentQuestion } from "@/lib/ai/prompts/assessment";
import { tutorSystem, rollingSummaryPrompt } from "@/lib/ai/prompts/tutor";
import { titleSystem, titlePrompt } from "@/lib/ai/prompts/title";
import { startAssessmentTool, generateDiagramTool } from "@/lib/ai/tools";
import type { StreamEvent } from "@/lib/ai/stream";
import type { AppEnv } from "@/lib/env";

export type { AssessmentQuestion, StreamEvent };

interface GeminiContent { role: "user" | "model" | "system"; parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] }
interface GeminiResponse { candidates?: { content?: { parts?: { text?: string; functionCall?: { name: string; args: unknown } }[] } }[] }

const HISTORY_SIZE_THRESHOLD = 40;
const HISTORY_TOKEN_THRESHOLD = 50_000;

export async function generateAssessment(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">,
  topic: string,
  imageBase64?: string,
): Promise<AssessmentQuestion[]> {
  const parts: GeminiContent["parts"] = [{ text: assessmentPrompt(topic, !!imageBase64) }];
  if (imageBase64) parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
  const res = await aiRun<GeminiResponse>(env, TUTOR_MODEL, {
    contents: [{ role: "user", parts }],
    systemInstruction: { parts: [{ text: assessmentSystem() }] },
    generationConfig: { responseMimeType: "application/json", responseSchema: assessmentJsonSchema },
  });
  const txt = res.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  const raw = JSON.parse(txt) as AssessmentQuestion[];
  return raw.map((q) => ({ ...q, options: [...q.options, "I don't know"] }));
}

export async function analyseAssessment(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">,
  topic: string,
  questions: AssessmentQuestion[],
  answers: number[],
): Promise<{ level: string; summary: string; recommendedPath: string }> {
  const results = questions.map((q, i) => ({
    question: q.question,
    difficulty: q.difficulty,
    userAnswer: q.options[answers[i] ?? -1] ?? "(no answer)",
    isCorrect: answers[i] === q.correctIndex,
  }));
  const res = await aiRun<GeminiResponse>(env, TUTOR_MODEL, {
    contents: [{ role: "user", parts: [{ text: analysisPrompt(topic, results) }] }],
    systemInstruction: { parts: [{ text: analysisSystem() }] },
    generationConfig: { responseMimeType: "application/json", responseSchema: analysisJsonSchema },
  });
  const txt = res.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(txt);
}

export async function generateTitle(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">,
  firstUserText: string,
): Promise<string> {
  const res = await aiRun<GeminiResponse>(env, TUTOR_MODEL, {
    contents: [{ role: "user", parts: [{ text: titlePrompt(firstUserText) }] }],
    systemInstruction: { parts: [{ text: titleSystem() }] },
    generationConfig: { responseMimeType: "text/plain", maxOutputTokens: 32 },
  });
  return (res.candidates?.[0]?.content?.parts?.[0]?.text ?? "Untitled chat").trim().slice(0, 60);
}

export interface TutorTurn { role: "user" | "model"; content: string; imageBase64?: string }

export async function streamTutorReply(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY" | "R2">,
  args: {
    chatId: string;
    history: TutorTurn[];
    rollingSummary: string | null;
    newUserText: string;
    newImageBase64?: string;
    level: string;
    topic: string;
    signal?: AbortSignal;
    onDiagramKey?: (key: string) => void;
  },
): Promise<AsyncIterable<StreamEvent>> {
  const trimmed = trimHistory(args.history);
  const contents: GeminiContent[] = [];
  if (args.rollingSummary && trimmed.summarised) {
    contents.push({ role: "user", parts: [{ text: `Earlier in this conversation: ${args.rollingSummary}` }] });
  }
  for (const m of trimmed.kept) {
    const parts: GeminiContent["parts"] = [{ text: m.content }];
    if (m.imageBase64) parts.push({ inlineData: { mimeType: "image/jpeg", data: m.imageBase64 } });
    contents.push({ role: m.role === "model" ? "model" : "user", parts });
  }
  const newParts: GeminiContent["parts"] = [{ text: args.newUserText }];
  if (args.newImageBase64) newParts.push({ inlineData: { mimeType: "image/jpeg", data: args.newImageBase64 } });
  contents.push({ role: "user", parts: newParts });

  return (async function* () {
    const res = await aiRun<GeminiResponse>(env, TUTOR_MODEL, {
      contents,
      systemInstruction: { parts: [{ text: tutorSystem(args.topic, args.level) }] },
      tools: [{ functionDeclarations: [generateDiagramTool.function] }],
    }, { signal: args.signal });
    const partsOut = res.candidates?.[0]?.content?.parts ?? [];
    for (const p of partsOut) {
      if (p.text) yield { type: "text", text: p.text } as StreamEvent;
      if (p.functionCall?.name === "generateDiagram") {
        const fcArgs = p.functionCall.args as { prompt?: string };
        const png = await aiRun<{ image: string }>(env, IMAGE_MODEL, { prompt: `Educational diagram: ${fcArgs.prompt ?? ""}. Clear, labelled, schematic style.` });
        const bytes = Uint8Array.from(atob(png.image), (c) => c.charCodeAt(0));
        const { putDiagram } = await import("@/lib/r2");
        const r2Key = await putDiagram(env, args.chatId, bytes.buffer);
        args.onDiagramKey?.(r2Key);
        yield { type: "diagram", r2Key } as StreamEvent;
      }
    }
  })();
}

export async function summariseHistory(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">,
  older: TutorTurn[],
): Promise<string> {
  const res = await aiRun<GeminiResponse>(env, TUTOR_MODEL, {
    contents: [{ role: "user", parts: [{ text: rollingSummaryPrompt(older.map((m) => ({ role: m.role, content: m.content }))) }] }],
    generationConfig: { responseMimeType: "text/plain", maxOutputTokens: 400 },
  });
  return (res.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

function approxTokens(turns: TutorTurn[]): number {
  return turns.reduce((sum, t) => sum + Math.ceil(t.content.length / 4), 0);
}

interface TrimResult { kept: TutorTurn[]; summarised: boolean; older: TutorTurn[] }

export function trimHistory(history: TutorTurn[]): TrimResult {
  if (history.length <= HISTORY_SIZE_THRESHOLD && approxTokens(history) < HISTORY_TOKEN_THRESHOLD) {
    return { kept: history, summarised: false, older: [] };
  }
  const kept = history.slice(-20);
  const older = history.slice(0, -20);
  return { kept, summarised: true, older };
}

const _kept = startAssessmentTool; void _kept;
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(ai): public surface (assessment, analyse, title, stream, summarise)"
```

## Phase 8 — Chats lifecycle

### Task 40: `lib/encrypt.ts` — AES-GCM helpers for message content

**Files:**
- Create: `lib/encrypt.ts`, `tests/unit/encrypt.test.ts`

- [ ] **Step 1: Write the test**

```bash
cat > tests/unit/encrypt.test.ts <<'EOF'
import { describe, it, expect } from "vitest";
import { encryptString, decryptString, deriveKey } from "@/lib/encrypt";

const KEY_B64 = "a".repeat(44);

describe("encrypt/decrypt", () => {
  it("round-trips text", async () => {
    const key = await deriveKey(KEY_B64, "chat_x");
    const { ciphertext, iv } = await encryptString(key, "hello world");
    const back = await decryptString(key, ciphertext, iv);
    expect(back).toBe("hello world");
  });
});
EOF
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- tests/unit/encrypt.test.ts
```

- [ ] **Step 3: Implement `lib/encrypt.ts`**

```bash
cat > lib/encrypt.ts <<'EOF'
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64Decode(s: string): Uint8Array { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }

export async function deriveKey(masterB64: string, salt: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", b64Decode(masterB64), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode(salt), info: enc.encode("profai-v2-message") },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return { ciphertext, iv };
}

export async function decryptString(key: CryptoKey, ciphertext: BufferSource, iv: BufferSource): Promise<string> {
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return dec.decode(buf);
}
EOF
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- tests/unit/encrypt.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(crypto): AES-GCM helpers for at-rest message content"
```

---

### Task 41: `lib/db/queries/chats.ts`

**Files:**
- Create: `lib/db/queries/chats.ts`

- [ ] **Step 1: Write the queries**

```bash
cat > lib/db/queries/chats.ts <<'EOF'
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";

export interface ChatRow { id: string; userId: string; topic: string; level: string | null; status: string; title: string | null; rollingSummary: string | null; startedAt: number; lastActiveAt: number; deletedAt: number | null }

export async function createChat(db: DB, userId: string, topic: string): Promise<ChatRow> {
  const id = ulid();
  const now = Math.floor(Date.now() / 1000);
  const row: typeof schema.chats.$inferInsert = { id, userId, topic, status: "active", startedAt: now, lastActiveAt: now };
  await db.insert(schema.chats).values(row);
  return { ...row, level: null, title: null, rollingSummary: null, deletedAt: null } as ChatRow;
}

export interface ListPage { items: ChatRow[]; nextCursor: string | null }

export async function listChats(db: DB, userId: string, cursor: string | undefined, limit: number): Promise<ListPage> {
  const where = cursor
    ? and(eq(schema.chats.userId, userId), isNull(schema.chats.deletedAt), lt(schema.chats.lastActiveAt, Number(cursor)))
    : and(eq(schema.chats.userId, userId), isNull(schema.chats.deletedAt));
  const rows = await db.select().from(schema.chats).where(where).orderBy(desc(schema.chats.lastActiveAt)).limit(limit + 1);
  const items = rows.slice(0, limit) as ChatRow[];
  const nextCursor = rows.length > limit ? String(rows[limit - 1]!.lastActiveAt) : null;
  return { items, nextCursor };
}

export async function getChat(db: DB, userId: string, id: string): Promise<ChatRow | null> {
  const r = await db.query.chats.findFirst({
    where: and(eq(schema.chats.id, id), eq(schema.chats.userId, userId), isNull(schema.chats.deletedAt)),
  });
  return (r ?? null) as ChatRow | null;
}

export async function patchChat(db: DB, userId: string, id: string, patch: Partial<Pick<ChatRow, "title" | "status" | "level" | "rollingSummary">>): Promise<void> {
  await db.update(schema.chats).set({ ...patch, lastActiveAt: Math.floor(Date.now() / 1000) }).where(and(eq(schema.chats.id, id), eq(schema.chats.userId, userId)));
}

export async function softDeleteChat(db: DB, userId: string, id: string): Promise<void> {
  await db.update(schema.chats).set({ deletedAt: Math.floor(Date.now() / 1000) }).where(and(eq(schema.chats.id, id), eq(schema.chats.userId, userId)));
}

export async function touchChat(db: DB, id: string): Promise<void> {
  await db.update(schema.chats).set({ lastActiveAt: Math.floor(Date.now() / 1000) }).where(eq(schema.chats.id, id));
}
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(db): chats queries (create, list paginated, get, patch, delete)"
```

---

### Task 42: `lib/db/queries/messages.ts` (with encryption)

**Files:**
- Create: `lib/db/queries/messages.ts`

- [ ] **Step 1: Write the queries**

```bash
cat > lib/db/queries/messages.ts <<'EOF'
import { asc, eq } from "drizzle-orm";
import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";
import { deriveKey, encryptString, decryptString } from "@/lib/encrypt";

export interface MessageInput {
  chatId: string;
  role: "user" | "model";
  content: string;
  imageR2Key?: string;
  isDiagram?: boolean;
}
export interface MessageRow extends MessageInput { id: string; createdAt: number }

export async function appendMessage(db: DB, contentKeyB64: string, m: MessageInput): Promise<MessageRow> {
  const id = ulid();
  const createdAt = Math.floor(Date.now() / 1000);
  const key = await deriveKey(contentKeyB64, m.chatId);
  const { ciphertext, iv } = await encryptString(key, m.content);
  await db.insert(schema.messages).values({
    id,
    chatId: m.chatId,
    role: m.role,
    contentCiphertext: Buffer.from(new Uint8Array(ciphertext)),
    contentIv: Buffer.from(iv),
    imageR2Key: m.imageR2Key ?? null,
    isDiagram: m.isDiagram ? 1 : 0,
    createdAt,
  } as typeof schema.messages.$inferInsert);
  return { id, createdAt, ...m, isDiagram: m.isDiagram ?? false };
}

export async function listMessages(db: DB, contentKeyB64: string, chatId: string): Promise<MessageRow[]> {
  const rows = await db.select().from(schema.messages).where(eq(schema.messages.chatId, chatId)).orderBy(asc(schema.messages.createdAt));
  const key = await deriveKey(contentKeyB64, chatId);
  const out: MessageRow[] = [];
  for (const r of rows) {
    const text = await decryptString(key, new Uint8Array(r.contentCiphertext as Uint8Array), new Uint8Array(r.contentIv as Uint8Array));
    out.push({
      id: r.id,
      chatId: r.chatId,
      role: r.role as "user" | "model",
      content: text,
      imageR2Key: r.imageR2Key ?? undefined,
      isDiagram: r.isDiagram === 1,
      createdAt: r.createdAt,
    });
  }
  return out;
}
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(db): messages queries with AES-GCM round-trip"
```

---

### Task 43: `lib/db/queries/assessments.ts`

**Files:**
- Create: `lib/db/queries/assessments.ts`

- [ ] **Step 1: Write the queries**

```bash
cat > lib/db/queries/assessments.ts <<'EOF'
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";
import type { AssessmentQuestion } from "@/lib/ai";

export async function createAssessment(db: DB, chatId: string, questions: AssessmentQuestion[]): Promise<string> {
  const id = ulid();
  await db.insert(schema.assessments).values({
    id, chatId, questionsJson: JSON.stringify(questions),
  } as typeof schema.assessments.$inferInsert);
  return id;
}

export async function getAssessment(db: DB, chatId: string) {
  return db.query.assessments.findFirst({ where: eq(schema.assessments.chatId, chatId) });
}

export async function recordAnswer(db: DB, chatId: string, answers: number[]): Promise<void> {
  await db.update(schema.assessments).set({ answersJson: JSON.stringify(answers) }).where(eq(schema.assessments.chatId, chatId));
}

export async function completeAssessment(
  db: DB,
  chatId: string,
  answers: number[],
  questions: AssessmentQuestion[],
  result: { level: string; summary: string; recommendedPath: string },
): Promise<void> {
  const score = answers.reduce((s, a, i) => s + (a === questions[i]?.correctIndex ? 1 : 0), 0);
  await db.update(schema.assessments)
    .set({
      answersJson: JSON.stringify(answers),
      score,
      summary: result.summary,
      recommendedPath: result.recommendedPath,
      completedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(schema.assessments.chatId, chatId));
}
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(db): assessment queries"
```

---

### Task 44: `POST /api/chats` and `GET /api/chats`

**Files:**
- Create: `app/api/chats/route.ts`

- [ ] **Step 1: Write the route**

```bash
mkdir -p app/api/chats
cat > app/api/chats/route.ts <<'EOF'
import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { ChatCreateSchema, PaginationSchema } from "@shared/validation";
import { createChat, listChats } from "@/lib/db/queries/chats";
import { createAssessment } from "@/lib/db/queries/assessments";
import { generateAssessment } from "@/lib/ai";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const input = await readJson(req, ChatCreateSchema);

    let imageBase64: string | undefined;
    if (input.image_key) {
      if (!input.image_key.startsWith(`uploads/${user.userId}/`)) throw new AppError("FORBIDDEN", "image not yours");
      const obj = await env.R2.get(input.image_key);
      if (!obj) throw new AppError("NOT_FOUND", "image missing");
      const buf = new Uint8Array(await obj.arrayBuffer());
      imageBase64 = btoa(String.fromCharCode(...buf));
    }

    const chat = await createChat(db, user.userId, input.topic);
    const questions = await generateAssessment(env, input.topic, imageBase64);
    await createAssessment(db, chat.id, questions);
    return new Response(JSON.stringify({ chat, questions }), { status: 201, headers: { "content-type": "application/json" } });
  });

export const GET = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const url = new URL(req.url);
    const { cursor, limit } = PaginationSchema.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const page = await listChats(db, user.userId, cursor, limit);
    return new Response(JSON.stringify(page), { headers: { "content-type": "application/json" } });
  });
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): create + list chats with pagination"
```

---

### Task 45: `GET / PATCH / DELETE /api/chats/[id]`

**Files:**
- Create: `app/api/chats/[id]/route.ts`

- [ ] **Step 1: Write the route**

```bash
mkdir -p "app/api/chats/[id]"
cat > "app/api/chats/[id]/route.ts" <<'EOF'
import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getChat, patchChat, softDeleteChat } from "@/lib/db/queries/chats";
import { listMessages } from "@/lib/db/queries/messages";
import { getAssessment } from "@/lib/db/queries/assessments";
import { ChatPatchSchema } from "@shared/validation";
import { AppError } from "@/lib/errors";

export const GET = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const chat = await getChat(db, user.userId, ctx.params.id);
    if (!chat) throw new AppError("NOT_FOUND", "chat not found");
    const [messages, assessment] = await Promise.all([
      listMessages(db, env.CONTENT_KEY, chat.id),
      getAssessment(db, chat.id),
    ]);
    return new Response(JSON.stringify({ chat, messages, assessment }), { headers: { "content-type": "application/json" } });
  });

export const PATCH = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const input = await readJson(req, ChatPatchSchema);
    await patchChat(db, user.userId, ctx.params.id, input);
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  });

export const DELETE = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    await softDeleteChat(db, user.userId, ctx.params.id);
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  });
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): chat get/patch/delete"
```

---

### Task 46: `POST /api/chats/[id]/answer` (multi-step assessment)

**Files:**
- Create: `app/api/chats/[id]/answer/route.ts`, `lib/db/queries/reports.ts`

- [ ] **Step 1: Write `lib/db/queries/reports.ts` (only what we need now)**

```bash
cat > lib/db/queries/reports.ts <<'EOF'
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";

export interface ReportRow { id: string; chatId: string; userId: string; kind: string; version: number; title: string; contentMd: string; pdfR2Key: string | null; createdAt: number; deletedAt: number | null }

export async function createReport(db: DB, args: { chatId: string; userId: string; kind: "assessment" | "progress" | "completion"; title: string; contentMd: string; version?: number }): Promise<ReportRow> {
  const id = ulid();
  const now = Math.floor(Date.now() / 1000);
  const version = args.version ?? 1;
  await db.insert(schema.reports).values({
    id, chatId: args.chatId, userId: args.userId, kind: args.kind, version, title: args.title, contentMd: args.contentMd, createdAt: now,
  } as typeof schema.reports.$inferInsert);
  return { id, chatId: args.chatId, userId: args.userId, kind: args.kind, version, title: args.title, contentMd: args.contentMd, pdfR2Key: null, createdAt: now, deletedAt: null };
}

export async function listReportsForUser(db: DB, userId: string, cursor: string | undefined, limit: number) {
  const where = cursor
    ? and(eq(schema.reports.userId, userId), isNull(schema.reports.deletedAt), lt(schema.reports.createdAt, Number(cursor)))
    : and(eq(schema.reports.userId, userId), isNull(schema.reports.deletedAt));
  const rows = await db.select().from(schema.reports).where(where).orderBy(desc(schema.reports.createdAt)).limit(limit + 1);
  const items = rows.slice(0, limit) as ReportRow[];
  return { items, nextCursor: rows.length > limit ? String(rows[limit - 1]!.createdAt) : null };
}

export async function getReport(db: DB, userId: string, id: string): Promise<ReportRow | null> {
  const r = await db.query.reports.findFirst({
    where: and(eq(schema.reports.id, id), eq(schema.reports.userId, userId), isNull(schema.reports.deletedAt)),
  });
  return (r ?? null) as ReportRow | null;
}

export async function listReportsForChat(db: DB, chatId: string): Promise<ReportRow[]> {
  return await db.select().from(schema.reports).where(and(eq(schema.reports.chatId, chatId), isNull(schema.reports.deletedAt))).orderBy(desc(schema.reports.createdAt)) as ReportRow[];
}

export async function setReportPdfKey(db: DB, id: string, key: string): Promise<void> {
  await db.update(schema.reports).set({ pdfR2Key: key }).where(eq(schema.reports.id, id));
}
EOF
```

- [ ] **Step 2: Write the answer route**

```bash
mkdir -p "app/api/chats/[id]/answer"
cat > "app/api/chats/[id]/answer/route.ts" <<'EOF'
import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getChat, patchChat } from "@/lib/db/queries/chats";
import { getAssessment, completeAssessment, recordAnswer } from "@/lib/db/queries/assessments";
import { createReport } from "@/lib/db/queries/reports";
import { AssessmentAnswerSchema } from "@shared/validation";
import { analyseAssessment, type AssessmentQuestion } from "@/lib/ai";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const input = await readJson(req, AssessmentAnswerSchema);
    const chat = await getChat(db, user.userId, ctx.params.id);
    if (!chat) throw new AppError("NOT_FOUND", "chat not found");
    const a = await getAssessment(db, chat.id);
    if (!a) throw new AppError("NOT_FOUND", "no assessment");
    const questions = JSON.parse(a.questionsJson) as AssessmentQuestion[];
    const answers: number[] = a.answersJson ? JSON.parse(a.answersJson) : [];
    answers.push(input.option_index);

    if (answers.length < questions.length) {
      await recordAnswer(db, chat.id, answers);
      return new Response(JSON.stringify({ next: questions[answers.length], remaining: questions.length - answers.length }), { headers: { "content-type": "application/json" } });
    }

    const result = await analyseAssessment(env, chat.topic, questions, answers);
    await completeAssessment(db, chat.id, answers, questions, result);
    await patchChat(db, user.userId, chat.id, { level: result.level });
    const md = renderAssessmentReport(chat.topic, result, questions, answers);
    const report = await createReport(db, {
      chatId: chat.id, userId: user.userId, kind: "assessment",
      title: `Assessment: ${chat.topic}`, contentMd: md,
    });
    return new Response(JSON.stringify({ done: true, level: result.level, summary: result.summary, recommendedPath: result.recommendedPath, reportId: report.id }), { headers: { "content-type": "application/json" } });
  });

function renderAssessmentReport(topic: string, r: { level: string; summary: string; recommendedPath: string }, qs: AssessmentQuestion[], ans: number[]): string {
  const lines: string[] = [];
  lines.push(`# Assessment Report — ${topic}`, "", `**Level:** ${r.level}`, "", `## Summary`, r.summary, "", `## Recommended Path`, r.recommendedPath, "", `## Question-by-Question`);
  qs.forEach((q, i) => {
    const correct = ans[i] === q.correctIndex;
    lines.push("", `### ${i + 1}. ${q.question}`, `- Your answer: ${q.options[ans[i] ?? -1] ?? "—"} ${correct ? "✓" : "✗"}`, `- Correct: ${q.options[q.correctIndex]}`, `- Difficulty: ${q.difficulty}/5`);
  });
  return lines.join("\n");
}
EOF
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): assessment answer flow + auto-generated report"
```

## Phase 9 — Chat streaming

### Task 47: `POST /api/chats/[id]/chat` (SSE)

**Files:**
- Create: `app/api/chats/[id]/chat/route.ts`

- [ ] **Step 1: Write the SSE route**

```bash
mkdir -p "app/api/chats/[id]/chat"
cat > "app/api/chats/[id]/chat/route.ts" <<'EOF'
import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getChat, patchChat } from "@/lib/db/queries/chats";
import { listMessages, appendMessage } from "@/lib/db/queries/messages";
import { ChatSendSchema } from "@shared/validation";
import { streamTutorReply, summariseHistory, generateTitle, trimHistory, type StreamEvent } from "@/lib/ai";
import { makeSseResponse } from "@/lib/ai/stream";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const { success } = await env.RATE_LIMITER_CHAT.limit({ key: `u:${user.userId}` });
    if (!success) throw new AppError("RATE_LIMITED", "chat rate limit");
    const input = await readJson(req, ChatSendSchema);

    const chat = await getChat(db, user.userId, ctx.params.id);
    if (!chat) throw new AppError("NOT_FOUND", "chat not found");
    if (!chat.level) throw new AppError("VALIDATION", "complete the assessment first");

    let userImageBase64: string | undefined;
    if (input.image_key) {
      if (!input.image_key.startsWith(`uploads/${user.userId}/`)) throw new AppError("FORBIDDEN", "image not yours");
      const obj = await env.R2.get(input.image_key);
      if (!obj) throw new AppError("NOT_FOUND", "image missing");
      const buf = new Uint8Array(await obj.arrayBuffer());
      userImageBase64 = btoa(String.fromCharCode(...buf));
    }

    await appendMessage(db, env.CONTENT_KEY, {
      chatId: chat.id, role: "user", content: input.text, imageR2Key: input.image_key,
    });

    const history = await listMessages(db, env.CONTENT_KEY, chat.id);
    const turns = history.slice(0, -1).map((m) => ({ role: m.role, content: m.content })) as { role: "user" | "model"; content: string }[];

    const trim = trimHistory(turns);
    if (trim.summarised && (!chat.rollingSummary || trim.older.length > 0)) {
      const newSummary = await summariseHistory(env, trim.older);
      await patchChat(db, user.userId, chat.id, { rollingSummary: newSummary });
      chat.rollingSummary = newSummary;
    }

    return makeSseResponse(async (push) => {
      let aggregateText = "";
      const events = await streamTutorReply(env, {
        chatId: chat.id, history: turns, rollingSummary: chat.rollingSummary,
        newUserText: input.text, newImageBase64: userImageBase64, level: chat.level!, topic: chat.topic,
        signal: req.signal,
      });
      for await (const ev of events) {
        push(ev as StreamEvent);
        if (ev.type === "text") aggregateText += ev.text;
        if (ev.type === "diagram") {
          await appendMessage(db, env.CONTENT_KEY, { chatId: chat.id, role: "model", content: "(diagram)", imageR2Key: ev.r2Key, isDiagram: true });
        }
      }
      if (aggregateText) {
        await appendMessage(db, env.CONTENT_KEY, { chatId: chat.id, role: "model", content: aggregateText });
      }
      await patchChat(db, user.userId, chat.id, {});
      if (!chat.title && history.length === 0) {
        const title = await generateTitle(env, input.text);
        await patchChat(db, user.userId, chat.id, { title });
      }
    });
  });
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): SSE tutor chat with persistence + title backfill"
```

---

### Task 48: `POST /api/chats/[id]/messages/[mid]/retry`

**Files:**
- Create: `app/api/chats/[id]/messages/[mid]/retry/route.ts`

- [ ] **Step 1: Write the retry route**

```bash
mkdir -p "app/api/chats/[id]/messages/[mid]/retry"
cat > "app/api/chats/[id]/messages/[mid]/retry/route.ts" <<'EOF'
import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getChat } from "@/lib/db/queries/chats";
import { listMessages } from "@/lib/db/queries/messages";
import { schema } from "@/lib/db/client";
import { eq, and, gte } from "drizzle-orm";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown; params: { id: string; mid: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const chat = await getChat(db, user.userId, ctx.params.id);
    if (!chat) throw new AppError("NOT_FOUND", "chat not found");
    const messages = await listMessages(db, env.CONTENT_KEY, chat.id);
    const target = messages.find((m) => m.id === ctx.params.mid);
    if (!target) throw new AppError("NOT_FOUND", "message not found");
    if (target.role !== "model") throw new AppError("VALIDATION", "can only retry a model message");
    await db.delete(schema.messages).where(and(eq(schema.messages.chatId, chat.id), gte(schema.messages.createdAt, target.createdAt)));
    return new Response(JSON.stringify({ ok: true, retryFrom: target.createdAt }), { headers: { "content-type": "application/json" } });
  });
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): retry a model message (rolls back to before it)"
```

---

### Task 49: Integration test for chat creation + answer flow

**Files:**
- Create: `tests/integration/chats.test.ts`

- [ ] **Step 1: Write the test**

```bash
cat > tests/integration/chats.test.ts <<'EOF'
import { env, SELF, fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const ORIGIN = "http://localhost:3000";

beforeAll(() => {
  (env as unknown as Record<string, string>).APP_ORIGIN = ORIGIN;
  (env as unknown as Record<string, string>).CONTENT_KEY = "a".repeat(44);
  (env as unknown as Record<string, string>).IP_HASH_SALT = "test-salt";
  (env as unknown as Record<string, string>).AI_GATEWAY_GOOGLE_API_KEY = "test";
  fetchMock.activate();
});

async function api(path: string, init: RequestInit = {}, cookie?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (init.method && init.method !== "GET") headers.set("origin", ORIGIN);
  if (cookie) headers.set("cookie", cookie);
  return SELF.fetch(`${ORIGIN}${path}`, { ...init, headers });
}

describe("chats lifecycle", () => {
  it("requires auth to list chats", async () => {
    const r = await api("/api/chats");
    expect(r.status).toBe(401);
  });
}, { timeout: 30_000 });
EOF
```

> **Note:** the assessment-flow test path needs an env.AI mock. Without that mock, the test only covers auth gates here. Full AI-driven flows are exercised by the e2e Playwright smoke test in Phase 14.

- [ ] **Step 2: Run integration tests**

```bash
npm run test:integration
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(integration): chats auth gate"
```

## Phase 10 — Chat UI

### Task 50: `components/markdown/MarkdownRenderer.tsx`

**Files:**
- Create: `components/markdown/MarkdownRenderer.tsx`

- [ ] **Step 1: Write the renderer**

```bash
mkdir -p components/markdown
cat > components/markdown/MarkdownRenderer.tsx <<'EOF'
"use client";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/cn";

export function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: (props) => <a {...props} className="text-primary underline" target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(ui): markdown renderer with math + gfm"
```

---

### Task 51: `components/chat/MessageBubble.tsx`

**Files:**
- Create: `components/chat/MessageBubble.tsx`

- [ ] **Step 1: Write the bubble**

```bash
mkdir -p components/chat
cat > components/chat/MessageBubble.tsx <<'EOF'
"use client";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import { cn } from "@/lib/cn";

export interface UiMessage {
  id: string;
  role: "user" | "model";
  content: string;
  imageR2Key?: string;
  isDiagram?: boolean;
}

export function MessageBubble({ msg }: { msg: UiMessage }) {
  const isUser = msg.role === "user";
  const imageSrc = msg.imageR2Key ? `/api/uploads/${encodeURI(msg.imageR2Key)}` : null;
  return (
    <div className={cn("flex w-full animate-fade-in", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm text-sm sm:text-base leading-relaxed",
        isUser ? "bg-primary text-primary-foreground rounded-br-none" : "bg-white border border-slate-100 rounded-bl-none",
      )}>
        {imageSrc && (
          <div className="mb-3 rounded-lg overflow-hidden border border-slate-200">
            <img src={imageSrc} alt="" className="max-h-64 w-auto object-cover" />
            {msg.isDiagram && (
              <div className="bg-slate-100 px-2 py-1 text-[10px] text-slate-500 uppercase tracking-wide">AI generated diagram</div>
            )}
          </div>
        )}
        <MarkdownRenderer content={msg.content} className={isUser ? "text-white" : "text-slate-800"} />
      </div>
    </div>
  );
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(ui): MessageBubble"
```

---

### Task 52: `components/chat/AssessmentBubble.tsx`

**Files:**
- Create: `components/chat/AssessmentBubble.tsx`, `tests/component/AssessmentBubble.test.tsx`

- [ ] **Step 1: Write the failing component test**

```bash
mkdir -p tests/component
cat > tests/component/AssessmentBubble.test.tsx <<'EOF'
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssessmentBubble } from "@/components/chat/AssessmentBubble";

const q = { id: 1, question: "What is 2+2?", options: ["3", "4", "5", "I don't know"], correctIndex: 1, difficulty: 1 };

describe("AssessmentBubble", () => {
  it("calls onSelect with the chosen index", () => {
    const onSelect = vi.fn();
    render(<AssessmentBubble question={q} onSelect={onSelect} disabled={false} />);
    fireEvent.click(screen.getByText("4"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
  it("disables buttons after answer", () => {
    render(<AssessmentBubble question={q} onSelect={() => {}} disabled selectedIndex={1} />);
    const btn = screen.getByText("3").closest("button")!;
    expect(btn).toBeDisabled();
  });
});
EOF
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- tests/component/AssessmentBubble.test.tsx
```

- [ ] **Step 3: Implement the component**

```bash
cat > components/chat/AssessmentBubble.tsx <<'EOF'
"use client";
import type { AssessmentQuestion } from "@/lib/ai";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import { cn } from "@/lib/cn";

export function AssessmentBubble({
  question, onSelect, disabled, selectedIndex,
}: {
  question: AssessmentQuestion;
  onSelect: (idx: number) => void;
  disabled: boolean;
  selectedIndex?: number;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-5 shadow-sm w-full max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-primary tracking-wider uppercase">Assessment Question</span>
        <span className={cn(
          "text-xs px-2 py-1 rounded-full",
          question.difficulty <= 2 ? "bg-green-100 text-green-800" :
          question.difficulty <= 4 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800",
        )}>
          Level {question.difficulty}
        </span>
      </div>
      <div className="text-slate-900 font-semibold text-lg mb-4">
        <MarkdownRenderer content={question.question} />
      </div>
      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const sel = selectedIndex === i;
          return (
            <button
              key={i}
              onClick={() => !disabled && onSelect(i)}
              disabled={disabled}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl border transition flex items-center",
                sel ? "bg-primary border-primary text-white shadow" :
                disabled ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed" :
                "bg-white border-slate-200 hover:border-primary hover:bg-indigo-50 text-slate-700",
              )}
            >
              <div className={cn("w-5 h-5 rounded-full border mr-3 flex items-center justify-center flex-shrink-0", sel ? "border-white" : "border-slate-400")}>
                {sel && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
              </div>
              <span className="flex-1">{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
EOF
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- tests/component/AssessmentBubble.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): AssessmentBubble + component test"
```

---

### Task 53: `components/chat/Composer.tsx`

**Files:**
- Create: `components/chat/Composer.tsx`, `tests/component/Composer.test.tsx`

- [ ] **Step 1: Write the test**

```bash
cat > tests/component/Composer.test.tsx <<'EOF'
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "@/components/chat/Composer";

describe("Composer", () => {
  it("submits on Enter and clears", async () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} disabled={false} />);
    const ta = screen.getByPlaceholderText(/your message/i);
    await userEvent.type(ta, "hello");
    fireEvent.keyDown(ta, { key: "Enter", shiftKey: false });
    expect(onSubmit).toHaveBeenCalledWith({ text: "hello" });
  });

  it("does not submit on Shift+Enter", async () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} disabled={false} />);
    const ta = screen.getByPlaceholderText(/your message/i);
    await userEvent.type(ta, "line1");
    fireEvent.keyDown(ta, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
EOF
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- tests/component/Composer.test.tsx
```

- [ ] **Step 3: Implement the component**

```bash
cat > components/chat/Composer.tsx <<'EOF'
"use client";
import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Send } from "lucide-react";

export interface ComposerSubmit { text: string; imageKey?: string }

export function Composer({ disabled, onSubmit, onUpload }: { disabled: boolean; onSubmit: (s: ComposerSubmit) => void; onUpload?: (file: File) => Promise<string> }) {
  const [text, setText] = useState("");
  const [imageKey, setImageKey] = useState<string | undefined>(undefined);
  const [busyUpload, setBusyUpload] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ta.current) {
      ta.current.style.height = "auto";
      ta.current.style.height = `${Math.min(ta.current.scrollHeight, 150)}px`;
    }
  }, [text]);

  const submit = () => {
    if (disabled) return;
    if (!text.trim() && !imageKey) return;
    onSubmit({ text, imageKey });
    setText(""); setImageKey(undefined);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };
  const onFile = async (file: File) => {
    if (!onUpload) return;
    setBusyUpload(true);
    try { setImageKey(await onUpload(file)); } finally { setBusyUpload(false); }
  };

  return (
    <div className="border-t border-slate-200 p-4 pb-6 bg-white">
      <div className="max-w-3xl mx-auto">
        {imageKey && (
          <div className="mb-2 inline-flex items-center bg-slate-100 px-3 py-1 rounded-lg text-xs text-slate-600">
            Image attached
            <button className="ml-2 text-red-500" onClick={() => setImageKey(undefined)}>×</button>
          </div>
        )}
        <div className="flex items-end space-x-3">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl flex items-end focus-within:ring-2 focus-within:ring-primary">
            <label className="p-3 text-slate-400 hover:text-primary cursor-pointer">
              <Paperclip className="w-5 h-5" />
              <input type="file" accept="image/*" hidden disabled={busyUpload} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            </label>
            <textarea
              ref={ta}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type your message…"
              className="w-full py-3 bg-transparent border-none outline-none resize-none max-h-40 min-h-[48px]"
              disabled={disabled}
              rows={1}
            />
          </div>
          <Button type="button" onClick={submit} disabled={disabled || (!text.trim() && !imageKey)} className="h-12 w-12 p-0">
            <Send className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-center mt-2 text-xs text-slate-400">Shift + Enter for new line</p>
      </div>
    </div>
  );
}
EOF
```

- [ ] **Step 4: Run — verify PASS**

```bash
npm test -- tests/component/Composer.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): Composer with paste/upload + tests"
```

---

### Task 54: `components/chat/Sidebar.tsx`

**Files:**
- Create: `components/chat/Sidebar.tsx`

- [ ] **Step 1: Write the sidebar**

```bash
cat > components/chat/Sidebar.tsx <<'EOF'
"use client";
import Link from "vinext/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface ChatItem { id: string; title: string | null; topic: string; lastActiveAt: number; level: string | null }

export function Sidebar({ activeId }: { activeId?: string }) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (c?: string) => {
    setBusy(true);
    try {
      const url = c ? `/api/chats?cursor=${c}` : "/api/chats";
      const r = await fetch(url);
      const data = await r.json();
      setItems((prev) => c ? [...prev, ...data.items] : data.items);
      setCursor(data.nextCursor);
    } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="p-4 border-b">
        <Link href="/chat" className="block px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium text-center">+ New chat</Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((c) => (
          <Link key={c.id} href={`/chat/${c.id}`} className={cn(
            "block px-3 py-2 rounded-lg text-sm truncate",
            c.id === activeId ? "bg-indigo-50 text-primary font-medium" : "hover:bg-slate-50 text-slate-700",
          )}>
            <div className="truncate">{c.title ?? c.topic}</div>
            <div className="text-[10px] text-slate-400">{relative(c.lastActiveAt)}</div>
          </Link>
        ))}
        {cursor && (
          <button onClick={() => load(cursor)} disabled={busy} className="w-full text-xs text-slate-500 py-2">Load more…</button>
        )}
      </nav>
      <div className="p-4 border-t text-xs text-slate-400">
        <Link href="/dashboard" className="block hover:text-primary">Dashboard</Link>
        <Link href="/reports" className="block hover:text-primary">Reports</Link>
        <Link href="/settings" className="block hover:text-primary">Settings</Link>
      </div>
    </aside>
  );
}

function relative(secEpoch: number): string {
  const diff = Math.floor(Date.now() / 1000) - secEpoch;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(ui): chat sidebar with last-active timestamps + pagination"
```

---

### Task 55: `components/chat/ChatView.tsx` + SSE hook

**Files:**
- Create: `components/chat/useChatStream.ts`, `components/chat/ChatView.tsx`

- [ ] **Step 1: Write the SSE hook**

```bash
cat > components/chat/useChatStream.ts <<'EOF'
"use client";
import { useCallback, useRef } from "react";

export interface StreamEventClient {
  type: "delta" | "done" | "error";
  payload: unknown;
}

export function useChatStream(chatId: string) {
  const aborter = useRef<AbortController | null>(null);

  const send = useCallback(async (text: string, imageKey: string | undefined, onEvent: (e: StreamEventClient) => void) => {
    aborter.current?.abort();
    const ac = new AbortController();
    aborter.current = ac;
    const r = await fetch(`/api/chats/${chatId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, image_key: imageKey }),
      signal: ac.signal,
    });
    if (!r.body) return;
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";
      for (const frame of frames) {
        const lines = frame.split("\n");
        const event = lines.find((l) => l.startsWith("event: "))?.slice(7) ?? "delta";
        const data = lines.find((l) => l.startsWith("data: "))?.slice(6);
        if (!data) continue;
        try { onEvent({ type: event as StreamEventClient["type"], payload: JSON.parse(data) }); } catch {}
      }
    }
  }, [chatId]);

  const cancel = useCallback(() => aborter.current?.abort(), []);
  return { send, cancel };
}
EOF
```

- [ ] **Step 2: Write ChatView**

```bash
cat > components/chat/ChatView.tsx <<'EOF'
"use client";
import { useState, useEffect, useRef } from "react";
import { MessageBubble, type UiMessage } from "@/components/chat/MessageBubble";
import { AssessmentBubble } from "@/components/chat/AssessmentBubble";
import { Composer } from "@/components/chat/Composer";
import { useChatStream } from "@/components/chat/useChatStream";
import type { AssessmentQuestion } from "@/lib/ai";

export interface ChatViewProps {
  chatId: string;
  initialMessages: UiMessage[];
  initialQuestion?: AssessmentQuestion;
  level: string | null;
}

export function ChatView({ chatId, initialMessages, initialQuestion, level }: ChatViewProps) {
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [question, setQuestion] = useState<AssessmentQuestion | undefined>(initialQuestion);
  const [pendingSel, setPendingSel] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const stream = useChatStream(chatId);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingText]);

  const onSelect = async (idx: number) => {
    if (!question) return;
    setPendingSel(idx); setBusy(true);
    const r = await fetch(`/api/chats/${chatId}/answer`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ question_id: question.id, option_index: idx }),
    });
    const data = await r.json();
    if (data.next) {
      setQuestion(data.next); setPendingSel(undefined);
    } else if (data.done) {
      setQuestion(undefined); setPendingSel(undefined);
      setMessages((m) => [...m, { id: `level-${Date.now()}`, role: "model", content: `**Level:** ${data.level}\n\n${data.summary}\n\n**Plan:** ${data.recommendedPath}` }]);
    }
    setBusy(false);
  };

  const onSend = async ({ text, imageKey }: { text: string; imageKey?: string }) => {
    setBusy(true);
    const userMsg: UiMessage = { id: `local-${Date.now()}`, role: "user", content: text, imageR2Key: imageKey };
    setMessages((m) => [...m, userMsg]);
    setStreamingText("");
    let acc = "";
    await stream.send(text, imageKey, (ev) => {
      if (ev.type === "delta") {
        const p = ev.payload as { type: string; text?: string; r2Key?: string };
        if (p.type === "text" && p.text) { acc += p.text; setStreamingText(acc); }
        if (p.type === "diagram" && p.r2Key) {
          setMessages((m) => [...m, { id: `diag-${Date.now()}`, role: "model", content: "(diagram)", imageR2Key: p.r2Key, isDiagram: true }]);
        }
      }
      if (ev.type === "done") {
        setMessages((m) => [...m, { id: `bot-${Date.now()}`, role: "model", content: acc }]);
        setStreamingText(""); setBusy(false);
      }
      if (ev.type === "error") {
        setMessages((m) => [...m, { id: `err-${Date.now()}`, role: "model", content: "I hit an error. Please retry." }]);
        setStreamingText(""); setBusy(false);
      }
    });
  };

  const upload = async (file: File): Promise<string> => {
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/uploads", { method: "POST", body: fd });
    const data = await r.json(); return data.key as string;
  };

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-slate-50">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
          {streamingText && (
            <MessageBubble msg={{ id: "streaming", role: "model", content: streamingText }} />
          )}
          {question && (
            <AssessmentBubble question={question} onSelect={onSelect} disabled={busy || pendingSel !== undefined} selectedIndex={pendingSel} />
          )}
          {busy && !streamingText && !question && (
            <div className="flex space-x-1.5 px-2"><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" /><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} /><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} /></div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <Composer disabled={busy || !!question || !level} onSubmit={onSend} onUpload={upload} />
    </div>
  );
}
EOF
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(ui): ChatView + SSE hook wiring"
```

---

### Task 56: `app/chat/page.tsx` (new) and `app/chat/[id]/page.tsx` (resume)

**Files:**
- Create: `app/chat/page.tsx`, `app/chat/[id]/page.tsx`, `components/chat/NewChatLanding.tsx`

- [ ] **Step 1: Write `NewChatLanding.tsx`**

```bash
cat > components/chat/NewChatLanding.tsx <<'EOF'
"use client";
import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function NewChatLanding() {
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/chats", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!r.ok) { setErr("could not start chat"); return; }
      const data = await r.json();
      window.location.href = `/chat/${data.chat.id}`;
    } finally { setBusy(false); }
  };

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <h1 className="text-2xl font-bold text-slate-900">What do you want to learn?</h1>
        <p className="text-sm text-slate-500 mt-1">We'll start with a quick 5-question diagnostic.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="topic">Topic</Label>
            <textarea id="topic" required rows={3} value={topic} onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="e.g., How does gravity work? Linear algebra. Photosynthesis." />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Setting up…" : "Start learning"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
EOF
```

- [ ] **Step 2: Write `app/chat/page.tsx`**

```bash
mkdir -p app/chat "app/chat/[id]"
cat > app/chat/page.tsx <<'EOF'
import { Sidebar } from "@/components/chat/Sidebar";
import { NewChatLanding } from "@/components/chat/NewChatLanding";

export default function NewChatPage() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center p-6">
        <NewChatLanding />
      </main>
    </div>
  );
}
EOF
```

- [ ] **Step 3: Write `app/chat/[id]/page.tsx`**

```bash
cat > "app/chat/[id]/page.tsx" <<'EOF'
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatView } from "@/components/chat/ChatView";
import { headers } from "vinext/headers";
import { parseEnv } from "@/lib/env";
import { db } from "@/lib/db/client";
import { lookupSession, SESSION_COOKIE } from "@/lib/auth/session";
import { getChat } from "@/lib/db/queries/chats";
import { listMessages } from "@/lib/db/queries/messages";
import { getAssessment } from "@/lib/db/queries/assessments";
import { redirect } from "vinext/navigation";
import { getRequestEnv } from "@/lib/server-env";
import type { AssessmentQuestion } from "@/lib/ai";
import type { UiMessage } from "@/components/chat/MessageBubble";

export default async function ChatPage({ params }: { params: { id: string } }) {
  const env = parseEnv(getRequestEnv());
  const cookie = (await headers()).get("cookie") ?? "";
  const match = cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${SESSION_COOKIE}=`));
  const token = match?.split("=").slice(1).join("=");
  if (!token) redirect("/login");
  const dbi = db(env);
  const session = await lookupSession(dbi, token!);
  if (!session) redirect("/login");
  const chat = await getChat(dbi, session.userId, params.id);
  if (!chat) redirect("/chat");

  const [rawMessages, assessment] = await Promise.all([
    listMessages(dbi, env.CONTENT_KEY, chat.id),
    getAssessment(dbi, chat.id),
  ]);
  const initialMessages: UiMessage[] = rawMessages.map((m) => ({ id: m.id, role: m.role, content: m.content, imageR2Key: m.imageR2Key, isDiagram: m.isDiagram }));

  let initialQuestion: AssessmentQuestion | undefined;
  if (assessment && !assessment.completedAt) {
    const qs = JSON.parse(assessment.questionsJson) as AssessmentQuestion[];
    const answered: number[] = assessment.answersJson ? JSON.parse(assessment.answersJson) : [];
    initialQuestion = qs[answered.length];
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar activeId={chat.id} />
      <ChatView chatId={chat.id} initialMessages={initialMessages} initialQuestion={initialQuestion} level={chat.level} />
    </div>
  );
}
EOF
```

- [ ] **Step 4: Manual verification**

```bash
npm run dev
```

Open http://localhost:3000/chat after signing up. Confirm landing form shows. Submit a topic — you should be redirected to `/chat/{id}` and see the first assessment question.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(pages): /chat (new) and /chat/[id] (resume)"
```

## Phase 11 — Reports + PDF

### Task 57: `GET /api/reports` and `GET /api/reports/[id]`

**Files:**
- Create: `app/api/reports/route.ts`, `app/api/reports/[id]/route.ts`

- [ ] **Step 1: List route**

```bash
mkdir -p app/api/reports "app/api/reports/[id]"
cat > app/api/reports/route.ts <<'EOF'
import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { listReportsForUser } from "@/lib/db/queries/reports";
import { PaginationSchema } from "@shared/validation";

export const GET = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const url = new URL(req.url);
    const { cursor, limit } = PaginationSchema.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const page = await listReportsForUser(db, user.userId, cursor, limit);
    return new Response(JSON.stringify(page), { headers: { "content-type": "application/json" } });
  });
EOF
```

- [ ] **Step 2: Detail route**

```bash
cat > "app/api/reports/[id]/route.ts" <<'EOF'
import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getReport } from "@/lib/db/queries/reports";
import { AppError } from "@/lib/errors";

export const GET = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const r = await getReport(db, user.userId, ctx.params.id);
    if (!r) throw new AppError("NOT_FOUND", "report not found");
    return new Response(JSON.stringify(r), { headers: { "content-type": "application/json" } });
  });
EOF
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): list + get reports"
```

---

### Task 58: `POST /api/reports/[id]/regenerate`

**Files:**
- Create: `app/api/reports/[id]/regenerate/route.ts`, `lib/reports.ts`

- [ ] **Step 1: Write `lib/reports.ts`**

```bash
cat > lib/reports.ts <<'EOF'
import type { AppEnv } from "@/lib/env";
import { aiRun, TUTOR_MODEL } from "@/lib/ai/client";
import type { TutorTurn } from "@/lib/ai";

export async function generateProgressMarkdown(env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">, topic: string, level: string, history: TutorTurn[]): Promise<{ title: string; contentMd: string }> {
  const transcript = history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n").slice(0, 30000);
  const res = await aiRun<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>(env, TUTOR_MODEL, {
    contents: [{ role: "user", parts: [{ text: `You are summarising tutoring progress.

Topic: ${topic}
Student level: ${level}

Recent conversation:
${transcript}

Write a markdown progress report with these sections:
- # Progress Report — ${topic}
- ## What You've Learned (bullet list of concepts mastered)
- ## Open Questions (bullet list of things still ambiguous)
- ## Suggested Next Topics (bullet list, 3-5)
` }] }],
    generationConfig: { responseMimeType: "text/plain", maxOutputTokens: 1200 },
  });
  const md = (res.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  return { title: `Progress — ${topic}`, contentMd: md };
}
EOF
```

- [ ] **Step 2: Write the regenerate route**

```bash
mkdir -p "app/api/reports/[id]/regenerate"
cat > "app/api/reports/[id]/regenerate/route.ts" <<'EOF'
import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getReport, createReport } from "@/lib/db/queries/reports";
import { getChat } from "@/lib/db/queries/chats";
import { listMessages } from "@/lib/db/queries/messages";
import { generateProgressMarkdown } from "@/lib/reports";
import { AppError } from "@/lib/errors";
import { schema } from "@/lib/db/client";
import { eq, desc } from "drizzle-orm";

export const POST = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const existing = await getReport(db, user.userId, ctx.params.id);
    if (!existing) throw new AppError("NOT_FOUND", "report not found");
    const chat = await getChat(db, user.userId, existing.chatId);
    if (!chat) throw new AppError("NOT_FOUND", "chat missing");

    const messages = await listMessages(db, env.CONTENT_KEY, chat.id);
    const turns = messages.map((m) => ({ role: m.role, content: m.content }));

    const latest = await db.select().from(schema.reports)
      .where(eq(schema.reports.chatId, chat.id))
      .orderBy(desc(schema.reports.version)).limit(1);
    const nextVersion = (latest[0]?.version ?? 0) + 1;

    if (existing.kind !== "progress") throw new AppError("VALIDATION", "only progress reports can be regenerated");
    const { title, contentMd } = await generateProgressMarkdown(env, chat.topic, chat.level ?? "Beginner", turns);
    const fresh = await createReport(db, { chatId: chat.id, userId: user.userId, kind: "progress", title, contentMd, version: nextVersion });
    return new Response(JSON.stringify(fresh), { status: 201, headers: { "content-type": "application/json" } });
  });
EOF
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): regenerate progress report (creates new version row)"
```

---

### Task 59: `lib/pdf.ts` — Browser Rendering wrapper

**Files:**
- Create: `lib/pdf.ts`

- [ ] **Step 1: Write the PDF helper**

```bash
cat > lib/pdf.ts <<'EOF'
import puppeteer from "@cloudflare/puppeteer";
import type { AppEnv } from "@/lib/env";

export async function renderMarkdownToPdf(env: Pick<AppEnv, "BROWSER">, html: string): Promise<ArrayBuffer> {
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "letter", margin: { top: "1in", bottom: "1in", left: "0.8in", right: "0.8in" }, printBackground: true });
    return pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
  } finally {
    await browser.close();
  }
}

export function reportHtml(title: string, markdownAsHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 0 auto; color: #0f172a; line-height: 1.6; }
  h1 { color: #4F46E5; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  h2 { color: #334155; margin-top: 28px; }
  pre, code { background: #f1f5f9; padding: 8px 12px; border-radius: 6px; }
  ul { padding-left: 22px; }
  blockquote { border-left: 4px solid #e2e8f0; padding-left: 12px; color: #475569; }
</style></head><body>${markdownAsHtml}</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as const)[c] ?? c);
}
EOF
```

- [ ] **Step 2: Install puppeteer for Workers**

```bash
npm install @cloudflare/puppeteer
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(pdf): Browser Rendering wrapper for markdown reports"
```

---

### Task 60: `POST /api/reports/[id]/pdf`

**Files:**
- Create: `app/api/reports/[id]/pdf/route.ts`

- [ ] **Step 1: Write the route**

```bash
mkdir -p "app/api/reports/[id]/pdf"
cat > "app/api/reports/[id]/pdf/route.ts" <<'EOF'
import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getReport, setReportPdfKey } from "@/lib/db/queries/reports";
import { renderMarkdownToPdf, reportHtml } from "@/lib/pdf";
import { putReportPdf } from "@/lib/r2";
import { marked } from "marked";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const { success } = await env.RATE_LIMITER_PDF.limit({ key: `u:${user.userId}` });
    if (!success) throw new AppError("RATE_LIMITED", "PDF rate limit");
    const r = await getReport(db, user.userId, ctx.params.id);
    if (!r) throw new AppError("NOT_FOUND", "report not found");

    if (r.pdfR2Key) {
      const obj = await env.R2.get(r.pdfR2Key);
      if (obj) return new Response(obj.body, { headers: { "content-type": "application/pdf" } });
    }
    const html = reportHtml(r.title, marked.parse(r.contentMd) as string);
    const pdf = await renderMarkdownToPdf(env, html);
    const key = await putReportPdf(env, user.userId, r.id, r.version, pdf);
    await setReportPdfKey(db, r.id, key);
    return new Response(pdf, { headers: { "content-type": "application/pdf" } });
  });
EOF
```

- [ ] **Step 2: Install marked**

```bash
npm install marked
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): generate + cache report PDFs in R2"
```

---

### Task 61: `app/reports/page.tsx` (list)

**Files:**
- Create: `app/reports/page.tsx`, `components/reports/ReportsList.tsx`

- [ ] **Step 1: Write the list component**

```bash
mkdir -p components/reports app/reports
cat > components/reports/ReportsList.tsx <<'EOF'
"use client";
import Link from "vinext/link";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface ReportItem { id: string; title: string; kind: string; version: number; createdAt: number }

export function ReportsList() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async (c?: string) => {
    setBusy(true);
    try {
      const r = await fetch(c ? `/api/reports?cursor=${c}` : "/api/reports");
      const data = await r.json();
      setItems((p) => c ? [...p, ...data.items] : data.items);
      setCursor(data.nextCursor);
    } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-3">
      {items.length === 0 && !busy && <p className="text-slate-500">No reports yet — finish a topic to generate one.</p>}
      {items.map((it) => (
        <Link key={it.id} href={`/reports/${it.id}`}>
          <Card className="hover:bg-slate-50 transition">
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="font-medium">{it.title}</div>
                <div className="text-xs text-slate-500">{it.kind} · v{it.version} · {new Date(it.createdAt * 1000).toLocaleString()}</div>
              </div>
              <span className="text-primary text-sm">Open →</span>
            </CardContent>
          </Card>
        </Link>
      ))}
      {cursor && <button onClick={() => load(cursor)} disabled={busy} className="text-sm text-slate-500">Load more…</button>}
    </div>
  );
}
EOF
```

- [ ] **Step 2: Write the page**

```bash
cat > app/reports/page.tsx <<'EOF'
import { Sidebar } from "@/components/chat/Sidebar";
import { ReportsList } from "@/components/reports/ReportsList";

export default function ReportsPage() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Reports</h1>
        <ReportsList />
      </main>
    </div>
  );
}
EOF
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(pages): /reports list"
```

---

### Task 62: `app/reports/[id]/page.tsx` (detail + PDF)

**Files:**
- Create: `app/reports/[id]/page.tsx`, `components/reports/ReportView.tsx`

- [ ] **Step 1: Write the view component**

```bash
mkdir -p "app/reports/[id]"
cat > components/reports/ReportView.tsx <<'EOF'
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";

interface Props { id: string; title: string; kind: string; version: number; contentMd: string; canRegenerate: boolean }

export function ReportView({ id, title, kind, version, contentMd, canRegenerate }: Props) {
  const [busy, setBusy] = useState(false);

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/reports/${id}/pdf`, { method: "POST", headers: { origin: window.location.origin } });
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${title}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/reports/${id}/regenerate`, { method: "POST", headers: { "content-type": "application/json", origin: window.location.origin }, body: JSON.stringify({ kind: "progress" }) });
      if (!r.ok) return;
      const fresh = await r.json();
      window.location.href = `/reports/${fresh.id}`;
    } finally { setBusy(false); }
  };

  return (
    <article className="prose max-w-none">
      <header className="not-prose mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-xs text-slate-500">{kind} · v{version}</p>
        </div>
        <div className="flex space-x-2">
          {canRegenerate && <Button variant="outline" onClick={regenerate} disabled={busy}>Regenerate</Button>}
          <Button onClick={downloadPdf} disabled={busy}>{busy ? "Working…" : "Download PDF"}</Button>
        </div>
      </header>
      <MarkdownRenderer content={contentMd} />
    </article>
  );
}
EOF
```

- [ ] **Step 2: Write the page**

```bash
cat > "app/reports/[id]/page.tsx" <<'EOF'
import { Sidebar } from "@/components/chat/Sidebar";
import { ReportView } from "@/components/reports/ReportView";
import { redirect } from "vinext/navigation";
import { headers } from "vinext/headers";
import { parseEnv } from "@/lib/env";
import { db } from "@/lib/db/client";
import { lookupSession, SESSION_COOKIE } from "@/lib/auth/session";
import { getReport } from "@/lib/db/queries/reports";
import { getRequestEnv } from "@/lib/server-env";

export default async function ReportPage({ params }: { params: { id: string } }) {
  const env = parseEnv(getRequestEnv());
  const cookie = (await headers()).get("cookie") ?? "";
  const match = cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${SESSION_COOKIE}=`));
  const token = match?.split("=").slice(1).join("=");
  if (!token) redirect("/login");
  const dbi = db(env);
  const session = await lookupSession(dbi, token!);
  if (!session) redirect("/login");
  const r = await getReport(dbi, session.userId, params.id);
  if (!r) redirect("/reports");
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-8 max-w-3xl">
        <ReportView id={r.id} title={r.title} kind={r.kind} version={r.version} contentMd={r.contentMd} canRegenerate={r.kind === "progress"} />
      </main>
    </div>
  );
}
EOF
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(pages): /reports/[id] with PDF download + regenerate"
```

---

### Task 63: Trigger progress report from chat (manual button on ChatView)

Goal: a button in the chat header that creates a progress report on demand.

**Files:**
- Create: `app/api/chats/[id]/reports/route.ts`
- Modify: `components/chat/ChatView.tsx` (add a "Save progress report" button)

- [ ] **Step 1: Write the route**

```bash
mkdir -p "app/api/chats/[id]/reports"
cat > "app/api/chats/[id]/reports/route.ts" <<'EOF'
import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getChat } from "@/lib/db/queries/chats";
import { listMessages } from "@/lib/db/queries/messages";
import { createReport } from "@/lib/db/queries/reports";
import { generateProgressMarkdown } from "@/lib/reports";
import { ReportRegenerateSchema } from "@shared/validation";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const { kind } = await readJson(req, ReportRegenerateSchema);
    if (kind !== "progress") throw new AppError("VALIDATION", "only progress supported here");
    const chat = await getChat(db, user.userId, ctx.params.id);
    if (!chat) throw new AppError("NOT_FOUND", "chat not found");
    const msgs = await listMessages(db, env.CONTENT_KEY, chat.id);
    const turns = msgs.map((m) => ({ role: m.role, content: m.content }));
    const { title, contentMd } = await generateProgressMarkdown(env, chat.topic, chat.level ?? "Beginner", turns);
    const r = await createReport(db, { chatId: chat.id, userId: user.userId, kind: "progress", title, contentMd });
    return new Response(JSON.stringify(r), { status: 201, headers: { "content-type": "application/json" } });
  });
EOF
```

- [ ] **Step 2: Add button to ChatView header**

Open `components/chat/ChatView.tsx` and add the following just inside the outer `<div className="flex flex-col flex-1 ...">` element, before the messages list:

```tsx
<div className="border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
  <div className="text-sm text-slate-500">Tutoring chat</div>
  <button
    onClick={async () => {
      const r = await fetch(`/api/chats/${chatId}/reports`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: window.location.origin },
        body: JSON.stringify({ kind: "progress" }),
      });
      if (r.ok) {
        const data = await r.json();
        window.location.href = `/reports/${data.id}`;
      }
    }}
    className="text-sm text-primary hover:underline"
  >
    Save progress report
  </button>
</div>
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

In an active chat, click "Save progress report" — confirm you land on the new report's detail page.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(chat): on-demand progress report button"
```

## Phase 12 — Dashboard

### Task 64: `GET /api/dashboard`

**Files:**
- Create: `app/api/dashboard/route.ts`, `lib/db/queries/dashboard.ts`

- [ ] **Step 1: Write the dashboard query**

```bash
cat > lib/db/queries/dashboard.ts <<'EOF'
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { schema, type DB } from "@/lib/db/client";

export interface DashboardStats {
  totalChats: number;
  activeChats: number;
  completedChats: number;
  totalReports: number;
  recentChats: { id: string; title: string | null; topic: string; level: string | null; lastActiveAt: number }[];
}

export async function getDashboard(db: DB, userId: string): Promise<DashboardStats> {
  const totals = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${schema.chats.status} = 'active' then 1 else 0 end)`,
      completed: sql<number>`sum(case when ${schema.chats.status} = 'completed' then 1 else 0 end)`,
    })
    .from(schema.chats)
    .where(and(eq(schema.chats.userId, userId), isNull(schema.chats.deletedAt)));

  const reports = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.reports)
    .where(and(eq(schema.reports.userId, userId), isNull(schema.reports.deletedAt)));

  const recent = await db.select({
    id: schema.chats.id, title: schema.chats.title, topic: schema.chats.topic, level: schema.chats.level, lastActiveAt: schema.chats.lastActiveAt,
  })
    .from(schema.chats)
    .where(and(eq(schema.chats.userId, userId), isNull(schema.chats.deletedAt)))
    .orderBy(desc(schema.chats.lastActiveAt)).limit(5);

  return {
    totalChats: Number(totals[0]?.total ?? 0),
    activeChats: Number(totals[0]?.active ?? 0),
    completedChats: Number(totals[0]?.completed ?? 0),
    totalReports: Number(reports[0]?.total ?? 0),
    recentChats: recent,
  };
}
EOF
```

- [ ] **Step 2: Write the route**

```bash
mkdir -p app/api/dashboard
cat > app/api/dashboard/route.ts <<'EOF'
import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getDashboard } from "@/lib/db/queries/dashboard";

export const GET = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const stats = await getDashboard(db, user.userId);
    return new Response(JSON.stringify(stats), { headers: { "content-type": "application/json" } });
  });
EOF
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): dashboard aggregates"
```

---

### Task 65: `app/dashboard/page.tsx`

**Files:**
- Create: `app/dashboard/page.tsx`, `components/dashboard/DashboardView.tsx`

- [ ] **Step 1: Write the view**

```bash
mkdir -p components/dashboard app/dashboard
cat > components/dashboard/DashboardView.tsx <<'EOF'
"use client";
import { useEffect, useState } from "react";
import Link from "vinext/link";
import { Card, CardContent } from "@/components/ui/card";

interface Stats {
  totalChats: number; activeChats: number; completedChats: number; totalReports: number;
  recentChats: { id: string; title: string | null; topic: string; level: string | null; lastActiveAt: number }[];
}

export function DashboardView() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { (async () => setS(await (await fetch("/api/dashboard")).json()))(); }, []);
  if (!s) return <p className="text-slate-500">Loading…</p>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Total chats" value={s.totalChats} />
        <Stat label="Active" value={s.activeChats} />
        <Stat label="Completed" value={s.completedChats} />
        <Stat label="Reports" value={s.totalReports} />
      </div>
      <h2 className="text-lg font-semibold mt-8">Recent chats</h2>
      <div className="space-y-2">
        {s.recentChats.map((c) => (
          <Link key={c.id} href={`/chat/${c.id}`}>
            <Card className="hover:bg-slate-50 transition">
              <CardContent>
                <div className="font-medium">{c.title ?? c.topic}</div>
                <div className="text-xs text-slate-500">{c.level ?? "no level yet"} · {new Date(c.lastActiveAt * 1000).toLocaleString()}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      </CardContent>
    </Card>
  );
}
EOF
```

- [ ] **Step 2: Write the page**

```bash
cat > app/dashboard/page.tsx <<'EOF'
import { Sidebar } from "@/components/chat/Sidebar";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <DashboardView />
      </main>
    </div>
  );
}
EOF
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

Open http://localhost:3000/dashboard — confirm stats render.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(pages): /dashboard with aggregate stats"
```

## Phase 13 — Account settings + GDPR

### Task 66: `PATCH /api/auth/me` + `POST /api/auth/password`

**Files:**
- Create: `app/api/auth/password/route.ts`
- Modify: `app/api/auth/me/route.ts` (add PATCH)

- [ ] **Step 1: Add PATCH to me route**

```bash
cat > app/api/auth/me/route.ts <<'EOF'
import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { ProfileUpdateSchema } from "@shared/validation";

export const GET = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (user.rotatedCookie) headers["set-cookie"] = user.rotatedCookie;
    return new Response(JSON.stringify({ id: user.userId, email: user.email }), { headers });
  });

export const PATCH = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const input = await readJson(req, ProfileUpdateSchema);
    if (input.display_name !== undefined) {
      await db.update(schema.users).set({ displayName: input.display_name }).where(eq(schema.users.id, user.userId));
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  });
EOF
```

- [ ] **Step 2: Write the password change route**

```bash
mkdir -p app/api/auth/password
cat > app/api/auth/password/route.ts <<'EOF'
import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { PasswordChangeSchema } from "@shared/validation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { findUserById, updatePasswordHash } from "@/lib/db/queries/auth";
import { revokeAllSessions, issueSession, buildSessionCookie } from "@/lib/auth/session";
import { recordAudit } from "@/lib/db/queries/audit";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const input = await readJson(req, PasswordChangeSchema);
    const row = await findUserById(db, user.userId);
    if (!row) throw new AppError("UNAUTHORIZED", "user gone");
    const ok = await verifyPassword(input.current_password, row.passwordHash);
    if (!ok) throw new AppError("UNAUTHORIZED", "current password wrong");
    const fresh = await hashPassword(input.new_password);
    await updatePasswordHash(db, user.userId, fresh);
    await revokeAllSessions(db, user.userId);
    const { token } = await issueSession(db, { userId: user.userId });
    await recordAudit(db, { userId: user.userId, event: "password_change" });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", "set-cookie": buildSessionCookie(token) },
    });
  });
EOF
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): profile PATCH + password change with session rotation"
```

---

### Task 67: `DELETE /api/auth/me` (soft-delete + session purge)

**Files:**
- Modify: `app/api/auth/me/route.ts` (add DELETE)

- [ ] **Step 1: Append DELETE to `app/api/auth/me/route.ts`**

Open the file and add this export:

```ts
import { softDeleteUser } from "@/lib/db/queries/auth";
import { revokeAllSessions, buildClearCookie } from "@/lib/auth/session";
import { recordAudit } from "@/lib/db/queries/audit";

export const DELETE = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    await softDeleteUser(db, user.userId);
    await revokeAllSessions(db, user.userId);
    await recordAudit(db, { userId: user.userId, event: "account_delete" });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", "set-cookie": buildClearCookie() },
    });
  });
```

(Place at the bottom of the file. Existing imports already cover `withRoute`, `requireUser`, etc. — add the three new imports above.)

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): DELETE /api/auth/me soft-deletes account"
```

---

### Task 68: `GET /api/auth/me/export` (GDPR data dump)

**Files:**
- Create: `app/api/auth/me/export/route.ts`

- [ ] **Step 1: Write the export route**

```bash
mkdir -p app/api/auth/me/export
cat > app/api/auth/me/export/route.ts <<'EOF'
import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { listMessages } from "@/lib/db/queries/messages";
import { recordAudit } from "@/lib/db/queries/audit";

export const GET = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const u = await db.query.users.findFirst({ where: eq(schema.users.id, user.userId) });
    const chats = await db.select().from(schema.chats).where(eq(schema.chats.userId, user.userId));
    const reports = await db.select().from(schema.reports).where(eq(schema.reports.userId, user.userId));
    const allMessages: { chatId: string; messages: unknown[] }[] = [];
    for (const c of chats) {
      const msgs = await listMessages(db, env.CONTENT_KEY, c.id);
      allMessages.push({ chatId: c.id, messages: msgs });
    }
    const blob = {
      exportedAt: new Date().toISOString(),
      user: u ? { id: u.id, email: u.email, displayName: u.displayName, createdAt: u.createdAt } : null,
      chats, reports, messagesByChat: allMessages,
    };
    await recordAudit(db, { userId: user.userId, event: "data_export" });
    return new Response(JSON.stringify(blob, null, 2), {
      headers: { "content-type": "application/json", "content-disposition": "attachment; filename=profai-export.json" },
    });
  });
EOF
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(api): GDPR data export endpoint"
```

---

### Task 69: `app/settings/page.tsx`

**Files:**
- Create: `app/settings/page.tsx`, `components/settings/SettingsView.tsx`

- [ ] **Step 1: Write the view**

```bash
mkdir -p components/settings app/settings
cat > components/settings/SettingsView.tsx <<'EOF'
"use client";
import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function SettingsView({ email }: { email: string }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Account</h2></CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">Email: <strong>{email}</strong></p>
          <p className="text-xs text-slate-400 mt-1">Sessions are 30-day sliding. Changing your password signs you out everywhere else.</p>
        </CardContent>
      </Card>
      <PasswordCard />
      <ExportCard />
      <DangerZone />
    </div>
  );
}

function PasswordCard() {
  const [cur, setCur] = useState(""); const [nu, setNu] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null); setErr(null);
    const r = await fetch("/api/auth/password", { method: "POST", headers: { "content-type": "application/json", origin: window.location.origin }, body: JSON.stringify({ current_password: cur, new_password: nu }) });
    if (r.ok) { setMsg("Password updated."); setCur(""); setNu(""); } else {
      const body = await r.json().catch(() => ({}));
      setErr(body?.error?.message ?? "failed");
    }
    setBusy(false);
  };
  return (
    <Card>
      <CardHeader><h2 className="text-lg font-semibold">Change password</h2></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3 max-w-md">
          <div><Label>Current</Label><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
          <div><Label>New (min 10)</Label><Input type="password" minLength={10} value={nu} onChange={(e) => setNu(e.target.value)} required /></div>
          {msg && <p className="text-sm text-green-700">{msg}</p>}
          {err && <Alert>{err}</Alert>}
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Change password"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ExportCard() {
  return (
    <Card>
      <CardHeader><h2 className="text-lg font-semibold">Export your data</h2></CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 mb-3">Download a JSON copy of your profile, chats, messages, and reports.</p>
        <Button variant="outline" asChild><a href="/api/auth/me/export">Download export</a></Button>
      </CardContent>
    </Card>
  );
}

function DangerZone() {
  const [confirm, setConfirm] = useState("");
  const del = async () => {
    if (confirm !== "delete my account") return;
    const r = await fetch("/api/auth/me", { method: "DELETE", headers: { origin: window.location.origin } });
    if (r.ok) window.location.href = "/login";
  };
  return (
    <Card className="border-red-200">
      <CardHeader><h2 className="text-lg font-semibold text-red-700">Danger zone</h2></CardHeader>
      <CardContent className="space-y-3 max-w-md">
        <p className="text-sm text-slate-600">Type <code>delete my account</code> below to permanently delete.</p>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button variant="destructive" onClick={del} disabled={confirm !== "delete my account"}>Delete account</Button>
      </CardContent>
    </Card>
  );
}
EOF
```

- [ ] **Step 2: Write the page**

```bash
cat > app/settings/page.tsx <<'EOF'
import { Sidebar } from "@/components/chat/Sidebar";
import { SettingsView } from "@/components/settings/SettingsView";
import { redirect } from "vinext/navigation";
import { headers } from "vinext/headers";
import { parseEnv } from "@/lib/env";
import { db } from "@/lib/db/client";
import { lookupSession, SESSION_COOKIE } from "@/lib/auth/session";
import { findUserById } from "@/lib/db/queries/auth";
import { getRequestEnv } from "@/lib/server-env";

export default async function SettingsPage() {
  const env = parseEnv(getRequestEnv());
  const cookie = (await headers()).get("cookie") ?? "";
  const match = cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${SESSION_COOKIE}=`));
  const token = match?.split("=").slice(1).join("=");
  if (!token) redirect("/login");
  const dbi = db(env);
  const session = await lookupSession(dbi, token!);
  if (!session) redirect("/login");
  const user = await findUserById(dbi, session.userId);
  if (!user) redirect("/login");
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <SettingsView email={user.email} />
      </main>
    </div>
  );
}
EOF
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

Open http://localhost:3000/settings — confirm sections render and password change sequence works.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(pages): /settings (profile, password, export, delete)"
```

---

### Task 70: Logout button in sidebar

**Files:**
- Modify: `components/chat/Sidebar.tsx`

- [ ] **Step 1: Open the file and add a logout button at the bottom of the footer block**

Replace the footer block in `Sidebar.tsx`:

```tsx
<div className="p-4 border-t text-xs text-slate-400 space-y-1">
  <Link href="/dashboard" className="block hover:text-primary">Dashboard</Link>
  <Link href="/reports" className="block hover:text-primary">Reports</Link>
  <Link href="/settings" className="block hover:text-primary">Settings</Link>
  <button
    onClick={async () => {
      await fetch("/api/auth/logout", { method: "POST", headers: { origin: window.location.origin } });
      window.location.href = "/login";
    }}
    className="block hover:text-red-600 text-left w-full"
  >
    Logout
  </button>
</div>
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(ui): logout button in sidebar"
```

## Phase 14 — Cleanup, e2e, CI, deploy

### Task 71: Move legacy prompt history to `lib/ai/prompts/legacy/`

**Files:**
- Move: `migrated_prompt_history/` → `lib/ai/prompts/legacy/`

- [ ] **Step 1: Inspect and move**

```bash
ls migrated_prompt_history/
mkdir -p lib/ai/prompts/legacy
git mv migrated_prompt_history/* lib/ai/prompts/legacy/ 2>/dev/null || mv migrated_prompt_history/* lib/ai/prompts/legacy/
rmdir migrated_prompt_history
```

- [ ] **Step 2: Confirm `legacy/` is referenced nowhere at runtime**

```bash
grep -rn "migrated_prompt_history\|prompts/legacy" lib app components shared
```

Expected: no matches (the directory is documentation-only, not imported).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: relocate legacy prompt notes under lib/ai/prompts/legacy"
```

---

### Task 72: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the README**

```bash
cat > README.md <<'EOF'
# ProfAI v2 — Cloudflare-native AI tutor

Adaptive AI tutor: tell it a topic, take a 5-question diagnostic, then learn through a Socratic chat with auto-generated diagrams. Multi-chat history, saved reports with PDF export, dashboard.

## Stack

- **Frontend:** vinext (Next.js API surface on Vite), React 19, Tailwind, shadcn/ui
- **Backend:** Same Worker via vinext route handlers
- **DB:** Cloudflare D1 (SQLite) via drizzle-orm
- **Storage:** R2 for images and PDFs
- **AI:** `env.AI.run("google/gemini-3-flash", ...)` and `@cf/black-forest-labs/flux-1-schnell`
- **PDF:** Cloudflare Browser Rendering (`@cloudflare/puppeteer`)
- **Auth:** email/password, scrypt hashing, D1-backed session tokens, `__Host-` cookie

## Local development

```bash
cp .dev.vars.example .dev.vars
# Fill in CONTENT_KEY (openssl rand -base64 32), IP_HASH_SALT, AI_GATEWAY_GOOGLE_API_KEY

npm install
npx wrangler d1 create profai_db          # paste UUID into wrangler.jsonc
npx wrangler kv namespace create profai_kv  # paste id into wrangler.jsonc
npx wrangler r2 bucket create profai-uploads
npm run db:migrate:local
npm run dev                                  # http://localhost:3000
```

## Tests

```bash
npm test                  # unit + component
npm run test:integration  # miniflare-backed integration
npm run test:e2e          # Playwright smoke (requires wrangler dev running)
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
wrangler secret put TURNSTILE_SECRET_KEY  # optional
```

## Architecture & specs

- Spec: `docs/superpowers/specs/2026-04-26-profai-v2-cloudflare-rewrite-design.md`
- Plan: `docs/superpowers/plans/2026-04-26-profai-v2-cloudflare-rewrite.md`
EOF
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: rewrite README for v2"
```

---

### Task 73: Playwright config + e2e smoke

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/profai.spec.ts`

- [ ] **Step 1: Write `playwright.config.ts`**

```bash
cat > playwright.config.ts <<'EOF'
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
EOF
```

- [ ] **Step 2: Install playwright browsers**

```bash
npx playwright install chromium
```

- [ ] **Step 3: Write the e2e smoke test**

```bash
cat > tests/e2e/profai.spec.ts <<'EOF'
import { test, expect } from "@playwright/test";

test("signup → topic → first assessment question → resume after refresh", async ({ page }) => {
  const email = `e2e-${Date.now()}@test.local`;

  await page.goto("/signup");
  await page.fill("#email", email);
  await page.fill("#password", "correct-horse-battery-staple");
  await page.click('button[type="submit"]');

  await page.waitForURL("**/chat", { timeout: 30_000 });
  await page.fill("#topic", "Pythagoras' theorem");
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/chat\/[A-Z0-9]+/i, { timeout: 60_000 });
  await expect(page.getByText(/Assessment Question/i).first()).toBeVisible({ timeout: 60_000 });

  const url = page.url();
  await page.reload();
  expect(page.url()).toBe(url);
  await expect(page.getByText(/Assessment Question/i).first()).toBeVisible({ timeout: 30_000 });
});
EOF
```

- [ ] **Step 4: Run the e2e smoke test**

```bash
npm run test:e2e
```

Expected: 1 test PASS. (Note: requires `AI_GATEWAY_GOOGLE_API_KEY` set in `.dev.vars` to actually generate questions. If running fully offline, the assertion will time out and you should mark this expected.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(e2e): playwright smoke for signup → topic → assessment"
```

---

### Task 74: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```bash
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run test:integration

  e2e:
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run db:migrate:local
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      - run: npm run test:e2e
        env:
          CONTENT_KEY: ${{ secrets.TEST_CONTENT_KEY }}
          IP_HASH_SALT: test-salt
          AI_GATEWAY_GOOGLE_API_KEY: ${{ secrets.TEST_AI_KEY }}
EOF
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "ci: lint + typecheck + tests + integration on PR; e2e on PR"
```

---

### Task 75: Production deploy dry-run + first deploy

**Files:** none (operational)

- [ ] **Step 1: Run a production build locally**

```bash
npm run build
```

Expected: `.vinext/` populated, no errors.

- [ ] **Step 2: Apply migrations to remote D1**

```bash
npm run db:migrate:remote
```

Expected: migrations apply.

- [ ] **Step 3: Set production secrets**

```bash
npx wrangler secret put CONTENT_KEY      # openssl rand -base64 32
npx wrangler secret put IP_HASH_SALT     # any random string
npx wrangler secret put AI_GATEWAY_GOOGLE_API_KEY  # from Google AI Studio
# optional:
# npx wrangler secret put TURNSTILE_SECRET_KEY
```

- [ ] **Step 4: Deploy**

```bash
npm run deploy
```

Expected: prints the `*.workers.dev` URL. Open it; confirm `/login` renders.

- [ ] **Step 5: Smoke-test prod**

Sign up, start a topic, confirm assessment generates. Then verify the bundle has no AI key:

```bash
curl -s "$(wrangler deployments list | head -2 | tail -1 | awk '{print $NF}')" | head -c 0
```

(Or open Network tab → JS bundle → search for "googleapis" or any key fragment — should be absent.)

- [ ] **Step 6: Commit any deploy notes**

```bash
git add -A
git commit -m "chore: first production deploy" --allow-empty
```

---

### Task 76: Acceptance check

Final checklist — run through before declaring v2 shipped.

- [ ] Sign up new user → redirected to `/chat`.
- [ ] Submit a topic → 5-question assessment appears, one at a time.
- [ ] Answer all 5 → level + summary message + saved assessment report.
- [ ] Send a chat message → SSE-streamed reply in real time.
- [ ] Trigger a diagram via a question that benefits from one (e.g., "draw the protein folding").
- [ ] Sidebar shows the chat with a generated title and "just now" timestamp.
- [ ] Click "Save progress report" → land on `/reports/[id]`.
- [ ] "Download PDF" returns a real PDF file, second download is instant (cache).
- [ ] `/dashboard` shows correct counts.
- [ ] `/settings`: change password → forced re-login on other tabs.
- [ ] `/settings`: download data export → JSON file downloads.
- [ ] Log out from sidebar → cookie cleared, redirect to `/login`.
- [ ] Inspect built JS — no AI keys, no DB credentials.
- [ ] `npm run lint && npm run typecheck && npm test && npm run test:integration` all green.
- [ ] No file in `lib/`, `app/`, or `components/` exceeds 300 lines (verify with `find . -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -n | tail -20`).

Final commit:

```bash
git add -A
git commit --allow-empty -m "chore: ProfAI v2 acceptance pass"
```

---

## Self-review notes

This plan was self-reviewed against the spec on 2026-04-26.

**Spec coverage:** every section of the design doc maps to at least one task:

| Spec § | Plan task(s) |
|---|---|
| 1 Goal / 15 Acceptance | Task 76 |
| 3 Architecture, 4 Tech | Tasks 1–7 |
| 3.1 vinext fallback | Documented in plan header; falling back is a re-do, not a code change |
| 5 AI integration | Tasks 33–39 |
| 5.1 Long-history strategy | Task 39 (`trimHistory`, `summariseHistory`), Task 47 |
| 5.2 `lib/ai/` split | Tasks 33–39 |
| 6 D1 schema + indexes | Task 12 |
| 6.1 `email COLLATE NOCASE` | Task 13 (sed patch) |
| 6.2 KV unused | wrangler.jsonc declares it (Task 3); no code consumes it |
| 6.3 R2 layout + proxy | Tasks 30, 32 |
| 7.1 scrypt | Task 16 |
| 7.2 session token + `__Host-` cookie | Task 17 |
| 7.3 sliding renewal | Task 17 (renewSession), Task 18 (require) |
| 7.4 Origin CSRF | Task 18 |
| 7.5 AES-GCM at-rest | Tasks 40, 42 |
| 7.6 abuse / rate limits / Turnstile | Tasks 3, 21, 22, 23, 31, 47, 60 |
| 7.7 upload validation | Tasks 30, 31 |
| 8 API surface | Tasks 22–24, 31–32, 44–48, 57–58, 60, 63, 64, 66–68 |
| 9 SSE pattern | Tasks 38, 47 |
| 10 File structure | Mirrored throughout; verify with the line-count check in Task 76 |
| 11 UX surfacing | Tasks 27, 54, 69, 70 |
| 12 Test plan | Tasks 8–11, 16, 25, 30, 40, 49, 52, 53, 73, 74 |
| 13 Migration plan | Tasks 1, 71 |
| 14 Risks | Documented in spec; mitigations are present in Tasks 33 (retries), 39 (history trim), 47 (rate limit), 30 (MIME) |

**Placeholder scan:** no TBDs, no "implement later" stubs, no "similar to Task N" hand-waves. Two operationally-ambiguous notes are deliberately flagged: (a) `lib/server-env.ts` (Task 29) names the env-access pattern that may shift across vinext minor versions — it concentrates the change to one file; (b) `lib/r2.ts` EXIF strip (Task 30) is best-effort under Workers' constraint, conservatively documented.

**Type consistency check:** spot-checked the names that flow across tasks — `AppEnv`, `AppError`, `AssessmentQuestion`, `MessageRow`, `UiMessage`, `StreamEvent`, `RouteCtx`, `requireUser`, `withRoute`, `aiRun`, `streamTutorReply`, `trimHistory`, `appendMessage`, `listMessages`, `getChat`, `createReport`, `getReport`, `listReportsForUser`, `setReportPdfKey` — all consistent across definition and use sites.

**Scope check:** the plan covers one cohesive product (the CF-native rewrite). It is large because the rewrite is large; phases produce shippable slices (Phase 4 ships auth, Phase 8 ships chats CRUD, Phase 11 ships reports) and could in principle be merged independently.

---

## Execution handoff

Plan complete and saved to [`docs/superpowers/plans/2026-04-26-profai-v2-cloudflare-rewrite.md`](docs/superpowers/plans/2026-04-26-profai-v2-cloudflare-rewrite.md). Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — I execute tasks in this session using superpowers:executing-plans, batching with checkpoints for review.

Which approach?
