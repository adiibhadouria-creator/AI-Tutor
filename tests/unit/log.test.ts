import { describe, it, expect, vi } from "vitest";
import { createLogger } from "@/lib/log";

describe("createLogger", () => {
  it("emits JSON with the request id and level", () => {
    const sink = vi.fn();
    const log = createLogger({ requestId: "req_abc", sink });
    log.info("hello", { foo: 1 });
    expect(sink).toHaveBeenCalledOnce();
    const arg = sink.mock.calls[0]![0]!;
    const parsed = JSON.parse(arg);
    expect(parsed).toMatchObject({ level: "info", msg: "hello", requestId: "req_abc", foo: 1 });
    expect(typeof parsed.ts).toBe("number");
  });

  it("warn and error levels work", () => {
    const sink = vi.fn();
    const log = createLogger({ requestId: "r", sink });
    log.warn("w");
    log.error("e", { code: "X" });
    expect(sink).toHaveBeenCalledTimes(2);
    expect(JSON.parse(sink.mock.calls[0]![0]!).level).toBe("warn");
    expect(JSON.parse(sink.mock.calls[1]![0]!).level).toBe("error");
  });
});
