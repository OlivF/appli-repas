"use client";

import type { ReactNode, Ref } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { EmptySlot } from "@/components/empty-slot";
import { PlannedMealCard, type CardDragState, type PlannedRecipe } from "@/components/planned-meal-card";
import type { AvatarMember } from "@/components/member-avatar";
import type { EaterMember } from "@/components/recipe-card";

// Pièces glissables et cibles du planning, reliées à dnd-kit. Identifiants :
// « card:<id> » (carte, glissable et cible), « slot:<jour>:<repas> » (créneau vide, cible),
// « recipe:<id> » (recette de la Bibliothèque, glissable).

const SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;

export function BoardCard({
  ref,
  id,
  vid,
  delay,
  recipe,
  eaters,
  household,
  locked,
  layout,
  dragState,
  showMeal,
  busy,
  onOpen,
  onToggleLock,
  onAnotherIdea,
}: {
  // AnimatePresence (mode « popLayout ») mesure la carte qui s'en va.
  ref?: Ref<HTMLLIElement>;
  id: string;
  // Identité visuelle : elle suit la recette quand on échange deux cartes, pour l'animation.
  vid: string;
  // Retard d'apparition, pour une cascade après « Proposer ».
  delay: number;
  recipe: PlannedRecipe;
  eaters: EaterMember[];
  household: AvatarMember[];
  locked: boolean;
  layout: "row" | "column";
  dragState?: CardDragState;
  showMeal: boolean;
  busy: boolean;
  onOpen: () => void;
  onToggleLock: () => void;
  onAnotherIdea: () => void;
}) {
  const draggable = useDraggable({ id: `card:${id}`, disabled: locked });
  const droppable = useDroppable({ id: `card:${id}` });

  return (
    <motion.li
      ref={ref}
      layoutId={vid}
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
      transition={{ layout: SPRING, default: { ...SPRING, delay } }}
    >
      <PlannedMealCard
        ref={(node) => {
          draggable.setNodeRef(node);
          droppable.setNodeRef(node);
        }}
        {...draggable.listeners}
        recipe={recipe}
        eaters={eaters}
        household={household}
        locked={locked}
        layout={layout}
        dragState={dragState}
        showMeal={showMeal}
        busy={busy}
        onOpen={onOpen}
        onToggleLock={onToggleLock}
        onAnotherIdea={onAnotherIdea}
        className={locked ? undefined : "cursor-grab"}
      />
    </motion.li>
  );
}

export function DroppableSlot({
  id,
  label,
  compact,
  dropState,
  onClick,
}: {
  id: string;
  label: string;
  compact: boolean;
  dropState?: "target" | "refused";
  onClick: () => void;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <EmptySlot ref={setNodeRef} label={label} compact={compact} dropState={dropState} onClick={onClick} />
    </motion.div>
  );
}

export function DraggableRecipe({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `recipe:${id}` });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={isDragging ? "opacity-40" : "cursor-grab touch-manipulation select-none"}
    >
      {children}
    </div>
  );
}
