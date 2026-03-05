import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Env } from "../utils/env";

const disabledDb = new Proxy(
  {},
  {
    get() {
      throw new Error("Database is disabled. Set DATABASE_URL to enable DB-backed routes.");
    },
  },
);

const pool = Env.DATABASE_URL
  ? new Pool({
      connectionString: Env.DATABASE_URL,
    })
  : null;

export const db = pool ? drizzle({ client: pool }) : (disabledDb as any);
