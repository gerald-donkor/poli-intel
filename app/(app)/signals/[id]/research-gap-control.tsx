"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { logResearchGapAction } from "@/app/(app)/evidence/gaps/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ResearchGapView } from "@/lib/db";
import { ImpactArea, ResearchGapPriority } from "@/lib/generated/prisma/enums";

import { IMPACT_AREA_LABELS } from "../labels";

export function ResearchGapControl({ signalId, title, impactArea, existingGap, canLog }: { signalId: string; title: string; impactArea: ImpactArea; existingGap: ResearchGapView | null; canLog: boolean }) {
  const [open, setOpen] = useState(false);
  const [logged, setLogged] = useState(existingGap);
  const [topic, setTopic] = useState(title);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ResearchGapPriority>(ResearchGapPriority.medium);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (logged) {
    return <div className="bg-surface-tint border-surface-tint-border rounded-card flex flex-wrap items-center gap-2.5 border p-3 text-[12.5px] transition-all duration-200"><span aria-hidden="true" className="border-primary size-3 shrink-0 border-2" /><span className="text-ink">Research gap recorded: <strong>{logged.topic}</strong></span><Link href={`/evidence/gaps#${logged.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>View in priorities</Link></div>;
  }

  const submit = () => startTransition(async () => {
    setMessage(null);
    const result = await logResearchGapAction({ signalId, impactArea, topic, description, priority });
    if (result.ok) {
      setLogged({ id: result.id, signalId, signalTitle: title, impactArea, topic, description, priority, status: "open", loggedByName: "", createdAt: new Date().toISOString(), resolvedAt: null, resolutionNotes: null, resolvedEvidenceItemId: null, resolvedEvidenceTitle: null });
      setOpen(false);
    } else setMessage(result.refusal.kind === "invalid" ? (result.refusal.fieldErrors.description?.[0] ?? result.refusal.fieldErrors.topic?.[0] ?? result.refusal.fieldErrors.form?.[0] ?? "Could not record the gap.") : result.refusal.kind === "unauthorised" ? result.refusal.message : "Could not record the gap.");
  });

  if (!canLog) return <p className="text-ink-3 text-[12.5px]">A Policy & Advocacy Officer, Research Officer, or Programme Director can record this as a research gap.</p>;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>Log as a research gap</DialogTrigger><DialogContent className="bg-card max-w-lg"><DialogHeader><DialogTitle>Log a research gap</DialogTitle><DialogDescription>Record the missing evidence so Research can prioritise an ingestion response. This does not send any evidence to a model.</DialogDescription></DialogHeader><div className="flex flex-col gap-3"><div><Label htmlFor="gap-topic">Topic</Label><Input id="gap-topic" value={topic} onChange={(event) => setTopic(event.target.value)} /></div><div><Label htmlFor="gap-area">Impact area</Label><p id="gap-area" className="bg-stone border-line mt-1 rounded-md border px-3 py-2 text-[13px]">{IMPACT_AREA_LABELS[impactArea]}</p></div><div><Label htmlFor="gap-description">What evidence is missing?</Label><Textarea id="gap-description" value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-24" /></div><div><Label htmlFor="gap-priority">Priority</Label><select id="gap-priority" value={priority} onChange={(event) => setPriority(event.target.value as ResearchGapPriority)} className="border-line mt-1 h-9 w-full rounded-md border bg-card px-3 text-[13px]">{Object.values(ResearchGapPriority).map((value) => <option key={value} value={value}>{value[0]?.toUpperCase()}{value.slice(1)}</option>)}</select></div>{message ? <p className="text-watch-ink text-[12.5px]">{message}</p> : null}</div><DialogFooter><Button type="button" onClick={submit} disabled={pending || description.trim().length < 10}>{pending ? "Recording…" : "Record research gap"}</Button></DialogFooter></DialogContent></Dialog>;
}
