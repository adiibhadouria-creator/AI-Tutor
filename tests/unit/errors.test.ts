import { describe, it, expect } from "vitest";
import { AppError, errorToResponse } from "@/lib/errors";

describe("AppError", () => {
  it("maps NOT_FOUND to 404", () => {
    const res = errorToResponse(new AppError("NOT_FOUND", "missing"));
    expect(res.status).toBe(404);
  });

  it("maps UNAUTHORIZED to 401", () => {
    const res = errorToResponse(new AppError("UNAUTHORIZED", "no auth"));
    expect(res.status).toBe(401);
  });

  it("maps unknown error to 500 without leaking message", async () => {
    const res = errorToResponse(new Error("internal stack trace"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: { code: "INTERNAL", message: "Internal error" } });
  });

  it("includes structured body for AppError", async () => {
    const res = errorToResponse(new AppError("VALIDATION", "bad input", { field: "email" }));
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "VALIDATION", message: "bad input", details: { field: "email" } },
    });
  });
});
