import { createRouteHandler } from "uploadthing/next";

import { evidenceFileRouter } from "@/lib/uploadthing/core";

/**
 * Uploadthing's endpoint — an external caller's route, and thin by rule
 * (AGENTS.md §5.3). Authorisation lives in the file router's middleware and all
 * work lives in `lib/ingestion/`. No business logic belongs here.
 */
export const { GET, POST } = createRouteHandler({ router: evidenceFileRouter });
