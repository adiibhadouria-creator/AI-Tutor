import { describe, it, expect } from "vitest";
import { sniffMime } from "@/lib/upload-validate";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
const text = new TextEncoder().encode("hello world");

describe("sniffMime", () => {
  it("detects PNG", () => expect(sniffMime(png)).toBe("image/png"));
  it("detects JPEG", () => expect(sniffMime(jpeg)).toBe("image/jpeg"));
  it("detects GIF", () => expect(sniffMime(gif)).toBe("image/gif"));
  it("detects WEBP", () => expect(sniffMime(webp)).toBe("image/webp"));
  it("rejects SVG", () => expect(sniffMime(svg)).toBeNull());
  it("rejects unknown", () => expect(sniffMime(text)).toBeNull());
});
