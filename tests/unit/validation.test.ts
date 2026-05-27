import { describe, it, expect } from "vitest";
import { SignupSchema, LoginSchema, ChatCreateSchema } from "@shared/validation";

describe("SignupSchema", () => {
  it("rejects short passwords", () => {
    const r = SignupSchema.safeParse({ email: "a@b.com", password: "short", turnstile_token: "t" });
    expect(r.success).toBe(false);
  });
  it("accepts a valid signup", () => {
    const r = SignupSchema.safeParse({
      email: "a@b.com",
      password: "longenough12",
      turnstile_token: "t",
    });
    expect(r.success).toBe(true);
  });
});

describe("LoginSchema", () => {
  it("requires email format", () => {
    const r = LoginSchema.safeParse({ email: "not-email", password: "x", turnstile_token: "t" });
    expect(r.success).toBe(false);
  });
});

describe("ChatCreateSchema", () => {
  it("requires non-empty topic", () => {
    expect(ChatCreateSchema.safeParse({ topic: "" }).success).toBe(false);
    expect(ChatCreateSchema.safeParse({ topic: "Physics" }).success).toBe(true);
  });
  it("accepts optional image_key", () => {
    expect(
      ChatCreateSchema.safeParse({ topic: "Math", image_key: "uploads/u/abc.png" }).success,
    ).toBe(true);
  });
});
