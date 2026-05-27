type Level = "debug" | "info" | "warn" | "error";
type Sink = (line: string) => void;

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export function createLogger(opts: { requestId: string; sink?: Sink }): Logger {
  const sink =
    opts.sink ??
    ((line) => {
      console.log(line);
    });
  const emit = (level: Level, msg: string, fields?: Record<string, unknown>): void => {
    const line = JSON.stringify({
      ts: Date.now(),
      level,
      msg,
      requestId: opts.requestId,
      ...fields,
    });
    sink(line);
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
  };
}

export function newRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return (
    "req_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}
