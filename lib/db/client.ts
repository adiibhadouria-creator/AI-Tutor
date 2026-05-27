import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import type { AppEnv } from "@/lib/env";

export type DB = ReturnType<typeof drizzle<typeof schema>>;

export function db(env: Pick<AppEnv, "DB">): DB {
  return drizzle(env.DB, { schema });
}

export { schema };
