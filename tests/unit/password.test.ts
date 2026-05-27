import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("round-trips", { timeout: 30_000 }, async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(stored.startsWith("pbkdf2$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("produces different hashes for the same password (random salt)", { timeout: 30_000 }, async () => {
    const a = await hashPassword("secret123456");
    const b = await hashPassword("secret123456");
    expect(a).not.toEqual(b);
    expect(await verifyPassword("secret123456", a)).toBe(true);
    expect(await verifyPassword("secret123456", b)).toBe(true);
  });
});
