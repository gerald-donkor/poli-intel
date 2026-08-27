"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  briefDocumentSchema,
  documentOutline,
  stripGuardFlagMarks,
  type BriefDocument,
  type DocumentOutlineEntry,
} from "@/lib/briefs/document";
import { CitationChip } from "@/lib/briefs/extensions/citation-chip";
import { GuardFlag } from "@/lib/briefs/extensions/guard-flag";
import type { BriefForEdit } from "@/lib/db/briefs";
import { Classification } from "@/lib/generated/prisma/enums";

import { CitationList } from "../citation-list";
import { FlagPanel } from "../flag-panel";
import { saveBriefDraft } from "./actions";
import { CiteControl } from "./cite-control";
import { EvidenceSheet } from "./evidence-sheet";
import { SectionsNav } from "./sections-nav";
import { SaveStateIndicator, type SaveState } from "./save-state";

/**
 * The brief editor.
 *
 * SSR: Tiptap touches the DOM, so the editor does not render during SSR —
 * `immediatelyRender: false` is the package's own option for exactly this, and
 * it is why the first client render cannot mismatch a server-rendered document.
 * The route fetches and builds the document server-side (§5.3); this component
 * receives it as props and never fetches.
 *
 * AUTOSAVE writes a NEW VERSION on every debounce window (§8.7). The debounce is
 * therefore also the version-history density decision: 1200ms of inactivity
 * keeps an ordinary editing session to a readable number of versions rather than
 * one per pause. A save whose document is byte-identical to the last saved one
 * is skipped entirely.
 *
 * WHAT IS NOT HERE, deliberately: no status control, no approve button, no flag
 * dismissal. A disabled control with nothing behind it implies the capability
 * exists and is switched off (§8.2, §8.3); the panel says in words what is
 * coming instead.
 */

const AUTOSAVE_DEBOUNCE_MS = 1200;

export function BriefEditor({
  briefId,
  version,
  initialDocument,
  evidence,
  flags,
}: {
  briefId: string;
  version: number;
  initialDocument: BriefDocument;
  evidence: BriefForEdit["evidence"];
  flags: BriefForEdit["flags"];
}) {
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [outline, setOutline] = useState<DocumentOutlineEntry[]>(() =>
    documentOutline(initialDocument),
  );
  const [openEvidence, setOpenEvidence] = useState<
    BriefForEdit["evidence"][number] | null
  >(null);
  const [activeFlagId, setActiveFlagId] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  /** The version this editor is writing from. It advances with each save. */
  const versionRef = useRef(version);
  const lastSavedRef = useRef(serialise(initialDocument));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const documentRef = useRef<HTMLDivElement | null>(null);

  const chipItems = useMemo(
    () =>
      evidence.map((item) => ({
        id: item.id,
        citationKey: item.citationKey,
        verified: item.classification === Classification.public_published,
      })),
    [evidence],
  );

  const evidenceById = useMemo(
    () => new Map(evidence.map((item) => [item.id, item])),
    [evidence],
  );

  const save = useCallback(
    async (document: BriefDocument) => {
      const serialised = serialise(document);

      // Nothing changed since the last write — no version, no round-trip.
      if (serialised === lastSavedRef.current) {
        dirtyRef.current = false;
        return;
      }

      setSaveState({ kind: "saving" });

      const result = await saveBriefDraft({
        briefId,
        fromVersion: versionRef.current,
        document,
      });

      if (!result.ok) {
        // The buffer is untouched. Whatever was typed is still on screen, and
        // stays there until the officer decides otherwise.
        setSaveState({ kind: "failed", refusal: result.refusal });
        return;
      }

      versionRef.current = result.version;
      lastSavedRef.current = serialised;
      dirtyRef.current = false;
      setSaveState({ kind: "saved", at: result.savedAt });
    },
    [briefId],
  );

  const editor = useEditor({
    // Server-side rendering: the editor's DOM is built on the client only.
    immediatelyRender: false,
    extensions: [
      // The vocabulary is fixed by the document model: headings, paragraphs,
      // and the two custom extensions. Formatting marks and block types the
      // brief structure has no place for are not registered, so they cannot
      // enter a document that export, diffing and validation must all handle.
      StarterKit.configure({
        blockquote: false,
        bold: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        italic: false,
        listItem: false,
        orderedList: false,
        strike: false,
        link: false,
        underline: false,
        heading: { levels: [1, 2, 3] },
      }),
      CitationChip.configure({ items: chipItems }),
      GuardFlag,
    ],
    content: initialDocument,
    editorProps: {
      attributes: {
        class:
          "outline-none min-h-[60vh] max-w-[70ch] text-ink-2 text-[14.5px] leading-[1.7] flex flex-col gap-3",
        "aria-label": "Brief document",
      },
    },
    onUpdate: ({ editor: instance }) => {
      const parsed = briefDocumentSchema.safeParse(instance.getJSON());

      if (!parsed.success) {
        setSaveState({
          kind: "failed",
          refusal: {
            kind: "invalid",
            fieldErrors: {
              document: [
                "This draft is in a structure the editor cannot save. Your text is still on screen — undo the last change, or reload the page.",
              ],
            },
          },
        });
        return;
      }

      const document = parsed.data;

      setOutline(documentOutline(document));
      dirtyRef.current = true;

      if (timerRef.current !== null) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        void save(document);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
  });

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  // A close with an unsaved buffer is the one case the debounce cannot cover.
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
    }

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // Sync active flag selection to inline document marks
  useEffect(() => {
    if (!documentRef.current) return;
    const elements =
      documentRef.current.querySelectorAll<HTMLElement>("[data-guard-flag]");
    elements.forEach((el) => {
      const id = el.getAttribute("data-guard-flag");
      if (id === activeFlagId) {
        el.setAttribute("data-active-flag", "true");
      } else {
        el.removeAttribute("data-active-flag");
      }
    });
  }, [activeFlagId]);

  const retry = useCallback(() => {
    if (editor === null) return;

    const parsed = briefDocumentSchema.safeParse(editor.getJSON());

    if (parsed.success) void save(parsed.data);
  }, [editor, save]);

  /** A chip or a flagged span in the document, clicked or keyed. */
  const handleDocumentActivate = useCallback(
    (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;

      const chip = target.closest("[data-citation-chip]");

      if (chip !== null) {
        const id = chip.getAttribute("data-evidence-item-id");
        setOpenEvidence(id === null ? null : (evidenceById.get(id) ?? null));
        return true;
      }

      const flagged = target.closest("[data-guard-flag]");

      if (flagged !== null) {
        const id = flagged.getAttribute("data-guard-flag");

        if (id !== null) {
          setActiveFlagId(id);
          window.document
            .getElementById(`flag-${id}`)
            ?.scrollIntoView({ block: "nearest" });
        }
        return true;
      }

      return false;
    },
    [evidenceById],
  );

  /** The other direction: the panel pointing back into the document. */
  const revealFlagInDocument = useCallback((flagId: string) => {
    setActiveFlagId(flagId);
    documentRef.current
      ?.querySelector(`[data-guard-flag="${CSS.escape(flagId)}"]`)
      ?.scrollIntoView({ block: "center" });
  }, []);

  const insertChip = useCallback(
    (item: BriefForEdit["evidence"][number]) => {
      editor
        ?.chain()
        .focus()
        .insertContentAt(editor.state.selection.to, {
          type: "citationChip",
          attrs: { evidenceItemId: item.id, citationKey: item.citationKey },
        })
        .run();
    },
    [editor],
  );

  const scrollToSection = useCallback(
    (entry: DocumentOutlineEntry) => {
      setNavOpen(false);

      const headings = documentRef.current?.querySelectorAll(
        ".ProseMirror > h1, .ProseMirror > h2, .ProseMirror > h3",
      );

      // The outline's index counts every block; the heading list counts only
      // headings, so the nth outline entry is the nth heading element.
      const position = outline.findIndex((candidate) => candidate === entry);

      headings?.[position]?.scrollIntoView({ block: "start" });
    },
    [outline],
  );

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-1 flex-col gap-4 p-4 tablet:p-6">
      <div className="grid min-w-0 grid-cols-1 gap-4 laptop:grid-cols-[minmax(0,1fr)_minmax(0,340px)] laptop:items-start desktop:grid-cols-[236px_minmax(0,1fr)_minmax(0,372px)]">
        {/* Third column at desktop; a drawer below it — reflowed, never dropped. */}
        <aside className="bg-card border-line rounded-card hidden border p-4 desktop:order-1 desktop:block">
          <SectionsNav outline={outline} onSelect={scrollToSection} />
        </aside>

        {/* The governance surfaces. At one column they come FIRST — a flag panel
            is never what gets pushed below the fold (design-system.md,
            responsive rules; §9.7). */}
        <div className="order-1 flex min-w-0 flex-col gap-4 laptop:order-3">
          <FlagPanel
            flags={flags}
            evidence={evidence}
            onSelectFlag={revealFlagInDocument}
            activeFlagId={activeFlagId}
          />
          <CitationList evidence={evidence} />
        </div>

        <div className="order-2 flex min-w-0 flex-col gap-4 laptop:order-2">
          <div className="bg-card border-line rounded-card flex min-h-[58px] flex-wrap items-center gap-3 border p-3">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] cursor-pointer desktop:hidden tablet:min-h-0 tablet:h-8"
                  >
                    Sections
                  </Button>
                }
              />
              <SheetContent side="left" className="w-[min(18rem,90vw)]">
                <SheetHeader>
                  <SheetTitle>Sections</SheetTitle>
                  <SheetDescription className="sr-only">
                    Jump to a section of this brief.
                  </SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-4">
                  <SectionsNav outline={outline} onSelect={scrollToSection} />
                </div>
              </SheetContent>
            </Sheet>

            <CiteControl
              evidence={evidence}
              onInsert={insertChip}
              disabled={editor === null}
            />

            <div className="ml-auto min-w-0">
              <SaveStateIndicator state={saveState} onRetry={retry} />
            </div>
          </div>

          <article
            ref={documentRef}
            onClick={(event) => {
              if (handleDocumentActivate(event.target)) event.preventDefault();
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              if (handleDocumentActivate(event.target)) event.preventDefault();
            }}
            className="bg-card border-line rounded-card min-w-0 border p-4 tablet:p-6 desktop:p-8 [&_.ProseMirror_h1]:text-h1 [&_.ProseMirror_h1]:text-ink [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h2]:text-meta [&_.ProseMirror_h2]:text-ink-3 [&_.ProseMirror_h2]:border-line [&_.ProseMirror_h2]:border-b [&_.ProseMirror_h2]:pb-1 [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:tracking-[0.06em] [&_.ProseMirror_h2]:uppercase [&_.ProseMirror_h3]:text-h3 [&_.ProseMirror_h3]:text-ink [&_.ProseMirror_h3]:font-semibold"
          >
            {/* The document is the product's own voice, so it is the SANS.
                Quoted material — the citation list, a flagged claim, the
                evidence Sheet — is the serif, and that distinction is the only
                way a reader can tell what a model wrote from what a source said
                (§11.6). */}
            <EditorContent editor={editor} />
          </article>

          <p className="text-ink-3 max-w-[70ch] text-[12.5px]">
            Every pause writes a new version; no earlier version is overwritten.
            Flags carry forward with your edits. Clearing a flag, approval,
            audience switching and export arrive with the review and export
            screens — nothing here has been approved, submitted, or published.
          </p>
        </div>
      </div>

      <EvidenceSheet item={openEvidence} onClose={() => setOpenEvidence(null)} />
    </div>
  );
}

/**
 * What the "has anything actually changed?" comparison runs on.
 *
 * Guard-flag marks are stripped first: they are painted on from the flag rows
 * and are not part of what gets stored, so a document whose only difference is
 * where a mark sits is not a change worth a new version.
 */
function serialise(document: BriefDocument): string {
  return JSON.stringify(stripGuardFlagMarks(document));
}
