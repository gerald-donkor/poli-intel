"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "motion/react";

import type { SignalBoardCard } from "@/lib/db";
import type { Urgency } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

import {
  URGENCY_LABELS,
  URGENCY_ORDER,
  URGENCY_RAMP,
  URGENCY_WINDOWS,
} from "./labels";
import { reclassifySignalUrgencyAction } from "./actions";
import { SignalCard, SignalDragHandle } from "./signal-card";

/**
 * The urgency board.
 *
 * FOUR COLUMNS IN THE RAMP'S OWN ORDER, and they never re-sort. Not by count,
 * not by recency, and — the rule that matters — never underneath someone who is
 * mid-review (§11.10). Nothing on this screen moves a card except a person
 * dragging it.
 *
 * OPTIMISM IS SAFE HERE AND ONLY HERE. The drag is offered exclusively to a
 * caller whose role already permits it, which is `server-actions`' condition for
 * applying an optimistic update at all — never to something the server may
 * refuse on authorisation grounds. A refusal rolls the card back visibly and
 * says why, in place; it is never a silent revert and never a toast.
 *
 * GROUPED BY URGENCY, NOT STATUS. A column move says how soon someone should
 * look. It does not advance a signal, and nothing here can (§8.5).
 *
 * Motion earns its place twice and no more: the lifted card's settle spring and
 * the destination column's 240ms tint crossfade. `useReducedMotion` collapses
 * both to instant — the global CSS rule does not reach JS-driven animation.
 */

/** Droppable ids are namespaced so a column can never collide with a signal id. */
const COLUMN_PREFIX = "urgency:";

function columnId(urgency: Urgency): UniqueIdentifier {
  return `${COLUMN_PREFIX}${urgency}`;
}

export function SignalBoard({
  signals,
  canReclassify,
}: {
  signals: SignalBoardCard[];
  /** Presentation only. The action authorises its own caller regardless (§10.1). */
  canReclassify: boolean;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  // Given no `id`, dnd-kit derives the drag handles' `aria-describedby` from a
  // module-level counter (`useUniqueId` in @dnd-kit/utilities). That counter
  // survives across renders in the long-lived server process but restarts at 0
  // in a freshly loaded browser module, so the two never agree and every
  // hydration reports a mismatch on every handle. `useId` is stable across the
  // boundary and unique per tree position.
  const dndId = useId();

  const [optimisticSignals, applyMove] = useOptimistic(
    signals,
    (state: SignalBoardCard[], move: { id: string; urgency: Urgency }) =>
      state.map((signal) =>
        signal.id === move.id ? { ...signal, urgency: move.urgency } : signal,
      ),
  );

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    // A small distance threshold, so a click on the handle is still a click and
    // a touch scroll over a card is still a scroll.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byUrgency = (urgency: Urgency) =>
    optimisticSignals.filter((signal) => signal.urgency === urgency);

  const activeSignal =
    activeId === null
      ? null
      : (optimisticSignals.find((signal) => signal.id === activeId) ?? null);

  /** Where a drop landed: a column directly, or the card it was dropped onto. */
  const resolveTarget = (over: UniqueIdentifier): Urgency | null => {
    const id = String(over);

    if (id.startsWith(COLUMN_PREFIX)) {
      const stage = id.slice(COLUMN_PREFIX.length);

      return URGENCY_ORDER.find((urgency) => urgency === stage) ?? null;
    }

    return optimisticSignals.find((signal) => signal.id === id)?.urgency ?? null;
  };

  const onDragStart = (event: DragStartEvent) => {
    setRefusal(null);
    setActiveId(event.active.id);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);

    const { active, over } = event;

    if (!over) return;

    const signal = optimisticSignals.find((item) => item.id === active.id);
    const target = resolveTarget(over.id);

    // A drop back into the same column is a move that meant nothing. It writes
    // no audit row — the action returns early — so it sends nothing either.
    if (!signal || target === null || signal.urgency === target) return;

    startTransition(async () => {
      applyMove({ id: signal.id, urgency: target });

      const result = await reclassifySignalUrgencyAction({
        signalId: signal.id,
        urgency: target,
      });

      if (result.ok) return;

      // The optimistic value is discarded when the transition ends, so the card
      // returns to where the server still has it. The reason is stated rather
      // than the card simply springing back.
      setRefusal(
        result.refusal.kind === "unauthorised"
          ? result.refusal.message
          : result.refusal.kind === "invalid"
            ? (result.refusal.fieldErrors.form?.[0] ??
              "That move could not be recorded.")
            : "That move could not be recorded.",
      );
      router.refresh();
    });
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements: ANNOUNCEMENTS }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* The refusal lives above the board and is announced, never toasted. The
          watch ramp, never red — a permission this account does not have is not
          an alarm (§11.4). */}
      <div aria-live="polite" className="empty:hidden">
        {refusal ? (
          <p className="bg-watch-surface border-watch-border text-watch-ink rounded-card mb-4 border px-3.5 py-2.5 text-[13px]">
            {refusal}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
        {URGENCY_ORDER.map((urgency) => (
          <UrgencyColumn
            key={urgency}
            urgency={urgency}
            signals={byUrgency(urgency)}
            canReclassify={canReclassify}
            reduceMotion={reduceMotion ?? false}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
        {activeSignal ? (
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: reduceMotion ? 1 : 1.02 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 380, damping: 30 }
            }
          >
            <SignalCard signal={activeSignal} lifted />
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function UrgencyColumn({
  urgency,
  signals,
  canReclassify,
  reduceMotion,
}: {
  urgency: Urgency;
  signals: SignalBoardCard[];
  canReclassify: boolean;
  reduceMotion: boolean;
}) {
  const ramp = URGENCY_RAMP[urgency];
  const { setNodeRef, isOver } = useDroppable({ id: columnId(urgency) });

  return (
    <section aria-labelledby={`column-${urgency}`} className="flex min-w-0 flex-col">
      {/* At one column the stage header sticks, so a long board never leaves you
          scrolling through cards without knowing which stage you are in. From
          `tablet` the columns are side by side and it is a plain header. */}
      <header className="bg-paper sticky top-0 z-10 flex items-baseline justify-between gap-2 pt-1 pb-2 tablet:static tablet:bg-transparent">
        <h2
          id={`column-${urgency}`}
          className={cn(
            "text-[10.5px] font-semibold tracking-[0.06em] uppercase",
            ramp.eyebrow,
          )}
        >
          {URGENCY_LABELS[urgency]}
          <span className="text-ink-3 ml-2 tracking-normal normal-case">
            {URGENCY_WINDOWS[urgency]}
          </span>
        </h2>
        <span className="text-ink-3 font-mono text-[11.5px] tabular-nums">
          {signals.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          "rounded-card relative flex min-h-[96px] flex-1 flex-col gap-3 border border-dashed p-2",
          ramp.column,
        )}
      >
        {/* The destination tint, crossfaded rather than switched. It sits under
            the cards and never tints a card itself (§11.5). */}
        <motion.div
          aria-hidden="true"
          className={cn(
            "rounded-card pointer-events-none absolute inset-0",
            ramp.over,
          )}
          initial={false}
          animate={{ opacity: isOver ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.24 }}
        />

        <SortableContext
          items={signals.map((signal) => signal.id)}
          strategy={verticalListSortingStrategy}
        >
          {signals.map((signal) => (
            <SortableSignalCard
              key={signal.id}
              signal={signal}
              canReclassify={canReclassify}
            />
          ))}
        </SortableContext>

        {signals.length === 0 ? (
          <p className="text-ink-3 relative px-2 py-4 text-[12.5px]">
            Nothing at this stage.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SortableSignalCard({
  signal,
  canReclassify,
}: {
  signal: SignalBoardCard;
  canReclassify: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: signal.id,
    disabled: !canReclassify,
    // Carried so the live announcement can name the signal rather than its id.
    data: { title: signal.title },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="relative"
    >
      <SignalCard
        signal={signal}
        dragging={isDragging}
        dragHandle={
          canReclassify ? (
            <SignalDragHandle
              title={signal.title}
              attributes={attributes}
              listeners={listeners}
              handleRef={setActivatorNodeRef}
            />
          ) : undefined
        }
      />
    </div>
  );
}

/**
 * What a screen reader hears. dnd-kit's defaults talk in pixels and positions;
 * this board is about urgency stages, so the announcements name them.
 */
const ANNOUNCEMENTS: Announcements = {
  onDragStart: ({ active }) =>
    `Picked up ${describeSignal(active.data.current)}. Use the arrow keys to move it between urgency stages, space to drop it, escape to cancel.`,
  onDragOver: ({ over }) =>
    over ? `Over ${describeTarget(String(over.id))}.` : undefined,
  onDragEnd: ({ over }) =>
    over
      ? `Dropped on ${describeTarget(String(over.id))}. The change is recorded with your name and the time.`
      : "Dropped. Nothing changed.",
  onDragCancel: () => "Move cancelled. The signal stayed where it was.",
};

function describeSignal(data: Record<string, unknown> | undefined): string {
  const title = data?.title;

  return typeof title === "string" ? `signal ${title}` : "this signal";
}

function describeTarget(id: string): string {
  if (!id.startsWith(COLUMN_PREFIX)) return "another signal";

  const stage = URGENCY_ORDER.find(
    (urgency) => urgency === id.slice(COLUMN_PREFIX.length),
  );

  return stage ? `the ${URGENCY_LABELS[stage]} stage` : "another stage";
}
