import { newRequestId } from "@/lib/log";

export const config = { matcher: ["/api/:path*"] };

export function middleware(req: Request): Response {
  const requestId = req.headers.get("x-request-id") ?? newRequestId();
  // Pass-through; just attach a request id header for downstream handlers + logs.
  const headers = new Headers(req.headers);
  headers.set("x-request-id", requestId);
  return new Response(null, { status: 200, headers: { "x-request-id": requestId } });
}
