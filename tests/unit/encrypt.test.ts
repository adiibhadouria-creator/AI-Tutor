import { describe, it, expect } from "vitest";
import { encryptString, decryptString, deriveKey } from "@/lib/encrypt";

const KEY_B64 = "a".repeat(44);

describe("encrypt/decrypt", () => {
  it("round-trips text", async () => {
    const key = await deriveKey(KEY_B64, "chat_x");
    const { ciphertext, iv } = await encryptString(key, "hello world");
    const back = await decryptString(key, ciphertext, iv);
    expect(back).toBe("hello world");
  });
});
