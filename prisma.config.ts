import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 does not load .env files itself. Next.js reads .env.local, so load
// that first and fall back to .env — both are gitignored and server-only.
loadEnv({ path: [".env.local", ".env"], quiet: true });

// Prisma 7 moved connection URLs out of schema.prisma and into this file, where
// they are used by Migrate and Studio only. Prisma Client gets its own pooled
// connection from DATABASE_URL through the driver adapter in lib/db/client.ts.
//
// Migrate runs DDL, which Supabase's transaction pooler cannot do, so the URL
// here is the DIRECT_URL. The installed @prisma/config 7.9.1 `Datasource` type
// exposes only `url` and `shadowDatabaseUrl` — there is no `directUrl` key.
//
// `env()` throws when a variable is absent, which would break `prisma generate`
// (and therefore `npm install`) on a checkout with no credentials yet.
// Generate does not need a database, so the datasource is supplied only when
// the variable is actually present; migrate reports the missing URL itself.
const migrationUrl = process.env.DIRECT_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --conditions=react-server --import tsx prisma/seed.ts",
  },
  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {}),
});
