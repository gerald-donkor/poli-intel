import "server-only";

/**
 * The data layer's public surface. Nothing outside `lib/db/` constructs a
 * PrismaClient, and nothing outside `lib/db/` writes raw SQL (AGENTS.md §5.2,
 * §6 — the pgvector similarity queries are the carve-out and they live here).
 */

export { prisma } from "./client";
export { checkEmbeddingDimensions, type EmbeddingCheck } from "./embedding";
