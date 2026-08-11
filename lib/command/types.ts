import type {
  AudienceTarget,
  EvidenceMatchOutcome,
  EvidenceSourceType,
  Geography,
  ImpactArea,
  Relevance,
  StaffRole,
  Urgency,
} from "@/lib/generated/prisma/enums";

export type CommandDestination = {
  kind: "destination";
  id: string;
  label: string;
  description: string;
  href: string;
  shortcut: string;
};

export type CommandQuickStart = {
  kind: "quick-start";
  id: string;
  label: string;
  description: string;
  href: string;
};

export type CommandSignal = {
  kind: "signal";
  id: string;
  title: string;
  sourceName: string;
  detectedAt: string;
  urgency: Urgency;
  relevance: Relevance;
  impactArea: ImpactArea;
  geography: Geography;
  audienceTarget: AudienceTarget | null;
  matchCount: number;
  latestMatchOutcome: EvidenceMatchOutcome | null;
};

export type CommandEvidence = {
  kind: "evidence";
  id: string;
  title: string;
  citationKey: string;
  year: number | null;
  country: string | null;
  impactArea: ImpactArea | null;
  sourceType: EvidenceSourceType;
  embeddedChunkCount: number;
};

export type CommandIndex = {
  role: StaffRole;
  destinations: CommandDestination[];
  quickStarts: CommandQuickStart[];
  signals: CommandSignal[];
  evidence: CommandEvidence[];
  limits: {
    signals: number;
    evidence: number;
  };
};
