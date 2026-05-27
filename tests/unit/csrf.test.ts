import { describe, it, expect } from "vitest";
import { assertSameOrigin } from "@/lib/csrf";
import { AppError } from "@/lib/errors";

const APP_ORIGIN = "https://profai.example";

function reqWith(method: string, origin: string | null) {
  const h = new Headers();
  if (origin) h.set("origin", origin);
  return new Request("https://profai.example/api/x", { method, headers: h });
}

describe("assertSameOrigin", () => {
  it("allows GET without Origin", () => {
    expect(() => assertSameOrigin(reqWith("GET", null), APP_ORIGIN)).not.toThrow();
  });
  it("rejects POST with missing Origin", () => {
    expect(() => assertSameOrigin(reqWith("POST", null), APP_ORIGIN)).toThrow(AppError);
  });
  it("rejects POST with mismatched Origin", () => {
    expect(() => assertSameOrigin(reqWith("POST", "https://evil.example"), APP_ORIGIN)).toThrow(
      AppError,
    );
  });
  it("allows POST with matching Origin", () => {
    expect(() => assertSameOrigin(reqWith("POST", APP_ORIGIN), APP_ORIGIN)).not.toThrow();
  });
});
