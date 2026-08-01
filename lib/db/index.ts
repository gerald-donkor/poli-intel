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
  listEvidenceFacets,
  listPendingClassification,
  loadEvidenceForGenerationContext,
  loadEvidenceListItems,
  NO_EVIDENCE_FILTERS,
  type ClassifyEvidenceResult,
  type CreateEvidenceShellInput,
  type CreateEvidenceShellResult,
  type EvidenceFacets,
  type EvidenceFilters,
  type EvidenceKeywordQuery,
  type EvidenceListingPage,
  type EvidenceListItem,
} from "./evidence";
export {
  findBriefDetail,
  findBriefForEdit,
  listBriefs,
  persistGeneratedBrief,
  saveBriefVersion,
  type BriefDetail,
  type BriefFlag,
  type BriefForEdit,
  type BriefListItem,
  type GeneratedFlag,
  type PersistGeneratedBriefInput,
  type SaveBriefVersionInput,
  type SaveBriefVersionResult,
} from "./briefs";
export {
  createBriefGeneration,
  failBriefGeneration,
  findOwnedBriefGeneration,
  markBriefDrafting,
  recordBriefDraft,
  type CreateBriefGenerationInput,
} from "./brief-generation";
export {
  countEmbeddedChunksByItem,
  listItemsWithUnembeddedChunks,
  listUnembeddedChunks,
  loadChunksForEmbedding,
  purgeEvidenceItemEmbeddings,
  searchEvidenceChunksByVector,
  writeChunkEmbeddings,
  type ChunkForEmbedding,
  type EvidenceChunkMatch,
  type UnembeddedChunk,
} from "./evidence-vectors";
export {
  recordEmbeddingRun,
  recordIngestionFailure,
  recordIngestionSuccess,
  type EmbeddingStage,
} from "./ingestion-log";
