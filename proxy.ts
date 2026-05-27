// vinext "proxy" (renamed from Next.js middleware in v16).
// Runs on every matched request, before the route handler / page renders.
//
// Responsibilities:
//   1. Edge-level auth gate: protected pages and /api/* (except /api/auth/*)
//      require a session cookie. Without one we redirect / 401 immediately.
//   2. Attach a request id header for downstream logging.
//
// Note: we only check cookie *presence* here, not validity (no D1 calls in proxy
// to keep it cheap). Validation still happens inside requireUser() per-route.

const SESSION_COOKIE = "__Host-session";

function newRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return (
    "req_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function hasSessionCookie(req: Request): boolean {
  const header = req.headers.get("cookie");
  if (!header) return false;
  for (const part of header.split(";")) {
    const [k] = part.trim().split("=");
    if (k === SESSION_COOKIE) return true;
  }
  return false;
}

const PUBLIC_PAGES = new Set(["/", "/login", "/signup"]);
const PUBLIC_API_PREFIX = "/api/auth/login";
const PUBLIC_API_PREFIX_2 = "/api/auth/signup";

export default function proxy(req: Request): Response | undefined {
  const url = new URL(req.url);
  const path = url.pathname;
  const requestId = req.headers.get("x-request-id") ?? newRequestId();
  const has = hasSessionCookie(req);

  // /api/* — JSON endpoints. Public auth routes pass; everything else needs cookie.
  if (path.startsWith("/api/")) {
    if (path === PUBLIC_API_PREFIX || path === PUBLIC_API_PREFIX_2 || path === "/api/auth/me") {
      // /api/auth/me needs to answer auth checks for the home redirect; let it through and return 401 inside.
      return undefined;
    }
    if (!has) {
      return new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED", message: "not signed in" } }),
        {
          status: 401,
          headers: { "content-type": "application/json", "x-request-id": requestId },
        },
      );
    }
    return undefined;
  }

  // Static assets + public pages — let through.
  if (PUBLIC_PAGES.has(path) || path.startsWith("/assets/") || path.startsWith("/_")) {
    return undefined;
  }

  // Protected pages — redirect to /login if no cookie.
  if (!has) {
    return Response.redirect(`${url.origin}/login`, 302);
  }
  return undefined;
}
