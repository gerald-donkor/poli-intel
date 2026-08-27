import { Node, mergeAttributes } from "@tiptap/core";

import { CITATION_CHIP_NODE } from "../document";

/**
 * The citation chip — an inline, atomic Tiptap Node, not a shadcn component
 * (design-system.md's mapping table).
 *
 * IT CARRIES AN IDENTIFIER, NOT JUST DISPLAY TEXT. A chip resolves to a real
 * `evidence_item` in the brief's recorded set; a chip that resolves to nothing
 * is decoration, and this product's whole claim is traceability (§15.5). An
 * unresolvable chip therefore DEGRADES TO PLAIN TEXT rather than rendering as a
 * pill that a reader would take at face value.
 *
 * The resolvable set is passed in as an option and comes from the brief's own
 * evidence set — the set that already passed the classification gate at
 * generation. There is no other source, so the editor cannot introduce an
 * ungated item into a brief.
 *
 * Visual contract, verbatim from the handoff: pill on `surface-tint` with
 * `surface-tint-border`; FILLED DOT = the item resolves and is public-published;
 * HOLLOW DOT = pending. Clicking opens the evidence in a `Sheet` — never a route
 * change — which the editor handles by delegation on `data-citation-chip`.
 */

export type CitationChipItem = {
  id: string;
  citationKey: string;
  /** Resolvable AND public-published: the filled dot's meaning. */
  verified: boolean;
};

export type CitationChipOptions = {
  items: CitationChipItem[];
};

const CHIP_CLASS =
  "inline-flex items-center gap-1.5 rounded-full bg-surface-tint border border-surface-tint-border px-2 py-0.5 text-[11px] font-semibold text-primary-ink align-baseline cursor-pointer transition-colors duration-150 hover:bg-surface-tint/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 select-none";

const DOT_VERIFIED = "inline-block size-1.5 rounded-full bg-primary";
const DOT_PENDING =
  "inline-block size-1.5 rounded-full border border-primary-ink";

export const CitationChip = Node.create<CitationChipOptions>({
  name: CITATION_CHIP_NODE,

  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { items: [] };
  },

  addAttributes() {
    return {
      evidenceItemId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-evidence-item-id"),
        renderHTML: (attributes) => ({
          "data-evidence-item-id": attributes.evidenceItemId as string,
        }),
      },
      citationKey: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-citation-key") ?? "",
        renderHTML: (attributes) => ({
          "data-citation-key": attributes.citationKey as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[data-citation-chip]` }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const evidenceItemId = node.attrs.evidenceItemId as string | null;
    const citationKey = (node.attrs.citationKey as string) || "";

    const item = this.options.items.find(
      (candidate) => candidate.id === evidenceItemId,
    );

    // Unresolvable: plain text, no pill, no dot, nothing to click.
    if (item === undefined) {
      return [
        "span",
        mergeAttributes(HTMLAttributes, {
          class: "text-ink-3 text-[11px]",
        }),
        citationKey,
      ];
    }

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-citation-chip": "",
        class: CHIP_CLASS,
        contenteditable: "false",
        tabindex: "0",
        role: "button",
        "aria-label": `Evidence ${item.citationKey}. Open its record.`,
      }),
      [
        "span",
        {
          "aria-hidden": "true",
          class: item.verified ? DOT_VERIFIED : DOT_PENDING,
        },
      ],
      item.citationKey,
    ];
  },
});
