"use client";

import type { ReactNode, Ref } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { cn } from "cn";
import { EmptySlot } from "@/components/empty-slot";
import { PlannedMealCard, type CardDragState, type PlannedRecipe } from "@/components/planned-meal-card";
import type { AvatarMember } from "@/components/member-avatar";
import type { EaterMember } from "@/components/recipe-card";

// Pièces glissables et cibles du planning, reliées à dnd-kit. Identifiants :
// « card:<id> » (carte, glissable et cible), « slot:<jour>:<repas> » (créneau vide, cible),
// « recipe:<id> » (recette de la Bibliothèque, glissable), « add:<jour>:<repas> » (« + Ajouter
// un plat » sous les plats d'un repas, cible), « extra:<id> » (puce dessert, fruit…, glissable),
// « trash » (la corbeille, cible). Qui va où : canDropOn (lib/board.ts).

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
  skipped = false,
  busy,
  onOpen,
  onEaters,
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
  skipped?: boolean;
  busy: boolean;
  onOpen: () => void;
  onEaters: () => void;
  onToggleLock: () => void;
  onAnotherIdea: () => void;
}) {
  // Verrouillé ou non, un plat se glisse : un plat verrouillé ne va qu'à la corbeille.
  const draggable = useDraggable({ id: `card:${id}` });
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
        skipped={skipped}
        busy={busy}
        onOpen={onOpen}
        onEaters={onEaters}
        onToggleLock={onToggleLock}
        onAnotherIdea={onAnotherIdea}
        className="cursor-grab"
      />
    </motion.li>
  );
}

export function DroppableSlot({
  id,
  label,
  compact,
  dropState,
  variant,
  onClick,
}: {
  id: string;
  label: string;
  compact: boolean;
  dropState?: "target" | "refused";
  variant?: "choose" | "add";
  onClick: () => void;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <EmptySlot
        ref={setNodeRef}
        label={label}
        compact={compact}
        dropState={dropState}
        variant={variant}
        onClick={onClick}
      />
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

// Une puce (entrée, dessert, fruit…) qu'on fait glisser jusqu'à la corbeille, au même appui long
// que les plats ; un simple toucher ouvre toujours son panneau.
export function DraggableExtra({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `extra:${id}` });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={cn("max-w-full", isDragging ? "opacity-40" : "cursor-grab touch-manipulation select-none")}
    >
      {children}
    </div>
  );
}

// La corbeille : là pendant qu'on fait glisser un plat ou une puce, en bas au centre de l'écran,
// au-dessus de la barre d'onglets du téléphone. La cible mesurée par dnd-kit ne bouge pas (pas de
// transformation) : seul son contenu entre par le bas. `demo` : dans le flux (page /design).
export function TrashZone({ over, demo = false }: { over: boolean; demo?: boolean }) {
  const { setNodeRef } = useDroppable({ id: "trash" });
  return (
    <div
      ref={setNodeRef}
      data-testid="trash-zone"
      data-over={over}
      className={cn(
        "w-fit p-3",
        !demo && "fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 mx-auto lg:bottom-6",
      )}
    >
      <motion.div
        initial={demo ? false : { y: "160%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "160%", opacity: 0 }}
        transition={SPRING}
        className="flex flex-col items-center gap-1.5"
      >
        <motion.span
          animate={{ scale: over ? 1.12 : 1 }}
          transition={SPRING}
          className={cn(
            "grid size-18 place-items-center rounded-full border-2 shadow-lift transition-colors",
            over ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
          )}
        >
          <Trash2 aria-hidden="true" className="size-7" />
        </motion.span>
        <span
          className={cn(
            "rounded-full bg-card/95 px-3 py-1 text-[0.875rem] font-semibold whitespace-nowrap shadow-soft",
            over ? "text-tomato-deep" : "text-muted-foreground",
          )}
        >
          {over ? "Lâche pour retirer" : "Retirer du menu"}
        </span>
      </motion.div>
    </div>
  );
}
