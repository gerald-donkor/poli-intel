import "server-only";

/**
 * The data layer's public surface. Nothing outside `lib/db/` constructs a
 * PrismaClient, and nothing outside `lib/db/` writes raw SQL (AGENTS.md §5.2,
 * §6 — the pgvector similarity queries are the carve-out and they live here).
 */

export { prisma } from "./client";
export { checkEmbeddingDimensions, type EmbeddingCheck } from "./embedding";
export {
  findStaffUserById,
  findStaffUserByEmail,
  provisionStaffUser,
} from "./staff";
export {
  classifyEvidenceItem,
  completeEvidenceExtraction,
  countPendingClassification,
  createEvidenceShell,
  deleteEvidenceItem,
  findEvidenceItemForEmbedding,
  findEvidenceItemForIngestion,
  listEligibleEvidence,
  listPendingClassification,
  type ClassifyEvidenceResult,
  type CreateEvidenceShellInput,
  type CreateEvidenceShellResult,
  type EvidenceListItem,
} from "./evidence";
export {
  countEmbeddedChunksByItem,
  listItemsWithUnembeddedChunks,
  listUnembeddedChunks,
  loadChunksForEmbedding,
  purgeEvidenceItemEmbeddings,
  writeChunkEmbeddings,
  type ChunkForEmbedding,
  type UnembeddedChunk,
} from "./evidence-vectors";
export {
  recordEmbeddingRun,
  recordIngestionFailure,
  recordIngestionSuccess,
  type EmbeddingStage,
} from "./ingestion-log";
