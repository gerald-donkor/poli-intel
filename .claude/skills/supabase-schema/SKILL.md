---
name: supabase-schema
description: Load when adding or changing EviBrief's Prisma schema, enums, pgvector setup, similarity indexes, chunk storage, or migrations. Covers the five core entities, the schema-level classification default, vector dimensionality as a single central fact, and what the Supabase 500MB free-tier budget rules out.
---

# Supabase schema (Prisma + pgvector)

Scope: **this project's entities, its classification default, its vector setup, and its storage budget.** General Postgres and Prisma knowledge is not restated here.

Layers on the vendor skills:

- **`supabase`** — Supabase products, extensions (including pgvector), RLS, CLI and migration mechanics, declarative schemas
- **`supabase-postgres-best-practices`** — Postgres performance and indexing rules
- **`prisma-database-setup`** — provider configuration and connection troubleshooting
- **`prisma-client-api`** — query surface, filters, transactions
- **`prisma-cli`** — `prisma migrate`, `generate`, `studio`

Rules: `AGENTS.md` §12 (data model), §7 (governance), §15 (retrieval). Spec: §4.1, §4.2, §6.1.

**Prisma is not installed yet.** As of writing there is no `prisma/schema.prisma`, no Prisma dependency, and no migration history. Nothing below claims otherwise; the first schema task creates all of it and adds the Prisma scripts to `package.json` in that same change (`AGENTS.md` §19).

Auth is **Auth.js v5, not Supabase Auth** (`AGENTS.md` §6). If the chosen Auth.js adapter needs tables, they are part of this schema like anything else — see `server-actions`.

## The five core entities

From spec §4.1. **Extend these; never fork a parallel table for the same concept** (`AGENTS.md` §12.1).

| Entity | Key fields (spec §4.1) |
|---|---|
| `policy_signal` | id, source_url, source_name, detected_at, urgency (enum), relevance (enum), impact_area, geography, summary_text, embedding (vector), status (new/reviewed/actioned/archived) |
| `evidence_item` | id, title, authors, year, source_type (field_data/research/literature), country, impact_area, full_text, embedding (vector), citation_key — **plus the required classification field below** |
| `brief` | id, signal_id, brief_type, audience, generated_at, reviewed_by, status (draft/reviewed/submitted/published), body_text, evidence_ids[], version |
| `influence_event` | id, brief_id, event_type, source_document, detected_at, description, verified (bool) |
| `stakeholder` | id, name, organisation, role, audience_type, preferred_language, brief_history[] |

Model names follow Prisma convention in code with `@@map` to the snake_case table names above, so the spec's entity names stay the source of truth for the database.

Things the spec's field list implies but doesn't spell out, and that the schema must carry:

- **Brief versioning** — every edit is versioned and no prior version is overwritten in place (`AGENTS.md` §8.7). `version` on `brief` is not enough on its own; the schema needs somewhere for prior versions to live.
- **Status transitions are recorded with actor and timestamp** (`AGENTS.md` §8.3), as are signal reclassifications (§8.6) and classification changes (§10.8). That is audit rows, not just a mutable column.
- **The evidence set used for a brief is recorded on the brief** (`AGENTS.md` §15.5) — `evidence_ids[]` is that record. It is the set the fact-check pass verifies against, so it must be the *final* set after officer add/remove, not the raw matcher output.
- **Hallucination-guard flags** are structured records against a brief version, anchored to a document position — shape per `hallucination-guard`.
- **Generating model and prompt version** on each brief (`AGENTS.md` §16.5, §13.6).

## The classification field

`evidence_item` carries a **required** classification field with **`unpublished_internal` as the schema-level default**. The default belongs in the schema, not in application code (`AGENTS.md` §12.2, §7.3).

```prisma
enum Classification {
  public_published
  community_sourced
  unpublished_internal
}

// on evidence_item:
// classification Classification @default(unpublished_internal)
```

This is the single most consequential line in the schema. Putting the default here means the **safe state is the default** — a newly ingested row is ineligible for the AI pipeline without any application code remembering to set it. An item that arrives through an unforeseen path (a raw insert, a bulk import, a future ingestion route) is still blocked.

Never nullable. Never defaulted to `public_published` "for convenience in dev". Read `evidence-governance` before touching anything downstream of this column.

## Enums

Enums for **urgency, relevance, impact area, geography, audience target, brief type, brief status, and classification are defined once in the schema and imported everywhere** (`AGENTS.md` §12.7). Never re-declared as string unions in UI code — a second copy drifts, and drift here means a badge that renders a state the database cannot hold.

Values come from the spec, verbatim:

- **Urgency** — Immediate (<4 weeks) / Near-term (1–3 months) / Horizon (3–6 months) / Watch (>6 months) — spec §3.2
- **Relevance** — Core / Adjacent / Background — spec §3.2
- **Impact area** — Restoration / Community forestry / Diversified production / Cross-cutting — spec §3.2
- **Geography** — Ghana national / Cocoa Belt landscapes / International / Multi-level — spec §3.2
- **Audience target** — Ministry / Cocobod / EU institutions / Private sector / Community governance — spec §3.2. The five *brief-generation audience profiles* (spec §3.4) are a related but distinct list; don't collapse them into one enum without a recorded decision.
- **Brief type** — policy brief / technical submission / position paper / stakeholder note / media backgrounder — spec §3.4
- **Brief status** — draft / reviewed / submitted / published — spec §4.1
- **Signal status** — new / reviewed / actioned / archived — spec §4.1
- **Evidence source type** — field_data / research / literature — spec §4.1
- **Classification** — as above

The urgency enum's *order* is meaningful: the design system's warm→cool ramp maps to it positionally and must never be remapped (`design-system`).

## pgvector

- **Enable the extension explicitly** in a migration. Do not assume it is on. Mechanics: the `supabase` vendor skill.
- Vector columns on `policy_signal.embedding` and on evidence chunks.
- **Create the similarity index explicitly** — cosine distance, matching the retrieval order in `AGENTS.md` §15.1. An unindexed vector column silently degenerates into a sequential scan; that is a correctness-of-performance bug the free tier will not forgive. Index type and parameters: check current pgvector guidance via the `supabase` skill rather than assuming a build-time default.
- Prisma's support for the `vector` type needs the preview/unsupported-type route rather than a native scalar. **Verify the current mechanism against the installed Prisma version** before writing it — this has changed across Prisma releases. Raw SQL for the similarity query itself is permitted and belongs in the data layer only (`AGENTS.md` §6 "do not use" list carves out exactly this).

### Dimensionality

**State the embedding dimensionality once, in a central config, and consume it in both the migration and the query layer** (`AGENTS.md` §12.3). Do not inline the number in two places.

The value is Gemini Embedding 2's output dimension, and it **needs verification against the model's actual output** — see `gemini-integration`, which owns the model config and flags this same value as unverified. A mismatch between column and model is a hard failure at insert, and a mismatch between two inlined copies is a slow, confusing one.

Record which embedding model produced a stored vector. Changing models invalidates existing vectors, and without that record there is no safe re-embedding path.

## Chunks

Spec §4.2: documents are chunked into **512-token overlapping segments**, each chunk embedded and stored with **chunk-level metadata**; **document-level metadata lives on `evidence_item`** (`AGENTS.md` §12.4).

Consequences for the schema:

- Chunks are their own table with a foreign key to `evidence_item`, not an array column on the parent.
- Chunk metadata is what retrieval needs to cite precisely (position/offset, ordinal, source page where known) — enough for a citation chip to point somewhere real and for the guard to trace a claim to a chunk.
- **Classification is not duplicated onto chunks.** It lives on `evidence_item` and retrieval joins to it. One copy, one place to change, no possibility of a chunk whose classification disagrees with its parent.
- Metadata filters that retrieval needs — country, year, impact area, evidence type (`AGENTS.md` §15.3) — must be queryable in the same statement as the similarity search, so keep them on `evidence_item` and join, rather than denormalising.

## The 500MB budget

Supabase Free is 500MB, and it pauses after 7 days of inactivity (spec §6.1). Schema and index choices matter (`AGENTS.md` §12.5):

- **No redundant full-text copies.** `full_text` on `evidence_item` plus every chunk's text is already two copies of the document; a third (a tsvector column, a search-only mirror table) needs justification. Keyword search can run against existing columns before it earns a duplicate.
- **No speculative indexes.** Index what a real query path uses. Every index is bytes and write cost.
- **Prune raw upload artefacts once extraction succeeds.** The PDF's job is done when its text is extracted and chunked; keeping the original in storage indefinitely spends the budget on data nothing queries. Uploadthing holds the upload; the database holds the extraction.
- Vectors dominate storage growth. Chunk count × dimensionality is the number to reason about before ingesting a large corpus, and it is another reason not to store the same text three times.

## Migrations only

**All schema changes go through Prisma migrations. Never hand-edit the database to match code** (`AGENTS.md` §12.6). That includes the pgvector extension and the similarity index — both are migration content, not something applied once by hand in the Supabase SQL editor and then forgotten. A hand-applied change exists in one environment only, which makes the next deploy a mystery.

`DATABASE_URL` is the pooled connection for Prisma Client; `DIRECT_URL` is the direct connection for migrations (`AGENTS.md` §18). Both server-only.

## Ingestion logging

Ingestion is logged, and staff are notified of new knowledge base additions (`AGENTS.md` §12.8, spec §4.2 step 12). A Research Officer is notified of each new field submission (`AGENTS.md` §17.3). Those notifications need something durable to read from — the ingestion log is schema, not a console line.

## Related

- `evidence-governance` — why the classification default is where it is
- `gemini-integration` — the embedding model and dimensionality this schema consumes
- `hallucination-guard` — the flag record anchored to a brief version
- `server-actions` — the only mutation path onto these tables
- `supabase`, `supabase-postgres-best-practices`, `prisma-*` (vendor) — the general knowledge this skill does not restate
