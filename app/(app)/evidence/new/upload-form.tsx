"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import {
  ACCEPTED_MIME_TYPES,
  MAX_PDF_SIZE,
  MAX_TEXT_SIZE,
} from "@/lib/ingestion/limits";
import { useUploadThing } from "@/lib/uploadthing/client";
import { cn } from "@/lib/utils";

import {
  EVIDENCE_SOURCE_TYPE_OPTIONS,
  IMPACT_AREA_OPTIONS,
} from "../labels";
import {
  createEvidenceRecordAction,
  discardEvidenceRecordAction,
} from "./actions";
import { evidenceMetadataSchema, type EvidenceMetadataInput } from "./schema";

/**
 * Evidence upload: metadata, then the document.
 *
 * The record is created first so a citation-key collision surfaces on this form
 * rather than after a completed upload. The file then fills that record in, and
 * every failure path deletes it again — a half-ingested item never survives.
 *
 * Progress is three NAMED stages, never an indeterminate spinner
 * (design-system.md, generation sequence). Stage 1 is a real byte percentage.
 * Stages 2 and 3 both run inside Uploadthing's server callback and resolve
 * together when it returns; each reports a real number when it completes
 * (characters extracted, chunks written) rather than a guessed intermediate.
 */

type Stage = "uploading" | "extracting" | "chunking";

const STAGES: { id: Stage; label: string }[] = [
  { id: "uploading", label: "Uploading" },
  { id: "extracting", label: "Extracting text" },
  { id: "chunking", label: "Chunking" },
];

type Run =
  | { phase: "idle" }
  | { phase: "uploading"; percent: number }
  | { phase: "extracting" }
  | { phase: "done"; extractedChars: number; chunkCount: number }
  | { phase: "failed"; message: string };

export function EvidenceUploadForm() {
  const [run, setRun] = useState<Run>({ phase: "idle" });
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const evidenceItemIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<EvidenceMetadataInput>({
    resolver: zodResolver(evidenceMetadataSchema),
    // `sourceType` is deliberately absent: it has no safe default, so the
    // select opens on an empty option and the schema rejects it until chosen.
    defaultValues: {
      title: "",
      authors: "",
      year: "",
      country: "",
      impactArea: "",
      citationKey: "",
      sourceUrl: "",
      sourceFileName: "",
    },
  });

  const { startUpload } = useUploadThing("evidenceDocument", {
    onUploadProgress: (percent) => {
      setRun(
        percent >= 100 ? { phase: "extracting" } : { phase: "uploading", percent },
      );
    },
    onClientUploadComplete: async (res) => {
      const outcome = res[0]?.serverData;

      if (!outcome) {
        setRun({
          phase: "failed",
          message:
            "The upload finished but no ingestion result came back. Try again.",
        });
        return;
      }

      if (outcome.ok) {
        setRun({
          phase: "done",
          extractedChars: outcome.extractedChars,
          chunkCount: outcome.chunkCount,
        });
        return;
      }

      // The server has already recorded the failure and removed the record.
      setRun({ phase: "failed", message: outcome.message });
    },
    onUploadError: async (error) => {
      const evidenceItemId = evidenceItemIdRef.current;
      if (evidenceItemId) await discardEvidenceRecordAction(evidenceItemId);

      setRun({ phase: "failed", message: error.message });
    },
  });

  const busy = run.phase === "uploading" || run.phase === "extracting";

  // `handleSubmit` is called inside the event handler, never during render, so
  // the ref write below happens in an event and not in render scope.
  const submit = async (values: EvidenceMetadataInput) => {
    if (!file) {
      form.setError("sourceFileName", {
        message: "Choose a PDF or plain-text document to upload.",
      });
      return;
    }

    setRun({ phase: "uploading", percent: 0 });

    const created = await createEvidenceRecordAction(values);

    if (!created.ok) {
      const refusal = created.refusal;

      if (refusal.kind === "unauthorised") {
        setRun({ phase: "failed", message: refusal.message });
        return;
      }

      // Field-mapped messages belong on the field. Anything that maps to no
      // field is surfaced as a panel rather than silently dropped.
      let unmapped: string | null = null;

      for (const [fieldName, messages] of Object.entries(refusal.fieldErrors)) {
        const message = messages[0];
        if (!message) continue;

        if (fieldName in values) {
          form.setError(fieldName as keyof EvidenceMetadataInput, { message });
        } else {
          unmapped ??= message;
        }
      }

      setRun(
        unmapped ? { phase: "failed", message: unmapped } : { phase: "idle" },
      );
      return;
    }

    evidenceItemIdRef.current = created.evidenceItemId;

    await startUpload([file], { evidenceItemId: created.evidenceItemId });
  };

  const chooseFile = (chosen: File | null) => {
    setFile(chosen);
    form.setValue("sourceFileName", chosen?.name ?? "", {
      shouldValidate: form.formState.isSubmitted,
    });
    if (chosen) form.clearErrors("sourceFileName");
  };

  if (run.phase === "done") {
    return <IngestedPanel run={run} />;
  }

  return (
    <form
      onSubmit={(event) => {
        void form.handleSubmit(submit)(event);
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      <div className="bg-card border-line rounded-card border p-4 tablet:p-6">
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input id="title" disabled={busy} {...form.register("title")} />
            <FieldError errors={[form.formState.errors.title]} />
          </Field>

          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="authors">Authors</FieldLabel>
              <Input
                id="authors"
                disabled={busy}
                placeholder="Separate names with commas"
                {...form.register("authors")}
              />
              <FieldError errors={[form.formState.errors.authors]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="year">Year</FieldLabel>
              <Input
                id="year"
                inputMode="numeric"
                disabled={busy}
                placeholder="2025"
                {...form.register("year")}
              />
              <FieldError errors={[form.formState.errors.year]} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="sourceType">Source type</FieldLabel>
              <NativeSelect
                className="w-full"
                id="sourceType"
                disabled={busy}
                {...form.register("sourceType")}
              >
                <NativeSelectOption value="">Choose one</NativeSelectOption>
                {EVIDENCE_SOURCE_TYPE_OPTIONS.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError errors={[form.formState.errors.sourceType]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="impactArea">Impact area</FieldLabel>
              <NativeSelect
                className="w-full"
                id="impactArea"
                disabled={busy}
                {...form.register("impactArea")}
              >
                <NativeSelectOption value="">Not recorded</NativeSelectOption>
                {IMPACT_AREA_OPTIONS.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError errors={[form.formState.errors.impactArea]} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="country">Country</FieldLabel>
              <Input
                id="country"
                disabled={busy}
                placeholder="Ghana"
                {...form.register("country")}
              />
              <FieldError errors={[form.formState.errors.country]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="citationKey">Citation key</FieldLabel>
              <Input
                id="citationKey"
                disabled={busy}
                placeholder="tbi-juabeso-tenure-2025"
                className="font-mono text-[13px]"
                {...form.register("citationKey")}
              />
              <FieldDescription>
                Unique across the evidence library. Citations in briefs point at
                this key.
              </FieldDescription>
              <FieldError errors={[form.formState.errors.citationKey]} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="sourceUrl">Source URL</FieldLabel>
            <Input
              id="sourceUrl"
              disabled={busy}
              placeholder="https://…"
              {...form.register("sourceUrl")}
            />
            <FieldError errors={[form.formState.errors.sourceUrl]} />
          </Field>
        </FieldGroup>
      </div>

      <div className="bg-card border-line rounded-card border p-4 tablet:p-6">
        <Field>
          <FieldLabel htmlFor="document">Document</FieldLabel>
          <FieldDescription>
            PDF up to {MAX_PDF_SIZE} or plain text up to {MAX_TEXT_SIZE}. The
            text is extracted and chunked; the uploaded file itself is deleted
            once that succeeds.
          </FieldDescription>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (busy) return;
              chooseFile(event.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "rounded-card mt-2 flex flex-col items-start gap-3 border border-dashed p-4 transition-colors duration-150",
              dragging
                ? "border-accent bg-surface-tint"
                : "border-line bg-paper",
            )}
          >
            <input
              ref={fileInputRef}
              id="document"
              type="file"
              accept={ACCEPTED_MIME_TYPES.join(",")}
              disabled={busy}
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose a document
              </Button>
              <span className="text-ink-3 text-[13px]">
                {file ? file.name : "or drag one here"}
              </span>
            </div>
            {file ? (
              <span className="text-ink-3 font-mono text-[11.5px]">
                {(file.size / 1024).toFixed(0)} KB · {file.type || "unknown type"}
              </span>
            ) : null}
          </div>

          <FieldError errors={[form.formState.errors.sourceFileName]} />
        </Field>
      </div>

      {run.phase === "failed" ? (
        <Alert variant="guard" className="rounded-card">
          <AlertTitle className="text-[13px] font-semibold">
            Ingestion did not complete
          </AlertTitle>
          <AlertDescription className="text-watch-ink/90 text-[13px]">
            <p>{run.message}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {busy ? <IngestionStepper run={run} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy} className="h-11 tablet:h-8">
          {busy ? "Working…" : "Ingest document"}
        </Button>
        {/* An <a> cannot be `disabled` — the attribute is dropped, so a plain
            `disabled` prop here would leave the link live mid-upload and
            navigating away would strand the record the discard action cleans
            up. `aria-disabled` plus removing it from the tab order and the
            pointer is the accessible equivalent. */}
        <Link
          href="/evidence"
          aria-disabled={busy || undefined}
          tabIndex={busy ? -1 : undefined}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            busy && "pointer-events-none opacity-50",
          )}
        >
          Cancel
        </Link>
      </div>

      <p className="text-ink-3 max-w-[70ch] text-[12.5px]">
        Every ingested item is held as unpublished and internal until a Research
        Officer classifies it. Nothing here is searchable, and nothing reaches
        the AI pipeline, before that.
      </p>
    </form>
  );
}

function IngestionStepper({ run }: { run: Extract<Run, { phase: "uploading" | "extracting" }> }) {
  const activeIndex = run.phase === "uploading" ? 0 : 1;

  return (
    <div
      className="bg-card border-line rounded-card flex flex-col gap-3 border p-4"
      aria-live="polite"
    >
      {STAGES.map((stage, index) => {
        const complete = index < activeIndex;
        // Stages 2 and 3 share one server callback, so both read as active
        // once the bytes are up rather than faking an intermediate transition.
        const active = run.phase === "uploading" ? index === 0 : index >= 1;

        return (
          <div key={stage.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 shrink-0 rounded-[1px] border-2",
                  complete
                    ? "border-primary bg-primary"
                    : active
                      ? "border-primary"
                      : "border-sage",
                )}
              />
              <span
                className={cn(
                  "text-[13px]",
                  complete
                    ? "text-ink-2"
                    : active
                      ? "text-ink animate-breathe font-medium"
                      : "text-ink-disabled",
                )}
              >
                {stage.label}
              </span>
            </div>
            {stage.id === "uploading" && run.phase === "uploading" ? (
              <Progress value={run.percent} className="w-full" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function IngestedPanel({
  run,
}: {
  run: Extract<Run, { phase: "done" }>;
}) {
  return (
    <div className="bg-card border-line rounded-card flex flex-col items-start gap-3 border p-6">
      <h2 className="text-ink text-[15px] font-semibold">
        Document ingested and held for classification
      </h2>
      <p className="text-ink-3 max-w-[62ch] text-[13px]">
        <span className="text-ink font-mono">
          {run.extractedChars.toLocaleString()}
        </span>{" "}
        characters were extracted into{" "}
        <span className="text-ink font-mono">{run.chunkCount}</span> chunks. The
        item is unpublished and internal until a Research Officer classifies it,
        so it is not searchable and not eligible for the AI pipeline yet.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/evidence/queue" className={buttonVariants()}>
          Open the classification queue
        </Link>
        <Link
          href="/evidence/new"
          className={buttonVariants({ variant: "outline" })}
        >
          Ingest another document
        </Link>
      </div>
    </div>
  );
}
