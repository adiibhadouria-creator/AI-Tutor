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
  return {
    ...parsed,
    ...(e as Pick<
      AppEnv,
      | "DB"
      | "KV"
      | "R2"
      | "AI"
      | "BROWSER"
      | "RATE_LIMITER_AUTH"
      | "RATE_LIMITER_SIGNUP"
      | "RATE_LIMITER_CHAT"
      | "RATE_LIMITER_UPLOAD"
      | "RATE_LIMITER_PDF"
    >),
  };
}
