import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 requires a driver adapter for SQL providers. DATABASE_URL is the
// pooled Supabase connection; migrations use DIRECT_URL via prisma.config.ts.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. It is server-only and must never be exposed to browser code.",
  );
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

// Next.js dev hot-reload would otherwise open a new pool on every module
// re-evaluation until Postgres refuses connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
