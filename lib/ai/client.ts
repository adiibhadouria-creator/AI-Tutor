import type { AppEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

// Tutor: Kimi K2.6 — 1T-param MoE on Workers AI, multimodal, tool-calling.
// Runs natively on CF, no AI Gateway / no external key needed.
//
// Image gen: native Flux on Workers AI for diagrams.
export const TUTOR_MODEL = "@cf/moonshotai/kimi-k2.6";
export const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

// Both models live on Workers AI directly; no gateway routing.
const GATEWAY_SLUG = "";

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
      const runOpts: Record<string, unknown> = {};
      if (GATEWAY_SLUG) runOpts.gateway = { id: GATEWAY_SLUG, skipCache: false };
      return (await env.AI.run(
        model as never,
        payload as Record<string, unknown> as never,
        runOpts as never,
      )) as T;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw new AppError("UPSTREAM", "AI call failed", { cause: String(lastErr) });
}
