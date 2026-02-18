import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  host: "aws-1-us-east-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.xaehuqpsmosztqhortdu",
  password: "VWJFmmOh1UF21Yz1",
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
