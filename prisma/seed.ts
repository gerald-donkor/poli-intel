import { StaffRole, Classification, Urgency, Relevance, ImpactArea, Geography, EvidenceSourceType, AudienceTarget, BriefAudience, BriefType, BriefStatus, EvidenceMatchOutcome, GenerationStage, FlagReason, FlagStatus, InfluenceEventType, InfluenceDetectionMethod } from '../lib/generated/prisma/enums';
import type { StaffUser, EvidenceItem } from '../lib/generated/prisma/client';
import { createEvidenceShell, completeEvidenceExtraction, classifyEvidenceItem, createFieldSubmission } from '../lib/db/evidence';
import { embedEvidenceCandidates } from '../lib/ai/embeddings';
import { writeChunkEmbeddings } from '../lib/db/evidence-vectors';
import { chunkDocument } from '../lib/ingestion/chunk';
import { prisma } from '../lib/db/client';

// Note: All data generated here is synthetic or public reference data.
// It is intended for demo purposes and is not real Tropenbos Ghana data.

async function main() {
  console.log('Starting seed...');
  
  // Create staff users
  const staff = [
    { email: process.env.SEED_DIRECTOR_EMAIL || 'director@tropenbosghana.example', role: StaffRole.programme_director, name: 'Demo Director' },
    { email: process.env.SEED_POLICY_OFFICER_EMAIL || 'policy@tropenbosghana.example', role: StaffRole.policy_advocacy_officer, name: 'Demo Policy Officer' },
    { email: process.env.SEED_RESEARCH_OFFICER_EMAIL || 'research@tropenbosghana.example', role: StaffRole.research_officer, name: 'Demo Research Officer' },
    { email: process.env.SEED_FIELD_OFFICER_EMAIL || 'field@tropenbosghana.example', role: StaffRole.field_officer, name: 'Demo Field Officer' },
  ];

  const createdStaff = await Promise.all(staff.map(async s => {
    if (s.email.endsWith('@tropenbosghana.example')) {
      console.warn(`Warning: Using placeholder email ${s.email}. Set SEED_* variables for real accounts.`);
    }
    return prisma.staffUser.upsert({
      where: { email: s.email },
      update: { name: s.name },
      create: { email: s.email, name: s.name, role: s.role },
    });
  }));

  const director = createdStaff.find((s: StaffUser) => s.role === StaffRole.programme_director)!;
  const policyOfficer = createdStaff.find((s: StaffUser) => s.role === StaffRole.policy_advocacy_officer)!;
  const researchOfficer = createdStaff.find((s: StaffUser) => s.role === StaffRole.research_officer)!;
  const fieldOfficer = createdStaff.find((s: StaffUser) => s.role === StaffRole.field_officer)!;

  // Evidence Items
  // 1. EUDR
  const eudrCitation = 'EUDR-2023-1115';
  let eudrItem = await prisma.evidenceItem.findUnique({ where: { citationKey: eudrCitation } });
  if (!eudrItem) {
    const shellResult = await createEvidenceShell({
      title: 'EU Deforestation Regulation (EUDR) Official Text',
      sourceType: EvidenceSourceType.literature,
      citationKey: eudrCitation,
      ingestedById: researchOfficer.id,
      authors: ['European Commission'],
      year: 2023,
      country: 'European Union',
      impactArea: ImpactArea.diversified_production,
      sourceFileName: 'eudr-regulation-2023.pdf',
      sourceUrl: 'https://example.com/eudr.pdf'
    });
    if (!shellResult.ok) throw new Error(`Failed to create EUDR shell: ${shellResult.reason}`);
    eudrItem = await prisma.evidenceItem.findUnique({ where: { id: shellResult.evidenceItemId } });

    const fullText = 'The European Union Deforestation Regulation (EUDR) mandates that cocoa, timber, and other commodities entering the EU market must be demonstrably deforestation-free. Operators must provide geolocation coordinates for the plots of land where the commodities were produced.';
    await completeEvidenceExtraction({
      evidenceItemId: eudrItem!.id,
      fullText,
      chunks: chunkDocument(fullText, null),
    });

    await classifyEvidenceItem({
      evidenceItemId: eudrItem!.id,
      actorId: researchOfficer.id,
      newClassification: Classification.public_published,
      reason: 'Public policy document',
    });
  }

  // 2. Ghana Forestry Commission Notice
  const fcCitation = 'GFC-2024-01';
  let fcItem = await prisma.evidenceItem.findUnique({ where: { citationKey: fcCitation } });
  if (!fcItem) {
    const shellResult = await createEvidenceShell({
      title: 'Ghana Forestry Commission Notice on Logging',
      sourceType: EvidenceSourceType.literature,
      citationKey: fcCitation,
      ingestedById: researchOfficer.id,
      authors: ['Forestry Commission Ghana'],
      year: 2024,
      country: 'Ghana',
      impactArea: ImpactArea.community_forestry,
      sourceFileName: 'gfc-notice-2024.pdf',
      sourceUrl: 'https://example.com/gfc.pdf'
    });
    if (!shellResult.ok) throw new Error(`Failed to create FC shell: ${shellResult.reason}`);
    fcItem = await prisma.evidenceItem.findUnique({ where: { id: shellResult.evidenceItemId } });

    const fullText = 'The Ghana Forestry Commission has announced new stricter quotas for legal logging in off-reserve areas starting Q3 2024, aiming to halt rapid canopy loss outside gazetted forests.';
    await completeEvidenceExtraction({
      evidenceItemId: fcItem!.id,
      fullText,
      chunks: chunkDocument(fullText, null),
    });

    await classifyEvidenceItem({
      evidenceItemId: fcItem!.id,
      actorId: researchOfficer.id,
      newClassification: Classification.public_published,
      reason: 'Public announcement',
    });
  }

  // 3. Unpublished Internal
  const internalCitation = 'INTERNAL-DRAFT-2024';
  let internalItem = await prisma.evidenceItem.findUnique({ where: { citationKey: internalCitation } });
  if (!internalItem) {
    const shellResult = await createEvidenceShell({
      title: 'Draft Observations on CREMA Governance',
      sourceType: EvidenceSourceType.research,
      citationKey: internalCitation,
      ingestedById: researchOfficer.id,
      authors: ['Tropenbos Research Team'],
      year: 2024,
      country: 'Ghana',
      impactArea: ImpactArea.community_forestry,
      sourceFileName: 'crema-draft.docx',
      sourceUrl: null
    });
    if (!shellResult.ok) throw new Error(`Failed to create internal shell: ${shellResult.reason}`);
    internalItem = await prisma.evidenceItem.findUnique({ where: { id: shellResult.evidenceItemId } });

    const fullText = 'Initial notes suggest that several CREMAs are struggling with fund allocation transparency, though more interviews are needed. This is an early draft, not for public citation.';
    await completeEvidenceExtraction({
      evidenceItemId: internalItem!.id,
      fullText,
      chunks: chunkDocument(fullText, null),
    });
    // Remains unpublished_internal by default
  }

  // Embed eligible candidates (public_published)
  const allItems = [eudrItem, fcItem, internalItem].filter(Boolean) as EvidenceItem[];
  const eligibleItems = await prisma.evidenceItem.findMany({
    where: { id: { in: allItems.map(i => i.id) } },
    select: { id: true, title: true, classification: true, fullText: true },
  });

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.log('Embedding evidence...');
    const result = await embedEvidenceCandidates(eligibleItems.map(i => ({
      id: i.id,
      title: i.title,
      classification: i.classification,
      text: i.fullText
    })));

    if (!result.ok) {
      throw new Error(`Embedding failed: ${result.failure}`);
    }

    if (result.embedded.length > 0) {
      await writeChunkEmbeddings(result.embedded.map(v => ({ id: v.id, vector: v.vector })));
      console.log(`Embedded ${result.embedded.length} items`);
    }
  } else {
    console.error('Warning: GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY not set.');
    throw new Error('GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY must be set to run the seed script and prove the pipeline.');
  }

  // 4. Community Sourced (Field Submission)
  const submissionKey = 'field-sub-demo-123';
  let fieldSub = await prisma.evidenceItem.findUnique({ where: { submissionKey } });
  if (!fieldSub) {
    const fsResult = await createFieldSubmission({
      title: 'Illegal logging near Juabeso',
      observation: 'We observed three trucks leaving the eastern edge of Juabeso-Bia without proper manifestos. Community members state this has been ongoing for weeks.',
      submissionKey,
      ingestedById: fieldOfficer.id,
      observedAt: new Date(Date.now() - 86400000), // 1 day ago
      locationNote: 'Eastern edge of Juabeso-Bia'
    });
    fieldSub = await prisma.evidenceItem.findUnique({ where: { id: fsResult.evidenceItemId } });
  }

  // Signals
  const eudrSignalUrl = 'https://example.com/eudr-notice';
  let eudrSignal = await prisma.policySignal.findFirst({ where: { sourceUrl: eudrSignalUrl } });
  if (!eudrSignal) {
    eudrSignal = await prisma.policySignal.create({
      data: {
        title: 'EUDR Compliance Deadlines Confirmed',
        summaryText: 'The EU has published definitive deadlines for operators to demonstrate full traceability for cocoa and timber.',
        sourceUrl: eudrSignalUrl,
        sourceName: 'European Union Notice Board',
        urgency: Urgency.immediate,
        relevance: Relevance.core,
        impactArea: ImpactArea.diversified_production,
        geography: Geography.international,
        status: 'reviewed',
        detectedAt: new Date(),
        windowClosesAt: new Date(Date.now() + 30 * 86400000),
      }
    });
  }

  const gapSignalUrl = 'https://example.com/unrelated-policy';
  let gapSignal = await prisma.policySignal.findFirst({ where: { sourceUrl: gapSignalUrl } });
  if (!gapSignal) {
    gapSignal = await prisma.policySignal.create({
      data: {
        title: 'Proposed Changes to Urban Zoning',
        summaryText: 'A proposed regulation on urban residential zoning that does not directly impact forestry.',
        sourceUrl: gapSignalUrl,
        sourceName: 'Ghana Local Government Board',
        urgency: Urgency.watch,
        relevance: Relevance.background,
        impactArea: ImpactArea.cross_cutting,
        geography: Geography.ghana_national,
        status: 'new',
        detectedAt: new Date(),
      }
    });
  }

  // Radar Matcher Runs
  const eudrMatchRun = await prisma.evidenceMatchRun.findFirst({ where: { signalId: eudrSignal.id } });
  if (!eudrMatchRun) {
    await prisma.evidenceMatchRun.create({
      data: {
        signalId: eudrSignal.id,
        outcome: EvidenceMatchOutcome.matched,
        candidateCount: 1,
        matchedCount: 1,
        startedAt: new Date(),
        finishedAt: new Date(),
      }
    });

    const chunk = await prisma.evidenceChunk.findFirst({ where: { evidenceItemId: eudrItem!.id } });
    if (chunk) {
      await prisma.signalEvidenceMatch.create({
        data: {
          signalId: eudrSignal.id,
          evidenceItemId: eudrItem!.id,
          similarity: 0.85,
          rank: 1,
          chunkOrdinal: chunk.ordinal,
        }
      });
    }
  }

  const gapMatchRun = await prisma.evidenceMatchRun.findFirst({ where: { signalId: gapSignal.id } });
  if (!gapMatchRun) {
    await prisma.evidenceMatchRun.create({
      data: {
        signalId: gapSignal.id,
        outcome: EvidenceMatchOutcome.gap,
        candidateCount: 0,
        matchedCount: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
      }
    });
  }

  // Brief Generation
  const briefAudience = BriefAudience.ghana_ministry_official;
  let brief = await prisma.brief.findFirst({ where: { signalId: eudrSignal.id } });
  if (!brief) {
    // Generate the brief records
    brief = await prisma.brief.create({
      data: {
        signalId: eudrSignal.id,
        briefType: BriefType.policy_brief,
        audience: briefAudience,
        status: BriefStatus.draft,
        currentVersion: 1,
        createdById: director.id,
        evidenceSet: {
          create: [{ evidenceItemId: eudrItem!.id }]
        }
      }
    });

    const bodyText = 'The EUDR compliance deadlines require immediate action. Operators must prove cocoa is deforestation-free. Importantly, a recent report shows 90% of local farmers are unaware of these rules.';

    const briefVersion = await prisma.briefVersion.create({
      data: {
        briefId: brief.id,
        version: 1,
        audience: briefAudience,
        bodyText,
        documentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: bodyText }] }] },
        createdById: director.id,
      }
    });

    await prisma.briefGeneration.create({
      data: {
        createdById: director.id,
        briefType: BriefType.policy_brief,
        audience: briefAudience,
        signalId: eudrSignal.id,
        policyText: 'The EU has published definitive deadlines for operators to demonstrate full traceability for cocoa and timber.',
        evidenceItemIds: [eudrItem!.id],
        stage: GenerationStage.complete,
        briefId: brief.id,
        startedAt: new Date(),
        updatedAt: new Date(),
      }
    });

    // Hallucination Flag (Open)
    const claim = 'Importantly, a recent report shows 90% of local farmers are unaware of these rules.';
    const anchorFrom = bodyText.indexOf(claim);
    const anchorTo = anchorFrom + claim.length;

    await prisma.hallucinationFlag.create({
      data: {
        briefVersionId: briefVersion.id,
        anchorFrom,
        anchorTo,
        claimText: claim,
        reason: FlagReason.unsupported,
        checkedEvidenceItemIds: [eudrItem!.id],
        status: FlagStatus.open,
      }
    });
  }

  // Stakeholder CRM
  let stakeholder = await prisma.stakeholder.findFirst({ where: { name: 'Dr. Kwame Mensah', organisation: 'Ministry of Lands and Natural Resources' } });
  if (!stakeholder) {
    stakeholder = await prisma.stakeholder.create({
      data: {
        name: 'Dr. Kwame Mensah',
        organisation: 'Ministry of Lands and Natural Resources',
        role: 'Director of Policy',
        audienceType: AudienceTarget.ministry,
      }
    });
    
    // Add brief share history
    await prisma.stakeholderBrief.create({
      data: {
        stakeholderId: stakeholder.id,
        briefId: brief.id,
        sharedById: director.id,
      }
    });
  }

  // Impact Event
  const sourceKey = 'national-strategy-2025';
  const influenceEvent = await prisma.influenceEvent.findFirst({ where: { sourceKey } });
  if (!influenceEvent) {
    await prisma.influenceEvent.create({
      data: {
        briefId: brief.id,
        eventType: InfluenceEventType.national_strategy,
        detectionMethod: InfluenceDetectionMethod.logged_by_person,
        sourceKey,
        detectedAt: new Date(),
        description: 'The National Cocoa Strategy adopted key recommendations from the EUDR compliance brief.',
        quotedText: 'Aligning with the urgent need for deforestation-free traceability as recommended by Tropenbos...',
        verified: true,
        verifiedById: director.id,
        verifiedAt: new Date(),
        loggedById: policyOfficer.id,
      }
    });
  }

  console.log('Seed completed successfully.');
  const evidenceCount = await prisma.evidenceItem.count();
  const signalCount = await prisma.policySignal.count();
  const briefCount = await prisma.brief.count();
  console.log(`Summary: ${evidenceCount} Evidence Items, ${signalCount} Signals, ${briefCount} Briefs.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });