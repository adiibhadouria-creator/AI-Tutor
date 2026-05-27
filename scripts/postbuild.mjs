// Postbuild patcher: makes the vinext-emitted Worker conform to CF Module
// Worker shape and exposes env on globalThis so route handlers (which vinext
// invokes as `handler(request, { params })` — no env) can read it.
import fs from "node:fs";
import path from "node:path";

const SERVER = "dist/server/index.js";
const CLIENT_CFG = "dist/client/wrangler.json";

if (!fs.existsSync(SERVER)) {
  console.error(`[postbuild] missing ${SERVER}`);
  process.exit(1);
}

let src = fs.readFileSync(SERVER, "utf8");
const exportRe = /export\s*\{\s*handler\s+as\s+default\s*,\s*generateStaticParamsMap\s*\}\s*;\s*$/m;
if (!exportRe.test(src)) {
  console.error("[postbuild] expected vinext export footer not found in server bundle");
  process.exit(1);
}

const shim = `
// CF Module Worker compatibility shim — vinext exports a bare async fn,
// CF requires { fetch }, and route handlers need env via globalThis.
const __vinext_default = {
  async fetch(request, env, ctx) {
    globalThis.__APP_ENV__ = env;
    return handler(request, env, ctx);
  },
};
export { __vinext_default as default, generateStaticParamsMap };
`;
src = src.replace(exportRe, shim.trim());
fs.writeFileSync(SERVER, src);
console.log("[postbuild] patched dist/server/index.js");

if (fs.existsSync(CLIENT_CFG)) {
  const cfg = JSON.parse(fs.readFileSync(CLIENT_CFG, "utf8"));
  cfg.main = path.join("..", "server", "index.js");
  fs.writeFileSync(CLIENT_CFG, JSON.stringify(cfg, null, 2));
  console.log(`[postbuild] set ${CLIENT_CFG} main → ${cfg.main}`);
}

const stale = ".wrangler/deploy/config.json";
if (fs.existsSync(stale)) {
  fs.unlinkSync(stale);
  console.log(`[postbuild] removed ${stale}`);
}
