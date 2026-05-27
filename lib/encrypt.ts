const enc = new TextEncoder();
const dec = new TextDecoder();

function b64Decode(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function deriveKey(masterB64: string, salt: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", b64Decode(masterB64), "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode(salt), info: enc.encode("profai-v2-message") },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptString(
  key: CryptoKey,
  plaintext: string,
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );
  return { ciphertext, iv };
}

export async function decryptString(
  key: CryptoKey,
  ciphertext: BufferSource,
  iv: BufferSource,
): Promise<string> {
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return dec.decode(buf);
}
