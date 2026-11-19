"use client";

import type { ComponentProps } from "react";
import { Clock, Lock, LockOpen, Shuffle, TriangleAlert } from "lucide-react";
import { cn } from "cn";
import { MEAL_TINT, mealType } from "@/components/meal-label";
import { MemberAvatars, type AvatarMember } from "@/components/member-avatar";
import type { EaterMember } from "@/components/recipe-card";
import { RecipeCover } from "@/components/recipe-cover";
import type { MealType } from "@/lib/meal-slots";
import { describeEaters, formatDuration } from "@/lib/recipes";

export type PlannedRecipe = { title: string; minutes: number; photo_url: string | null; mealType: MealType };

// Pendant un glisser-déposer : la carte qu'on survole (`target`), une carte où l'on ne peut
// pas lâcher (`refused`, estompée), la place laissée par la carte soulevée (`placeholder`),
// la carte qui suit le doigt (`lifted`).
export type CardDragState = "target" | "refused" | "placeholder" | "lifted";

// Le bouton des avatars : un cadre arrondi, sans fond, qui se voit au survol et au clavier.
const EATERS_BUTTON =
  "press -mx-1 rounded-full px-1 py-0.5 text-left outline-none hover:bg-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring";

const names = (members: { first_name: string }[]) =>
  new Intl.ListFormat("fr", { type: "conjunction" }).format(members.map((member) => member.first_name));

// Carte d'un plat de la semaine : vignette, titre, temps, et qui le mange (barré pour qui il
// ne convient pas). Toucher le plat l'ouvre (pour le changer) ; toucher ses avatars ouvre
// « Qui mange ce plat ? » (`onEaters`) ; cadenas et « Autre idée » à côté. `row` : en ligne,
// pour la journée sur téléphone ; `column` : étroite, pour la grille.
// Les autres props (référence, écouteurs du glisser-déposer) vont sur le cadre.
export function PlannedMealCard({
  recipe,
  eaters,
  household,
  locked,
  layout = "row",
  onOpen,
  onEaters,
  onToggleLock,
  onAnotherIdea,
  busy = false,
  dragState,
  showMeal = false,
  className,
  ...frame
}: {
  recipe: PlannedRecipe;
  // Ceux qui mangent ce plat ; `out` : il ne leur convient pas.
  eaters: EaterMember[];
  // Tout le foyer : « Pour tout le monde », « Sauf Marie-Laure ». Sans lui, on nomme les mangeurs.
  household?: AvatarMember[];
  locked: boolean;
  layout?: "row" | "column";
  onOpen?: () => void;
  // Ouvre « Qui mange ce plat ? ».
  onEaters?: () => void;
  onToggleLock?: () => void;
  onAnotherIdea?: () => void;
  // « Autre idée » cherche.
  busy?: boolean;
  dragState?: CardDragState;
  // Dans la grille : rappelle le repas sur la photo (le pique-nique partage la ligne du midi).
  showMeal?: boolean;
  className?: string;
} & Omit<ComponentProps<"div">, "children">) {
  const out = eaters.filter((eater) => eater.out);
  const eaterIds = eaters.map((eater) => eater.id);
  const who = household
    ? describeEaters(household, household.filter((member) => !eaterIds.includes(member.id)).map((member) => member.id))
    : `Pour ${names(eaters)}`;
  const column = layout === "column";
  const eatersLabel = `Qui mange ce plat ? ${who}`;

  const openClass = (layoutClass: string) =>
    cn(
      "press flex min-w-0 rounded-xl text-left outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
      column && "flex-1",
      layoutClass,
    );
  const cover = (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden",
        MEAL_TINT[recipe.mealType],
        column ? "aspect-[16/10] w-full" : "size-18 rounded-xl",
      )}
    >
      <RecipeCover
        small
        mealType={recipe.mealType}
        image={recipe.photo_url ? { src: recipe.photo_url, alt: "" } : undefined}
        sizes={column ? "10rem" : "4.5rem"}
      />
      {showMeal && column && (
        <span className="absolute bottom-1.5 left-1.5 inline-flex h-6 items-center rounded-full bg-card/95 px-2 text-[0.75rem] font-semibold whitespace-nowrap shadow-soft">
          {mealType(recipe.mealType).label}
        </span>
      )}
    </span>
  );
  const heading = (
    <>
      <span
        className={cn(
          "line-clamp-2 font-heading leading-tight",
          // Dans la grille, toujours la place de deux lignes : les cartes d'une ligne s'alignent.
          column ? "min-h-[2lh] text-[0.9375rem]" : "text-[1.1875rem]",
        )}
      >
        {recipe.title}
      </span>
      <span className="inline-flex items-center gap-1.5 text-[0.875rem] text-muted-foreground">
        <Clock aria-hidden="true" className="size-3.5" />
        {formatDuration(recipe.minutes)}
      </span>
    </>
  );
  const eatersLine = (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <MemberAvatars members={eaters} crossedIds={out.map((eater) => eater.id)} decorative />
      <span className="text-[0.875rem] text-muted-foreground">{who}</span>
    </span>
  );

  const actions = (
    <>
      {onToggleLock && (
        <IconButton
          label={locked ? "Déverrouiller" : "Verrouiller"}
          pressed={locked}
          onClick={onToggleLock}
          className={locked ? "bg-tomato-soft text-tomato-deep hover:bg-tomato-soft" : undefined}
          small={column}
        >
          {locked ? <Lock strokeWidth={2.4} /> : <LockOpen />}
        </IconButton>
      )}
      {onAnotherIdea && !locked && (
        <IconButton label="Autre idée" onClick={onAnotherIdea} disabled={busy} small={column}>
          <Shuffle className={cn(busy && "animate-pulse")} />
        </IconButton>
      )}
    </>
  );

  return (
    <div
      role="group"
      aria-label={recipe.title}
      data-locked={locked || undefined}
      className={cn(
        "relative touch-manipulation rounded-2xl border bg-card shadow-soft transition-[opacity,box-shadow,border-color] duration-200 select-none",
        column ? "flex flex-col overflow-hidden" : "flex items-stretch gap-1 p-2",
        locked ? "border-primary/45" : "border-border/70",
        dragState === "target" && "border-primary ring-4 ring-primary/25",
        dragState === "refused" && "opacity-35",
        dragState === "placeholder" && "border-dashed opacity-40 shadow-none",
        dragState === "lifted" && "rotate-[-1.5deg] cursor-grabbing shadow-lift ring-2 ring-primary/30",
        className,
      )}
      {...frame}
    >
      {column ? (
        <>
          <button type="button" onClick={onOpen} aria-haspopup={onOpen ? "dialog" : undefined} className={openClass("flex-col")}>
            {cover}
            <span className="flex min-w-0 flex-col gap-1 px-2.5 pt-2">
              {heading}
              {out.length > 0 && <Mismatch names={names(out)} />}
            </span>
          </button>
          <div className="mt-auto px-2.5 pt-2 pb-2.5">
            {onEaters ? (
              <button type="button" onClick={onEaters} aria-haspopup="dialog" aria-label={eatersLabel} className={EATERS_BUTTON}>
                <MemberAvatars members={eaters} crossedIds={out.map((eater) => eater.id)} max={4} decorative />
              </button>
            ) : (
              <MemberAvatars members={eaters} crossedIds={out.map((eater) => eater.id)} max={4} />
            )}
          </div>
          <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">{actions}</div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* La vignette ouvre aussi le plat, au doigt ; au clavier, c'est le titre. */}
            <span aria-hidden="true" onClick={onOpen} className={cn("cursor-pointer", !onOpen && "cursor-default")}>
              {cover}
            </span>
            <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <button type="button" onClick={onOpen} aria-haspopup={onOpen ? "dialog" : undefined} className={openClass("flex-col gap-1")}>
                {heading}
              </button>
              {onEaters ? (
                <button type="button" onClick={onEaters} aria-haspopup="dialog" aria-label={eatersLabel} className={EATERS_BUTTON}>
                  {eatersLine}
                </button>
              ) : (
                eatersLine
              )}
              {out.length > 0 && <Mismatch names={names(out)} />}
            </span>
          </div>
          <div className="flex shrink-0 flex-col justify-center gap-1">{actions}</div>
        </>
      )}
    </div>
  );
}

// « Ne convient pas à Léa » : un plat que son régime, ou une exclusion, écarte.
export function Mismatch({ names }: { names: string }) {
  return (
    <span className="inline-flex items-start gap-1.5 text-[0.8125rem] leading-snug font-semibold text-destructive sm:text-[0.875rem]">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      Ne convient pas à {names}
    </span>
  );
}

function IconButton({
  label,
  pressed,
  small,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "aria-label" | "aria-pressed"> & {
  label: string;
  pressed?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      // Le glisser-déposer démarre sur le cadre de la carte : pas depuis ces boutons.
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      className={cn(
        "press grid shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-55 [&_svg]:size-5",
        small ? "size-9 [&_svg]:size-4.5" : "size-11",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
