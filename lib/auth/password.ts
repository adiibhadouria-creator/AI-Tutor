// Password hashing on Cloudflare Workers.
//
// We use Web Crypto PBKDF2-HMAC-SHA256 instead of scrypt because Workers'
// per-request CPU budget is too tight for memory-hard KDFs at OWASP parameters.
//
// Note: Cloudflare Workers caps PBKDF2 iterations at 100,000 — this is below
// current OWASP guidance (600k) but is the platform ceiling. We compensate by
// keeping the format versioned so we can layer a Worker-secret pepper later.
//
// Storage format: `pbkdf2$<iterations>$<saltB64>$<hashB64>`

const ITERATIONS = 100_000;
const HASH_LEN = 32; // 256-bit
const SALT_LEN = 16;

const b64 = {
  enc(buf: Uint8Array): string {
    return btoa(String.fromCharCode(...buf));
  },
  dec(s: string): Uint8Array {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  },
};

async function pbkdf2(password: string, salt: Uint8Array, iterations: number, dkLen: number): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    baseKey,
    dkLen * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_LEN);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2(password, salt, ITERATIONS, HASH_LEN);
  return `pbkdf2$${ITERATIONS}$${b64.enc(salt)}$${b64.enc(hash)}`;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts[0] === "pbkdf2" && parts.length === 4) {
    const iterations = Number(parts[1]);
    const salt = b64.dec(parts[2]!);
    const expected = b64.dec(parts[3]!);
    const hash = await pbkdf2(password, salt, iterations, expected.length);
    return constantTimeEqual(hash, expected);
  }
  // Legacy scrypt fallback (only if @noble/hashes is loaded; we don't import it here).
  return false;
}
