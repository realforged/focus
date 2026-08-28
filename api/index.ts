import { createApp } from "../src/server/createApp.ts";

const hasDb = !!(process.env.DATABASE_URL || process.env.SUPABASE_DB_PASSWORD || process.env.SQL_HOST);

if (!hasDb) {
  console.error("❌ FATAL: No database configured on Vercel.");
  console.error("   Add a Neon Postgres database: Vercel dashboard → Storage → Create → Neon Postgres (free)");
}

const app = createApp();

export default app;
