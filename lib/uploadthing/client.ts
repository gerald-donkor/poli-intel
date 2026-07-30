"use client";

import { generateReactHelpers } from "@uploadthing/react";

import type { EvidenceFileRouter } from "./core";

/**
 * Typed upload client.
 *
 * The router import is type-only and is erased at compile time, so no
 * server-only module reaches the browser bundle through this file.
 */
export const { useUploadThing } = generateReactHelpers<EvidenceFileRouter>();
