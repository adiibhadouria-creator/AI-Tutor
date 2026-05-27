import { describe, it, expect } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("accepts a fully populated env", () => {
    const env = {
      APP_ORIGIN: "http://localhost:3000",
      CONTENT_KEY: "a".repeat(44),
      IP_HASH_SALT: "salt-1234",
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
