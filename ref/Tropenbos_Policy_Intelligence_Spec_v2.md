<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>TECHNICAL SPECIFICATION</strong></p>
<p><strong>EviBrief</strong></p>
<p>Policy Intelligence &amp; Brief Generator</p>
<p>Tropenbos Ghana • Making Knowledge Work for People and Forests</p>
<p>Aligned to the Tropenbos International Network Strategy 2023–2027</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 23%" />
<col style="width: 23%" />
<col style="width: 29%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p>Version</p>
<p><strong>1.0 Draft</strong></p></td>
<td><p>Date</p>
<p><strong>May 2026</strong></p></td>
<td><p>Status</p>
<p><strong>For Review</strong></p></td>
<td><p>Prepared for</p>
<p><strong>Tropenbos Ghana Programme Team</strong></p></td>
</tr>
</tbody>
</table>

**1. Executive Summary**

Tropenbos Ghana's 2023–2027 strategy is built on a precise thesis: locally-grounded evidence, made legible and persuasive to decision-makers at the right moment, is the mechanism of change. The organisation has already demonstrated this at international scale — informing EU deforestation legislation, shaping Ghana's forestry policy, and contributing to REDD+ and FLEGT-VPA processes.

EviBrief (the Policy Intelligence & Brief Generator module) is the AI module that accelerates and scales this capability. It monitors the policy landscape continuously, matches emerging decision windows to Tropenbos's evidence base, and produces audience-tailored briefs and submissions in hours rather than weeks. It is the highest-leverage module in the platform because it amplifies every other investment Tropenbos makes in research, field work, and community engagement.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Strategic alignment</strong></p>
<p>TBI Strategy Step 5 — Influence: "We influence governments and companies to adopt policies and practices that support thriving and climate-resilient landscapes." This module operationalises that step by closing the gap between holding evidence and deploying it at the right moment, for the right audience, in the right format.</p></td>
</tr>
</tbody>
</table>

|                                         |                                                         |
|-----------------------------------------|---------------------------------------------------------|
| **Metric**                              | **Target**                                              |
| **Policy windows detected per quarter** | Ghana + EU + UNFCCC tracked continuously                |
| **Brief generation time**               | Under 4 hours from trigger to draft                     |
| **Evidence-to-brief match rate**        | \>85% relevant evidence surfaced automatically          |
| **Audience variants per brief**         | Ministry / company / donor / community leader           |
| **Contribution to 2030 goal**           | Supports 20M ha / 5M people target via policy influence |

**2. Strategic Context & Problem Statement**

**2.1 The knowledge-to-policy bottleneck**

Tropenbos Ghana generates evidence of demonstrable quality — from agroforestry outcomes in cocoa landscapes to community tenure rights data. The bottleneck is not evidence production but evidence translation: converting research findings into the formats, framings, and timings that influence policy decisions.

Policy windows are narrow and unpredictable. A ministerial review of Ghana's Forestry Act, an EUDR implementing regulation consultation, a UNFCCC NDC revision cycle — each opens briefly and closes. Missing the window means waiting years for the next opportunity. Manually monitoring these processes while also producing tailored briefs is beyond the capacity of a lean programme team.

**2.2 Alignment with TBI strategy cross-cutting themes**

The three cross-cutting themes of the 2023–2027 strategy each shape specific requirements for this module:

|                                 |                                                                                                                                                                                                                           |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Cross-cutting theme**         | **How this module responds**                                                                                                                                                                                              |
| **Gender & youth**              | Briefs explicitly flag gender and youth equity dimensions of policy proposals. The module tracks whether government commitments to women's tree tenure rights and youth participation are reflected in draft legislation. |
| **Local financial capacities**  | Monitors REDD+ finance flows, carbon market regulations, and smallholder credit policy. Flags when global finance mechanisms create barriers or opportunities for community-level actors in Ghana.                        |
| **Locally responsive policies** | Core function of the module. Connects Tropenbos's landscape-level evidence directly to national NDC targets, EUDR compliance requirements, and FLEGT-VPA commitments, ensuring local realities inform global frameworks.  |

**2.3 Priority policy arenas (Ghana)**

- Ghana Forestry Commission — annual work plans, forest reserve management frameworks

- Tree tenure reform — on-farm tree ownership rights for smallholders (central to cocoa agroforestry work)

- Cocobod — deforestation-free cocoa (DFCS) standards and supply chain traceability requirements

- Community Resource Management Areas (CREMA) — legislation, scaling, and community governance

- FLEGT Voluntary Partnership Agreement — legality assurance and timber traceability commitments

- REDD+ national strategy — benefit-sharing mechanisms, safeguards, and MRV systems

**2.4 Priority policy arenas (international)**

- EU Deforestation Regulation (EUDR) — due diligence requirements affecting Ghana's cocoa supply chain

- UNFCCC — NDC revision cycles, COP decisions on forests, REDD+ Article 6 rules

- ITTO — tropical timber trade standards and legality verification

- CBD — 30x30 targets and biodiversity-forest policy linkages

**3. Module Architecture**

**3.1 System overview**

The module comprises four interconnected components that operate as a continuous pipeline: a Policy Radar that monitors external sources, an Evidence Matcher that connects incoming signals to Tropenbos's knowledge base, a Brief Generator that produces tailored documents, and an Impact Tracker that closes the feedback loop.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Architecture principle</strong></p>
<p>Each component is independently deployable and can be operated at different cadences. The Policy Radar runs continuously. The Evidence Matcher runs on each detected signal. The Brief Generator runs on demand. The Impact Tracker runs weekly. This avoids over-engineering: Tropenbos staff trigger briefs when they choose, rather than being flooded with auto-generated documents.</p></td>
</tr>
</tbody>
</table>

**3.2 Component 1 — Policy Radar**

**Purpose**

Continuously monitors the policy landscape across Ghana, the EU, and international bodies. Detects signals that represent potential windows for Tropenbos influence and classifies their urgency and relevance.

**Data sources monitored**

|                                |                  |                                        |                             |
|--------------------------------|------------------|----------------------------------------|-----------------------------|
| **Source**                     | **Frequency**    | **Signal type**                        | **Relevance**               |
| **Ghana Gazette / FC website** | Daily            | Draft regulations, policy notices      | High — primary jurisdiction |
| **EUDR implementing acts**     | Weekly           | Consultation periods, guidance updates | High — cocoa supply chain   |
| **UNFCCC secretariat**         | Daily during COP | Draft decisions, negotiating texts     | Medium — REDD+ / NDC        |
| **Cocobod announcements**      | Weekly           | Standard revisions, trade requirements | High — DFCS compliance      |
| **ITTO newsletters**           | Monthly          | Trade policy, legality discussions     | Medium — FLEGT-VPA          |
| **CBD secretariat**            | Monthly          | Implementation guidance, reporting     | Low-medium — biodiversity   |
| **Reuters / AllAfrica**        | Daily            | Political signals, minister statements | Medium — early warning      |

**Signal classification**

Each detected signal is automatically classified on two axes before any staff time is spent:

|                     |                                                                                                               |
|---------------------|---------------------------------------------------------------------------------------------------------------|
| **Dimension**       | **Categories**                                                                                                |
| **Urgency**         | Immediate (window open \<4 weeks) / Near-term (1–3 months) / Horizon (3–6 months) / Watch (\>6 months)        |
| **Relevance**       | Core (directly affects Tropenbos impact areas) / Adjacent (indirectly relevant) / Background (awareness only) |
| **Impact area**     | Restoration / Community forestry / Diversified production / Cross-cutting                                     |
| **Geography**       | Ghana national / Cocoa Belt landscapes / International / Multi-level                                          |
| **Audience target** | Ministry / Cocobod / EU institutions / Private sector / Community governance                                  |

**Technical implementation**

- Scheduled Playwright (Node.js) scraping jobs, run via Inngest, for structured sources

- RSS feed monitoring for UNFCCC, CBD, and ITTO publications

- Gemini API with Google Search grounding for unstructured monitoring (news, minister statements)

- Signal deduplication using fuzzy text matching to avoid repeat alerts on the same event

- PostgreSQL signals table with classification metadata and staff notification webhooks

- Slack webhook or email digest — staff receive a morning briefing of classified signals

**3.3 Component 2 — Evidence Matcher**

**Purpose**

When a policy signal is flagged, the Evidence Matcher automatically retrieves the most relevant evidence from Tropenbos's knowledge base and scores its pertinence to the specific decision at stake.

**Knowledge base sources**

- Tropenbos Ghana research reports and working papers (ingested as PDF text chunks)

- TBI network publications from partner countries — particularly DR Congo (community forestry), Colombia (restoration), Viet Nam (women-led agroforestry)

- Field monitoring data from Ghana landscapes (structured database records)

- Previous policy briefs and submissions (for consistency and cross-referencing)

- Curated external evidence — CIFOR, IUCN, World Resources Institute publications on Ghana and West Africa

**Matching process**

1.  Signal text is embedded using a sentence transformer model

2.  Embedding is compared against the vectorised knowledge base using cosine similarity (pgvector)

3.  Top 20 candidate evidence items are retrieved and re-ranked by a cross-encoder model

4.  Top 8 items are passed to the brief generator with relevance scores and source metadata

5.  Evidence gaps are flagged — where no strong match exists, the brief notes the gap explicitly

**Technical stack**

- pgvector extension on PostgreSQL for vector similarity search

- Gemini Embedding 2 for all evidence — public, published, and community-sourced

- Cross-encoder reranker: ms-marco-MiniLM-L-6-v2

- LangChain.js RAG pipeline orchestrating retrieval and context assembly within Next.js Server Actions

- Metadata filters: country, year, impact area, evidence type (field data vs. literature)

**3.4 Component 3 — Brief Generator**

**Purpose**

The core AI generation component. Takes a policy signal, matched evidence, and a specified audience, and produces a structured, accurate, and persuasive policy brief that Tropenbos staff can review, refine, and submit.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Design principle: AI drafts, humans decide</strong></p>
<p>The generator produces a reviewed draft, not an autonomous submission. All briefs require staff review before use. The system is designed to collapse the time from signal detection to draft from days to hours, freeing staff to focus on relationship-building and strategic judgment rather than document production.</p></td>
</tr>
</tbody>
</table>

**Output types**

|                          |                                                                                                                                            |
|--------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| **Brief type**           | **Description & typical length**                                                                                                           |
| **Policy brief**         | 4–6 pages. For ministry officials and senior government advisors. Structured: problem, evidence, recommendations, implementation notes.    |
| **Technical submission** | 8–15 pages. For formal consultation processes (EUDR implementing acts, NDC revisions). Includes citations, methodology notes, and annexes. |
| **Position paper**       | 2–3 pages. For multi-stakeholder dialogue sessions. Summarises Tropenbos's stance with key evidence points.                                |
| **Stakeholder note**     | 1 page. For company sustainability teams, donor programme officers, or community leaders. Plain language, action-oriented.                 |
| **Media backgrounder**   | 1 page. Key statistics and quotes for journalists covering forest and cocoa stories in Ghana.                                              |

**Brief structure (standard policy brief)**

- Header: issue title, date, audience, classification (public / restricted)

- Executive summary: 3–4 sentences, the most important finding and one clear recommendation

- Context: what is happening in the policy arena and why it matters for forests in Ghana (max 200 words)

- Evidence: 3–5 key findings from Tropenbos's research, with source citations and landscape specificity

- Recommendations: 2–4 concrete, actionable asks — one per decision-maker type

- Implementation pathway: who needs to do what, and by when, for the recommendation to land

- About Tropenbos Ghana: two-sentence credibility statement, contact details

**Audience tailoring logic**

The same underlying evidence is reframed automatically for different audiences:

|                                         |                                                                                                                 |                                                                                             |
|-----------------------------------------|-----------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| **Audience**                            | **Framing emphasis**                                                                                            | **Tone & format**                                                                           |
| **Ghana ministry official**             | National policy alignment, Ghana NDC commitments, forest cover targets, political feasibility                   | Formal, deferential, concise. Bullet recommendations. Clear ask.                            |
| **Cocoa company (sustainability team)** | EUDR compliance risk, supply chain traceability, smallholder farmer relationships, reputational risk            | Business-oriented, risk/opportunity framing, data-heavy. One-pager preferred.               |
| **EU regulator / DG ENV**               | Implementing regulation detail, smallholder protection gaps, Ghana country evidence, precedent from TBI network | Technical, evidenced, references to specific regulation articles. Formal submission format. |
| **Donor / programme officer**           | Impact evidence, contribution to global climate targets, value for money, sustainability beyond project         | Narrative-led, impact stories, aligned to donor's own reporting framework.                  |
| **Community governance (CREMA)**        | Rights, local benefit-sharing, what the policy change means for daily life and livelihood decisions             | Plain language, local context, translated to Twi where needed. Avoid jargon.                |

**AI model configuration**

- Primary model: Gemini 3.6 Flash (free tier) — cost-efficient model for brief generation; no per-token cost while usage stays within free-tier rate limits

- System prompt includes: Tropenbos Ghana mission statement, 2023–2027 strategy goals, Ghana forestry context, current TBI positions on EUDR and tree tenure, tone guidelines per audience type

- Evidence context: top 8 matched evidence items passed as structured context with source metadata

- Policy signal context: full text of the detected policy document or relevant excerpt

- Generation parameters: temperature 0.3 (factual grounding), max tokens 4000

- Hallucination guard: post-generation fact-check pass verifies all cited statistics against the evidence context; flags any claim not traceable to a source

**3.5 Component 4 — Impact Tracker**

**Purpose**

Closes the feedback loop by recording where Tropenbos evidence and recommendations have been acknowledged, cited, or adopted in policy documents, company commitments, and legislation.

**What is tracked**

- Policy documents that cite Tropenbos research (detected via Google Scholar alerts and manual logging)

- Legislation or regulatory changes aligned with Tropenbos recommendations

- Company commitments to deforestation-free supply chains referencing TBI evidence

- Multi-stakeholder dialogue outcomes where Tropenbos framing was adopted

- NDC or national strategy text where Tropenbos contributed

**Output**

- Quarterly impact report: a structured summary of influence events, suitable for donor reporting

- Live influence map: a visual showing which briefs contributed to which policy changes

- Evidence quality feedback: signals which types of evidence are most cited, informing research priorities

**4. Data Model**

**4.1 Core entities**

|                     |                                                                                                                                                                               |
|---------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Entity**          | **Key fields**                                                                                                                                                                |
| **policy_signal**   | id, source_url, source_name, detected_at, urgency (enum), relevance (enum), impact_area, geography, summary_text, embedding (vector), status (new/reviewed/actioned/archived) |
| **evidence_item**   | id, title, authors, year, source_type (field_data/research/literature), country, impact_area, full_text, embedding (vector), citation_key                                     |
| **brief**           | id, signal_id, brief_type, audience, generated_at, reviewed_by, status (draft/reviewed/submitted/published), body_text, evidence_ids\[\], version                             |
| **influence_event** | id, brief_id, event_type, source_document, detected_at, description, verified (bool)                                                                                          |
| **stakeholder**     | id, name, organisation, role, audience_type, preferred_language, brief_history\[\]                                                                                            |

**4.2 Knowledge base ingestion pipeline**

6.  Source document arrives (PDF, web page, or field data export)

7.  Text extracted and cleaned; language detected

8.  Document chunked into 512-token overlapping segments

9.  Each chunk embedded and stored in pgvector with metadata

10. Document-level metadata stored in evidence_items table

11. Classification: staff explicitly tag the item as public_published, community_sourced, or unpublished_internal (Section 4.3) before it is eligible for the AI pipeline. Manual for Phase 1 by product decision \u2014 defaults to the most restrictive classification until tagged; auto-classification by source is a candidate for a later phase once ingestion volume justifies it.

12. Ingestion logged; staff notified of new knowledge base additions

**4.3 Data governance & sovereignty**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Critical: locally owned data</strong></p>
<p>The TBI strategy emphasises locally owned solutions. Community-sourced field data and unpublished research must remain under Tropenbos Ghana's control. Important: with the AI stack consolidated onto Gemini's free tier (chosen for cost), there is no longer a separate paid pipeline for public evidence — all data, including community-sourced and unpublished material, passes through the same Gemini free-tier pipeline. Google's free-tier terms permit using submitted prompts and outputs for model training. This means the "never passed to external AI APIs without consent" principle below currently cannot be fully guaranteed on the free tier. Before any real community data is processed, either (a) move to paid Gemini or Vertex AI, which does not train on submitted data, or (b) keep community-sourced data out of the AI pipeline entirely until that upgrade is made.</p></td>
</tr>
</tbody>
</table>

- All community-sourced data: stored on Tropenbos-controlled servers, Accra or Kumasi co-location facility

- Published research and public policy documents: processed via the Gemini API free-tier pipeline (see note above on training-data terms)

- Unpublished field reports: processed via the same Gemini API pipeline for embedding and summarisation — held out of the pipeline entirely until the training-data risk above is resolved (paid tier or consent-based exception)

- Staff authentication: single sign-on via Google Workspace (Tropenbos Ghana's existing provider)

- Role-based access: Programme Director (full access), Researchers (read + generate), Field Officers (mobile app only)

**5. User Experience & Workflows**

**5.1 Primary users**

|                               |                                                                                                 |
|-------------------------------|-------------------------------------------------------------------------------------------------|
| **User**                      | **Primary workflow**                                                                            |
| **Programme Director**        | Reviews signal digest, commissions briefs, approves submissions, tracks influence outcomes      |
| **Policy & Advocacy Officer** | Primary user: monitors signals, generates and refines briefs, manages stakeholder relationships |
| **Research Officer**          | Ingests new evidence, validates evidence matches, annotates gaps, reviews factual accuracy      |
| **Field Officer (Ghana)**     | Submits field observations via mobile app; receives simplified policy updates via WhatsApp/USSD |

**5.2 Core workflow: signal to submission**

13. Signal detected by Policy Radar — staff receive morning digest via email / Slack

14. Policy & Advocacy Officer reviews signal classification in web dashboard

15. Officer clicks "Generate brief" — selects brief type and primary audience

16. System runs Evidence Matcher and returns top evidence with confidence scores

17. Officer reviews evidence selection, can add/remove items, notes any gaps

18. Brief Generator produces draft within 60 seconds

19. Officer edits draft in built-in editor (or exports to Google Docs / Word)

20. Research Officer reviews factual claims against cited evidence

21. Programme Director approves; brief is submitted or published

22. Submission logged; Impact Tracker watches for downstream citations

The flow above is the flagship path, but three other personas from Section 5.1 have their own distinct workflows that don't route through it.

**Research Officer — evidence validation workflow**

**1.** New evidence enters the queue (upload or field submission) at unpublished_internal classification (Section 4.3) — not yet searchable or eligible for the AI pipeline

**2.** Officer reviews the source, checks for duplicate or near-duplicate evidence already in the library

**3.** Officer verifies factual claims against the source document itself, not just the extracted summary

**4.** Officer sets the classification (public_published / community_sourced / unpublished_internal) — this is the required tagging step from Section 4.2, step 11

**5.** Evidence becomes searchable in the Evidence Library; only public_published items are eligible for the Evidence Matcher and Brief Generator

**6.** Officer periodically reviews the Evidence Matcher's automated matches for quality — feeds the Impact Tracker's evidence-quality feedback (Section 3.5)

**Field Officer — field submission workflow**

**1.** Officer opens the /field route or the WhatsApp bot — both work offline via cached shell (Section 5.4)

**2.** Submits an observation (text, optionally a photo) via a lightweight form — no login friction beyond initial SSO

**3.** Submission queues locally if offline; syncs automatically once connectivity returns, with a visible “waiting to sync” indicator, never a silent failure

**4.** Submission enters the knowledge base as community_sourced, unpublished_internal by default — blocked from the AI pipeline per Section 4.3 until a Research Officer reviews it

**5.** Research Officer is notified of the new submission for review and classification

**6.** Officer receives the simplified weekly digest back via WhatsApp/USSD — this reverse path requires no login at all

**Programme Director — approval & impact review workflow**

**1.** Morning digest surfaces briefs awaiting approval and any new influence events

**2.** Director opens /dashboard, reviews the brief alongside its evidence summary and hallucination-guard status (Section 5.7) — unresolved flags block approval

**3.** Approves, sends back for changes (returns to the originating Officer), or rejects

**4.** Approved brief is submitted/published and logged for the Impact Tracker

**5.** Director periodically reviews /impact for citation events and generates the quarterly donor report

**Key UX states to design for**

Beyond the happy path, these states need explicit design treatment — relevant to both engineering (Section 5.5) and the Claude Design handoff (Section 5.6):

- Empty state: Evidence Matcher returns zero results above the confidence threshold — needs a clear next step (broaden search, flag as a research gap), not just a blank panel

- Rate-limit state: Gemini free-tier limit hit mid-generation (Section 6.1) — should degrade gracefully with a clear retry-timing message, never a generic error

- Offline / sync-pending state: Field Officer submission queued but not yet synced (Section 5.4) — visible indicator, not a silent queue

- Classification-pending state: evidence blocked from the AI pipeline awaiting Research Officer review (Section 4.3) — visible as a queue count so it doesn't get forgotten

- Flagged state: a hallucination-guard flag awaiting resolution (Section 5.7) — blocks Programme Director approval until cleared by an authorised role (Section 5.5's RBAC)

**5.3 Interface components**

- Signal dashboard: kanban view of signals by urgency (Immediate / Near-term / Horizon / Watch)

- Evidence library: searchable, filterable repository with relevance scores per signal

- Brief editor: structured template editor with inline AI suggestions and citation tracking

- Audience switcher: one-click reframing of a brief for a different audience type

- Translation assist: key messages translated to Twi for community-facing versions

- Submission tracker: calendar view of upcoming policy windows with brief status

**5.4 Mobile & offline considerations**

Field Officers in Ghana's cocoa landscapes operate with intermittent connectivity. Their workflow is deliberately lightweight:

- WhatsApp bot: weekly policy digest in plain language, relevant to their landscape

- USSD fallback (\*384#): basic signal alerts and key recommendations via feature phone

- Offline caching: the web app caches the last 30 signals and 10 briefs for offline reading

**5.5 Frontend System Design**

Translates the UX workflows and interface components above into the actual Next.js application — routes, component architecture, design tokens, and state management.

**Route structure (Next.js App Router)**

|                               |                           |                                                                                    |
|-------------------------------|---------------------------|------------------------------------------------------------------------------------|
| **Route**                     | **Primary user**          | **Purpose**                                                                        |
| **/dashboard**                | Programme Director        | Signal digest summary, brief approval queue, influence-event highlights            |
| **/signals**                  | Policy & Advocacy Officer | Kanban signal dashboard (Immediate / Near-term / Horizon / Watch)                  |
| **/signals/\[id\]/generate**  | Policy & Advocacy Officer | Evidence Matcher results, brief type + audience selection, generation trigger      |
| **/briefs/\[id\]/edit**       | Officer, Research Officer | Tiptap brief editor with inline citation tracking and audience switcher            |
| **/evidence**                 | Research Officer          | Searchable evidence library with filters (country, year, impact area, source type) |
| **/stakeholders**             | Programme Director        | Stakeholder CRM — contact records, brief history, submission tracker               |
| **/impact**                   | Programme Director        | Live influence map, quarterly impact report generator                              |
| **/field (mobile-optimised)** | Field Officer             | Lightweight submission form + cached signals/briefs for offline reading            |
| **/settings, /auth/\***       | All users                 | Role-based access management, Google Workspace SSO                                 |

**Component architecture**

Each interface element from Section 5.3 maps to a concrete implementation, built on shadcn/ui primitives so the component set stays consistent and accessible by default. The full shadcn/ui component set is installed up front (npx shadcn@latest add --all) rather than added piecemeal per screen, so every component below (and any UI work beyond this initial mapping) draws from one consistent, already-installed library:

|                        |                                                                                                                                                                           |
|------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **UX component**       | **Frontend implementation**                                                                                                                                               |
| **Signal dashboard**   | shadcn Kanban-style board (Card + Badge components) with drag handled via dnd-kit; urgency colour-coded using the same palette as this document (see design tokens below) |
| **Evidence library**   | shadcn Table + Command palette (cmdk) for keyword search; semantic search results merged client-side with relevance-score badges                                          |
| **Brief editor**       | Tiptap rich-text editor wrapped in a shadcn Card; inline citation chips link to evidence_item records; autosave via Server Actions on debounce                            |
| **Audience switcher**  | shadcn Tabs component; switching triggers a Server Action that re-runs the Brief Generator with a new audience parameter, diffed against the current draft                |
| **Translation assist** | Inline shadcn Popover showing the Twi rendering next to the source text, generated on demand rather than pre-computed                                                     |
| **Submission tracker** | shadcn Calendar + data table combination view, backed by the policy_signal and brief tables’ date fields                                                                  |

**Design tokens**

The product inherits Tropenbos’s own brand palette (the same colours used in this document) rather than a generic shadcn default theme, configured as CSS variables in Tailwind’s theme layer:

- Primary: \#0F6E56 (deep teal) — primary actions, active nav state, headers

- Accent: \#1D9E75 (mid teal) — borders, secondary emphasis, section dividers

- Surface tint: \#E1F5EE (pale teal) — callout boxes, selected states

- Text: \#2C2C2A (near-black) on white; \#444441 for secondary/meta text

- Typography: Inter for UI text (better on-screen legibility than a print-oriented face); source-evidence quotes in a serif face to visually distinguish quoted material from generated text

- Spacing & radius: Tailwind’s default scale, 8px base unit, 6px card radius to match a professional-but-approachable tone rather than sharp corporate edges

**State management & data flow**

- Server Components for initial page data (signals, evidence, briefs) — no client-side data-fetching library needed for the primary read paths

- Server Actions for all mutations (brief generation, evidence selection, approvals) — colocated with the routes that use them, per the Section 6 backend decision

- useOptimistic for the kanban board and evidence-selection UI, so drag/reorder and add/remove feel instant ahead of the Server Action round-trip

- React Hook Form + Zod for the manual brief generator input and stakeholder CRM forms, sharing validation schemas with the Server Actions to avoid duplicating rules client- and server-side

- SWR for the signal dashboard’s live polling (new signals arriving from the Policy Radar) — the one place client-side revalidation earns its cost

**Responsiveness & accessibility**

- Mobile-first breakpoints for the Field Officer routes (Section 5.4); desktop-first for the Programme Director / Policy Officer dashboard, which assumes a laptop in practice

- WCAG 2.1 AA target: keyboard navigation across the kanban board and evidence table, ARIA labels on urgency/relevance badges, minimum 4.5:1 contrast on all text — verified against the teal palette above

- Offline caching (Section 5.4) implemented via a service worker caching the last 30 signals and 10 briefs as static JSON, with a visible “offline — showing cached data” banner rather than failing silently

**5.6 Visual Design Brief (for Claude Design handoff)**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>How to use this section</strong></p>
<p>This brief is written to be uploaded directly to Claude Design for EviBrief (the Policy Intelligence &amp; Brief Generator module). It gives the creative direction, audience tension, and constraints needed to generate on-brief screens without a separate briefing conversation — upload this document (or export this section) as the first step of any design session.</p></td>
</tr>
</tbody>
</table>

**Design purpose**

The tool exists to move real evidence into real policy decisions inside a narrow window of time. The interface should feel like it belongs in that world: calm, credible, and quietly confident — not a generic SaaS admin dashboard, and not a decorative “green NGO” template. Every screen carries two competing needs at once: a ministry official or company sustainability lead must trust it within seconds of seeing it, while a field officer with patchy connectivity and a basic phone needs a stripped-down version that still respects them. Beauty here means clarity, restraint, and craft — not ornamentation.

**Mood**

*Grounded · evidence-forward · quietly confident · warm-professional · unhurried under pressure*

**Visual direction**

- Palette: extend Tropenbos's own identity (#0F6E56 deep teal, \#1D9E75 mid teal, \#E1F5EE pale teal) into a full UI system — don't invent a new brand. Add a warm off-white background rather than clinical white, and muted stone/sage neutrals for secondary surfaces.

- Typography: a clean humanist sans for UI text, paired with a serif for quoted evidence and citations — the same instinct this document uses to separate institutional voice from quoted material, carried into the product.

- Iconography: avoid literal leaf and tree clichés. If organic motifs are used at all, keep them abstract and structural — contour-line patterns echoing topographic maps of forest landscapes read as credible and cartographic, not decorative.

- Urgency indicators: no stoplight red/yellow/green — this is politically sensitive material, and alarmist colour reads wrong for a diplomatic audience. Express the Immediate / Near-term / Horizon / Watch taxonomy (Section 3.2) through a controlled warm-to-cool gradient within the teal-adjacent palette instead.

- Information density: the Policy & Advocacy Officer and Research Officer views can hold real density — evidence tables, citations, relevance scores. The Field Officer and community-facing views must strip to the single most important message per screen.

**Priority screens to design (in order)**

**1.** Signal Dashboard (kanban) — the daily-use screen; it sets the tone for the entire product

**2.** Brief Editor with audience switcher — the core value moment: AI-drafted, human-reviewed, citation-tracked

**3.** Evidence Library — search and browse; needs to read as authoritative, not just functional

**4.** Mobile Field Officer view — WhatsApp-digest style, offline-aware, feature-phone-conscious

**5.** Impact map / donor-facing dashboard — the “proof it worked” screen

**Anti-patterns to avoid**

- Generic admin-template look (sidebar + stat cards + default shadcn theme with no point of view)

- Leaf/tree icon overload or stock-photo forest imagery

- Red/yellow/green traffic-light urgency signalling

- An overly playful or “startup” tone — the subject matter (deforestation, land rights, policy influence) is serious

- Dense corporate BI dashboards that bury the human and ecological story behind the data

**Technical constraints to design within**

Built on Next.js 16.2, Tailwind CSS 4.3, and shadcn/ui (Section 6); design tokens and component mapping are defined in Section 5.5. Target both a desktop-first experience for the Programme Director and Policy Officer routes, and a mobile-first, low-bandwidth experience for the Field Officer routes (Section 5.4). WCAG 2.1 AA contrast is a hard requirement, not an aspiration — verify any new colour pairing against it before finalising.

**5.7 Motion & Animation Principles**

Animation is used to build trust and communicate the AI’s reasoning — never as decoration. Every motion choice below ties back to a specific product need. Built with Motion (for UI micro-interactions) and GSAP (for the more choreographed sequences, like the impact map).

|                                         |                                                                                                                                                                                                                                                                    |             |
|-----------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------|
| **Moment**                              | **Animation & rationale**                                                                                                                                                                                                                                          | **Library** |
| **Brief generation (up to 60s wait)**   | Sequenced progress states — “Reading evidence” → “Drafting” → “Verifying citations” — rather than a generic spinner. Makes the wait feel like visible, trustworthy work instead of a black box.                                                                    | Motion      |
| **Evidence match reveal**               | Evidence cards fade and rise in with a short stagger (60–80ms between cards) as the Evidence Matcher returns results, ordered by relevance score. Reinforces that each piece of evidence was individually retrieved, not dumped all at once.                       | Motion      |
| **Kanban signal board**                 | Spring-physics drag via layout animations; cards settle rather than snap. Urgency-column transitions use a soft colour crossfade, never an abrupt swap.                                                                                                            | Motion      |
| **Audience switcher**                   | Cross-fade/morph between audience versions of a brief, with shared citation elements staying visually anchored in place. Reinforces “same evidence, reframed” rather than “new document loaded.”                                                                   | Motion      |
| **Hallucination guard flags**           | A gentle pulse (not a hard blink) on a flagged claim, fading to a steady soft outline. Draws attention without reading as an error or alarm — this is a review prompt, not a failure state.                                                                        | Motion      |
| **Impact map (Impact Tracker)**         | Animated line-drawing of evidence-to-policy citation paths, tracing from an evidence node to the policy document that cited it. This is the one screen where a more choreographed, cinematic reveal earns its place — it is literally showing influence in motion. | GSAP        |
| **Offline banner (Field Officer view)** | Slides in from the top over ~200ms, no bounce. Informational, not disruptive — the Field Officer is often mid-task on a slow connection.                                                                                                                           | Motion      |

**Restraint rules**

- Durations stay in the 150–300ms range for micro-interactions; nothing longer than ~600ms except the impact map's line-drawing sequence, which is meant to be watched.

- Respect prefers-reduced-motion — fall back to instant state changes with no animation for users who request it.

- No animation on data that changes urgency classification automatically — automatic re-sorting without user action should never surprise someone mid-review.

- If in doubt, cut the animation. A screen that feels calm without motion is closer to the product's purpose than one that feels busy with it.

**6. Technical Stack**

|                          |                                                                                                                                                                                                                                   |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Layer**                | **Technology choices**                                                                                                                                                                                                            |
| **Frontend**             | Next.js 16.2 (App Router, Turbopack default, React 19.2) — server-side rendering for fast initial load in Ghana's variable connectivity; Tailwind CSS 4.3 + shadcn/ui for styling (full component set installed, see Section 5.5) |
| **Backend API**          | Next.js Server Actions & Route Handlers — no separate backend service; colocated with the frontend                                                                                                                                |
| **Database**             | Supabase (PostgreSQL 18 + pgvector) with Prisma ORM — single system for relational data and vector similarity search                                                                                                              |
| **AI orchestration**     | LangChain.js — RAG pipeline, prompt management, and evidence retrieval chain (TypeScript, runs in Server Actions)                                                                                                                 |
| **Primary AI model**     | Gemini 3.6 Flash (free tier) — brief generation, signal classification, audience tailoring                                                                                                                                        |
| **Embedding model**      | Gemini Embedding 2 (free tier) — embeddings for all evidence, public and community-sourced                                                                                                                                        |
| **Web monitoring**       | Playwright (Node.js) — structured source scraping, run as scheduled Inngest jobs                                                                                                                                                  |
| **Search & news**        | Gemini API with Google Search grounding — unstructured policy signal detection                                                                                                                                                    |
| **Background jobs**      | Inngest — scheduled radar jobs, evidence matching triggers, and weekly Impact Tracker runs                                                                                                                                        |
| **File uploads**         | Uploadthing — PDF and document ingestion for the knowledge base                                                                                                                                                                   |
| **Email**                | Resend — morning digest and notification emails                                                                                                                                                                                   |
| **Authentication**       | Auth.js (NextAuth.js v5) + Google Workspace SSO                                                                                                                                                                                   |
| **Document export**      | Tiptap — rich-text brief editor; docx npm library — Word export; Pandoc — PDF export                                                                                                                                              |
| **WhatsApp integration** | WhatsApp Business API via Twilio or 360dialog (Ghana-supported)                                                                                                                                                                   |
| **USSD**                 | Africa's Talking USSD gateway — Ghana network coverage for field officers                                                                                                                                                         |
| **Hosting**              | Vercel — application hosting; Supabase — managed database (region selected for latency and data-residency review)                                                                                                                 |
| **Monitoring**           | Sentry (error tracking); PostHog (usage analytics, self-hosted)                                                                                                                                                                   |

**6.1 Infrastructure free tier (MVP)**

The AI stack (Gemini free tier, above) is the standing choice for cost reasons, not just an MVP substitute. The infrastructure items below, however, are still MVP-scoped and have their own upgrade path once the tool moves past prototyping:

|                                     |                                                                                                             |
|-------------------------------------|-------------------------------------------------------------------------------------------------------------|
| **Layer**                           | **Free-tier substitute (MVP only)**                                                                         |
| **Hosting**                         | Vercel Hobby, under a developer's personal account — Hobby is licensed for personal/non-commercial use only |
| **Database**                        | Supabase Free — 500MB, pauses after 7 days of inactivity                                                    |
| **Background jobs / files / email** | Inngest, Uploadthing, and Resend free tiers — same tools as production, just on their free plans            |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Graduation triggers — move off free tier when:</strong></p>
<p>(1) Any real community-sourced field data needs AI processing — see the training-data risk in Section 4.3; this must be resolved (paid Gemini/Vertex AI, or hold the data out of the pipeline) before that data touches any model, on the MVP or in production. (2) The tool moves from prototype to Tropenbos’s own deployment — Vercel Hobby is licensed for personal, non-commercial use only. (3) Usage needs exceed free-tier rate limits (Gemini: ~1,500 requests/day) or Supabase’s 500MB / 7-day-inactivity-pause limits. At that point hosting and database move to their paid tiers — the AI stack (Gemini free tier) stays as-is unless usage volume forces an upgrade there too.</p></td>
</tr>
</tbody>
</table>

**7. Phased Build Roadmap**

**Phase 1 — Foundation (months 1–3)**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Goal</strong></p>
<p>A working evidence library and manual brief generation tool. Staff can search evidence and use AI to draft briefs, even before the radar is automated.</p></td>
</tr>
</tbody>
</table>

- Knowledge base ingestion: ingest Tropenbos Ghana's existing research reports and key TBI network publications

- Evidence classification UI: a required tagging step at ingestion time (public / community-sourced / internal, Section 4.3) \u2014 manual for Phase 1, blocks an item from the AI pipeline until set

- Evidence search UI: keyword + semantic search across the knowledge base

- Manual brief generator: staff paste a policy document, select audience, and receive a draft brief

- Basic brief editor with export to Word and Google Docs

- Staff authentication and role-based access

*Success metric: Policy team uses the tool to produce at least 3 briefs in the first quarter; generation time under 2 hours. Built entirely on free tiers per Section 6.1 — zero cost during this phase.*

**Phase 2 — Automation (months 4–6)**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Goal</strong></p>
<p>The Policy Radar goes live. Signals are detected and classified automatically. Staff shift from hunting for signals to reviewing a curated digest.</p></td>
</tr>
</tbody>
</table>

- Policy Radar: monitoring of Ghana Gazette, Forestry Commission, Cocobod, EUDR sources

- Signal classification: urgency and relevance scoring with staff feedback loop

- Evidence Matcher: automatic evidence retrieval triggered by signal detection

- Signal dashboard: kanban UI with morning digest email

- Hallucination guard on generated briefs

*Success metric: At least 2 policy windows detected with \>1 week lead time before Phase 3.*

**Phase 3 — Audience intelligence (months 7–9)**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Goal</strong></p>
<p>One-click audience switching. The same brief reframed for a ministry, a company, and a community leader.</p></td>
</tr>
</tbody>
</table>

- Audience tailoring: reframing engine with profiles for all five audience types

- Stakeholder CRM: basic contact records with brief history

- Translation assist: Twi translation of key messages for community-facing versions

- Submission tracker: calendar of upcoming policy windows

- WhatsApp policy digest for field officers

*Success metric: At least one brief reused across 3 audience types without full rewrite.*

**Phase 4 — Impact & learning (months 10–12)**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Goal</strong></p>
<p>The feedback loop closes. Tropenbos can demonstrate — to donors, partners, and itself — where its evidence has influenced decisions.</p></td>
</tr>
</tbody>
</table>

- Impact Tracker: logging and detection of downstream citations and policy adoption

- Quarterly impact report generator: auto-drafted donor reporting section

- Evidence quality feedback: which evidence items are most cited and most useful

- USSD fallback for field officers in low-connectivity areas

- AI stack scale review: confirm whether usage has outgrown Gemini's free tier and, per Section 6.1, whether hosting/database need to move to paid Supabase/Vercel plans

*Success metric: At least one traceable influence event documented within the year (e.g. a Ghana FC document citing Tropenbos evidence detected automatically).*

**8. Resource Requirements**

**8.1 Team**

|                                           |                                                                                                                                                 |
|-------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| **Role**                                  | **Scope & time commitment**                                                                                                                     |
| **Lead developer (full-stack)**           | Phases 1–4: full-time for 12 months. Full-stack Next.js (Server Actions, Route Handlers), AI pipeline integration (LangChain.js, Inngest jobs). |
| **AI / data engineer**                    | Phases 1–4: 0.5 FTE. RAG pipeline, embedding management, model evaluation, hallucination guard.                                                 |
| **UX designer**                           | Phases 1–2: 0.25 FTE. Signal dashboard, brief editor, mobile-responsive layout.                                                                 |
| **Tropenbos policy officer (internal)**   | All phases: 0.2 FTE. Brief quality review, audience profile validation, evidence annotation.                                                    |
| **Tropenbos research officer (internal)** | Phases 1–2: 0.1 FTE. Knowledge base curation, evidence quality assurance.                                                                       |

**8.2 Infrastructure costs (indicative, monthly)**

|                                                                       |                                                                                                        |
|-----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| **Item**                                                              | **Estimated monthly cost (USD)**                                                                       |
| **Gemini API — brief generation + signal classification (free tier)** | \$0 while within free-tier rate limits (~1,500 requests/day); costs resume if volume forces an upgrade |
| **Supabase (database) + Vercel (app hosting)**                        | \$25–50                                                                                                |
| **Web monitoring compute (Playwright)**                               | \$20–40                                                                                                |
| **WhatsApp Business API**                                             | \$30–60 (per-message pricing)                                                                          |
| **Africa's Talking USSD (Ghana)**                                     | \$10–30                                                                                                |
| **Gemini API (embeddings — all evidence)**                            | \$0 (within free-tier embedding limits)                                                                |
| **Total estimated monthly operating cost**                            | \$85–210                                                                                               |

**8.3 Build cost estimate**

|                                                |                          |
|------------------------------------------------|--------------------------|
| **Phase**                                      | **Estimated cost (USD)** |
| **Phase 1 — Foundation (3 months)**            | \$18,000–25,000          |
| **Phase 2 — Automation (3 months)**            | \$15,000–20,000          |
| **Phase 3 — Audience intelligence (3 months)** | \$12,000–18,000          |
| **Phase 4 — Impact & learning (3 months)**     | \$10,000–15,000          |
| **Total 12-month build estimate**              | \$55,000–78,000          |

**9. Risks & Mitigations**

|                                                               |              |                                                                                                                                                                                                                                                                                                                                                                                                 |
|---------------------------------------------------------------|--------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Risk**                                                      | **Severity** | **Mitigation**                                                                                                                                                                                                                                                                                                                                                                                  |
| **AI-generated brief contains factually incorrect claims**    | High         | Hallucination guard verifies every statistical claim against cited evidence. All briefs require human review before submission. Version control logs every edit.                                                                                                                                                                                                                                |
| **Policy signal missed due to monitoring gap**                | Medium       | Radar covers multiple source types. Staff receive a weekly gap analysis flagging sources that returned no new signals (may indicate a monitoring failure rather than a quiet week).                                                                                                                                                                                                             |
| **Community data exposed to third-party AI APIs**             | High         | Strict data classification at ingestion. With the AI stack consolidated on Gemini free tier for cost reasons, community-sourced data is held out of the AI pipeline entirely until either paid Gemini/Vertex AI (no training on data) is in place, or explicit anonymisation and consent is obtained. This is a standing constraint, not a one-time check, until the stack moves off free tier. |
| **Staff capacity to review AI drafts is insufficient**        | Medium       | Phase 1 builds the habit gradually. Brief quality improves with each feedback cycle. A structured 30-minute review checklist reduces the cognitive load of quality assurance.                                                                                                                                                                                                                   |
| **Internet connectivity in Ghana limits radar effectiveness** | Low          | Radar jobs run server-side with retry logic. The morning digest is designed to function on low bandwidth. Offline caching for the staff dashboard.                                                                                                                                                                                                                                              |
| **Over-reliance on AI reduces staff policy expertise**        | Medium       | AI generates drafts; staff make all strategic decisions about framing, timing, and stakeholder relationships. The tool is positioned as a research assistant, not a decision-maker.                                                                                                                                                                                                             |

**10. Success Metrics & Evaluation**

**10.1 Operational metrics (quarterly)**

- Number of policy signals detected and classified

- Brief generation time: target median under 4 hours from signal to approved draft

- Evidence match quality: staff rating of top-8 evidence retrieval (target: \>80% rated relevant)

- Brief volume: number of briefs generated, reviewed, and submitted per quarter

- Audience coverage: distribution across ministry, company, donor, and community briefs

**10.2 Strategic impact metrics (annual)**

- Traceable influence events: policy documents, legislation, or company commitments citing Tropenbos evidence

- Policy window capture rate: proportion of Immediate-urgency signals that resulted in a Tropenbos submission within the window

- Contribution to 2030 targets: estimated additional hectares and livelihoods reached through policy influence enabled by the module

- Network leverage: number of TBI partner organisations that adopted or adapted a brief produced in Ghana

**10.3 Evaluation approach**

A lightweight quarterly review process: the Policy & Advocacy Officer produces a one-page evidence narrative covering wins, missed windows, evidence gaps, and one suggested improvement to the system. This feeds into the Impact Tracker and informs the next quarter's evidence ingestion priorities.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Next step</strong></p>
<p>This specification is the basis for a procurement brief for development partners or a grant application for build funding. The recommended next step is a two-day co-design workshop with the Tropenbos Ghana programme team to validate the signal sources, evidence base scope, and Phase 1 user stories before development begins.</p></td>
</tr>
</tbody>
</table>

**10. Agentic Development Skills**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>How to use this section</strong></p>
<p>This section lists the skill files to create alongside agents.md when using an agentic coding tool (e.g. Claude Code) to build this project. Each skill is a focused reference the agent should consult for that domain, keeping agents.md itself as the task sequence rather than a dumping ground for every implementation detail.</p></td>
</tr>
</tbody>
</table>

|                         |                                                                                                                                                                                                                                                                                                            |
|-------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Skill file**          | **What it should contain**                                                                                                                                                                                                                                                                                 |
| **gemini-integration**  | Gemini API call patterns for both generation (3.6 Flash) and embeddings (Embedding 2): free-tier rate limiting (~1,500 req/day, 15 RPM), exponential backoff on 429s, batching strategy for embeddings, and the exact prompt structure from Section 3.4's AI model configuration.                          |
| **evidence-governance** | Enforces Section 4.3's standing constraint: community-sourced and unpublished field data must never be sent to the AI pipeline until the free-tier training-data risk is resolved. The agent should treat this as a hard gate in code (a data-classification check before any Gemini call), not a comment. |
| **supabase-schema**     | Prisma schema conventions matching Section 4.1's core entities (policy_signal, evidence_item, brief, influence_event, stakeholder), pgvector setup, and migration patterns for the free-tier Supabase project (500MB budget, so schema and index choices matter).                                          |
| **server-actions**      | Next.js Server Action conventions: colocation with routes per Section 5.5, Zod validation shared with React Hook Form, error handling and optimistic-update patterns (useOptimistic) for the kanban and evidence-selection UI.                                                                             |
| **design-system**       | The design tokens, component-to-shadcn mapping, and motion principles from Sections 5.5–5.7 — so generated UI code pulls from the same palette, type scale, and animation rules rather than shadcn defaults.                                                                                               |
| **inngest-jobs**        | Scheduled job patterns for the Policy Radar (Section 3.2 source cadences), Evidence Matcher triggers, and weekly Impact Tracker runs — including how to structure jobs so free-tier Inngest limits aren't exceeded.                                                                                        |
| **hallucination-guard** | The post-generation fact-check pass from Section 3.4: how to verify every cited statistic against the evidence context and flag unsupported claims, including the UI contract with the pulse-flag animation in Section 5.7.                                                                                |

**Suggested repo layout**

- .claude/skills/gemini-integration/SKILL.md

- .claude/skills/evidence-governance/SKILL.md

- .claude/skills/supabase-schema/SKILL.md

- .claude/skills/server-actions/SKILL.md

- .claude/skills/design-system/SKILL.md

- .claude/skills/tiptap-editor/SKILL.md

- .claude/skills/inngest-jobs/SKILL.md

- .claude/skills/hallucination-guard/SKILL.md

- agents.md — references the skills above per phase, sequenced against Section 7's roadmap

evidence-governance is the one skill that should be loaded on every task touching the AI pipeline, regardless of which build phase the agent is working in — it is a standing constraint, not a phase-specific concern.

**10.1 Skills by build phase**

How the skills above map onto the four phases in Section 7's roadmap. agents.md should reference skills by name at the point each phase introduces them — evidence-governance is the one exception, loaded on every phase from Phase 2 onward since it's a standing constraint rather than a phase-specific concern.

|                                     |                                                                                                                                                                    |
|-------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Roadmap phase**                   | **Skills to reference**                                                                                                                                            |
| **Phase 1 — Foundation**            | supabase-schema, server-actions (incl. Auth.js + Uploadthing), design-system, tiptap-editor (basic editor, no citation chips yet)                                  |
| **Phase 2 — Automation**            | gemini-integration, evidence-governance (now enforced on every call), inngest-jobs, hallucination-guard, tiptap-editor (citation chips + flag rendering added)     |
| **Phase 3 — Audience intelligence** | tiptap-editor (audience-switcher cross-fade), design-system (motion), gemini-integration (re-generation with new audience parameter)                               |
| **Phase 4 — Impact & learning**     | inngest-jobs (weekly Impact Tracker run), design-system (GSAP impact map line-drawing), evidence-governance (AI stack scale review, Section 7's Phase 4 task list) |

**10.2 Vendor & official skills**

In addition to the 8 project-specific skills above, the following vendor-published and Anthropic-official skills should be installed in Claude Code before starting the build. These are general-purpose skills for their respective tools; the project-specific skills in Section 10 layer this project's actual conventions on top of them.

**Built into Claude Code's default marketplace (claude-plugins-official)**

|                     |                                                         |                                                                                                                                               |
|---------------------|---------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| **Skill**           | **Install**                                             | **How it's used in this project**                                                                                                             |
| **supabase**        | /plugin install supabase@claude-plugins-official        | Postgres schema design, RLS policies, auth patterns — complements the project's own supabase-schema skill for the Section 6.1 free-tier setup |
| **vercel**          | /plugin install vercel@claude-plugins-official          | Deployment configuration; Vercel Hobby limits and the later Pro-tier migration trigger from Section 6.1                                       |
| **playwright**      | /plugin install playwright@claude-plugins-official      | Writing and maintaining the Policy Radar's scraping jobs (Section 3.2), run via Inngest                                                       |
| **sentry**          | /plugin install sentry@claude-plugins-official          | Error tracking setup (Section 6, Monitoring row)                                                                                              |
| **prisma**          | /plugin install prisma@claude-plugins-official          | General Prisma schema/migration patterns, complementing the project's supabase-schema skill                                                   |
| **resend**          | /plugin install resend@claude-plugins-official          | Morning digest and notification email setup (Section 6, Email row)                                                                            |
| **frontend-design** | /plugin install frontend-design@claude-plugins-official | Anthropic's own general UI/UX skill — complements the project's design-system skill and Section 5.6's visual brief                            |

**Vendor-published (separate marketplace)**

<table>
<colgroup>
<col style="width: 16%" />
<col style="width: 30%" />
<col style="width: 52%" />
</colgroup>
<tbody>
<tr class="odd">
<td><strong>Skill</strong></td>
<td><strong>Install</strong></td>
<td><strong>How it's used in this project</strong></td>
</tr>
<tr class="even">
<td><strong>inngest</strong></td>
<td>/plugin marketplace add inngest/inngest-claude-code-plugin<br />
/plugin install inngest@inngest-claude-code-plugin</td>
<td>Background job and scheduling patterns — complements the project's inngest-jobs skill for Policy Radar cadences, Evidence Matcher triggers, and Impact Tracker runs (Sections 3.2, 3.5)</td>
</tr>
<tr class="odd">
<td><strong>langchain-skills</strong></td>
<td>/plugin marketplace add langchain-ai/langchain-skills<br />
/plugin install langchain-skills@langchain-skills</td>
<td>RAG pipeline orchestration for the Evidence Matcher (Section 3.3)</td>
</tr>
<tr class="even">
<td><strong>gsap-skills</strong></td>
<td>/plugin marketplace add greensock/gsap-skills<br />
/plugin install gsap-skills@greensock</td>
<td>The impact map's line-drawing animation sequence (Section 5.7) — the one place GSAP is used over Motion</td>
</tr>
</tbody>
</table>

**Different installer (not /plugin)**

|                    |                                                                         |                                                                                                              |
|--------------------|-------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| **Skill**          | **Install**                                                             | **How it's used in this project**                                                                            |
| **gemini-api-dev** | npx skills add google-gemini/gemini-skills --skill gemini-api-dev       | Google's own official Gemini SDK patterns — complements the project's gemini-integration skill (Section 3.4) |
| **posthog**        | Official MCP setup: posthog.com/docs/model-context-protocol/claude-code | Usage analytics (Section 6, Monitoring row)                                                                  |
| **shadcn/ui**      | No separate install — npx shadcn@latest init installs it automatically  | Component library; activates once components.json exists (Section 5.5)                                       |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Deliberately not installed</strong></p>
<p>Auth.js/NextAuth, Tiptap, Motion, and Uploadthing have no established vendor skill worth installing — reviewed during setup and found either too thin or a poor fit (see the Auth.js review in project history). These are covered instead by the project-specific server-actions, tiptap-editor, and design-system skills in Section 10, which encode this project's actual requirements rather than generic tool usage.</p></td>
</tr>
</tbody>
</table>

Tropenbos Ghana • EviBrief • Technical Specification v1.0

*Making knowledge work for people and forests — Tropenbos International Network Strategy 2023–2027*
