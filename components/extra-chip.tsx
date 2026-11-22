"use client";

import { Plus } from "lucide-react";
import { cn } from "cn";
import { MemberAvatars, type AvatarMember } from "@/components/member-avatar";
import { courseOf, type Course } from "@/lib/recipes";

// Les entrées, desserts, fruits, fromages et laitages d'un repas : de petites puces (pas des
// cartes) qui tiennent dans la colonne étroite de la grille. La couleur de l'icône dit la sorte.
export const COURSE_TINT: Record<Course, string> = {
  main: "text-tomato-deep",
  starter: "text-sage-deep",
  dessert: "text-plum-deep",
  fruit: "text-tomato-deep",
  cheese: "text-mustard-deep",
  dairy: "text-oat-deep",
};

// Dans une colonne étroite, les avatars passent sous le titre plutôt que de le couper.
const FRAME =
  "press inline-flex max-w-full min-h-11 flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-3xl border-2 px-3 py-1 text-[0.9375rem] font-semibold outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring xl:min-h-9 xl:px-2.5 xl:text-[0.875rem]";

const list = (names: string[]) => new Intl.ListFormat("fr", { type: "conjunction" }).format(names);

// Une puce : l'icône de la sorte et le titre (tronqué) ; les avatars seulement quand ce n'est
// pas pour tous les présents (`eaters`), barrés pour qui ne peut pas en manger (`outIds`).
// « Pas mangé » : atténuée, comme une carte « Pas cuisiné ». Toucher la puce ouvre son panneau.
export function ExtraChip({
  course,
  title,
  eaters,
  outIds = [],
  skipped = false,
  onOpen,
  className,
}: {
  course: Course;
  title: string;
  eaters?: AvatarMember[];
  outIds?: readonly string[];
  skipped?: boolean;
  onOpen: () => void;
  className?: string;
}) {
  const { label, icon: Icon } = courseOf(course);
  const name = [
    `${label} : ${title}`,
    eaters ? `pour ${list(eaters.map((eater) => eater.first_name))}` : null,
    skipped ? "pas mangé" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={name}
      title={title}
      className={cn(
        FRAME,
        "border-border bg-card shadow-soft hover:border-input/60",
        skipped && "bg-muted/60 text-muted-foreground shadow-none",
        className,
      )}
    >
      {/* L'icône et le titre restent sur la même ligne : c'est le titre qui se coupe. */}
      <span className="flex min-w-0 max-w-full items-center gap-1.5">
        <Icon aria-hidden="true" className={cn("size-4 shrink-0", skipped ? "text-muted-foreground" : COURSE_TINT[course])} />
        <span className="min-w-0 truncate">{title}</span>
      </span>
      {skipped && <span className="shrink-0 text-[0.8125rem] font-semibold">Pas mangé</span>}
      {eaters && eaters.length > 0 && (
        <MemberAvatars members={eaters} size="xs" max={3} crossedIds={outIds} decorative className="shrink-0" />
      )}
    </button>
  );
}

// « + Dessert, fruit… » : discrète, après les puces d'un repas (même vide : on peut prévoir le
// dessert avant le plat). `label` : lu par les lecteurs d'écran.
export function AddExtraChip({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={label}
      className={cn(
        FRAME,
        "flex-nowrap gap-1 border-dashed border-border bg-card/50 whitespace-nowrap text-muted-foreground hover:border-input/60 hover:text-foreground",
        className,
      )}
    >
      <Plus aria-hidden="true" className="size-4 shrink-0" />
      Dessert, fruit…
    </button>
  );
}
