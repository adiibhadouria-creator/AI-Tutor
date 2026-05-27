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

/**
 * Resolve the Worker bindings.
 * vinext doesn't pass env to route handlers (signature is `(request, { params })`),
 * so the Module Worker shim stashes env on globalThis under __APP_ENV__.
 * This helper falls back through the candidate locations.
 */
function resolveEnv(rawEnv: unknown): unknown {
  if (rawEnv && typeof rawEnv === "object" && Object.keys(rawEnv).length > 0) return rawEnv;
  const g = globalThis as unknown as Record<string, unknown>;
  if (g.__APP_ENV__) return g.__APP_ENV__;
  if (g.process && typeof g.process === "object") {
    const procEnv = (g.process as { env?: unknown }).env;
    if (procEnv) return procEnv;
  }
  return rawEnv;
}

export async function withRoute(
  req: Request,
  rawEnv: unknown,
  fn: (ctx: RouteCtx) => Promise<Response>,
): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? newRequestId();
  const log = createLogger({ requestId });
  try {
    const env = parseEnv(resolveEnv(rawEnv));
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
  try {
    json = await req.json();
  } catch {
    throw new AppError("VALIDATION", "invalid JSON");
  }
  const r = schema.safeParse(json);
  if (!r.success) throw new AppError("VALIDATION", "invalid input", r.error.flatten());
  return r.data;
}
