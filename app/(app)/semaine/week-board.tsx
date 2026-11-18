"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { BookOpen, Sparkles, X } from "lucide-react";
import { cn } from "cn";
import { DayStrip } from "@/components/day-strip";
import { FieldError } from "@/components/field";
import { MealLabel } from "@/components/meal-label";
import { PageHeader } from "@/components/page-header";
import { PlannedMealCard, type CardDragState } from "@/components/planned-meal-card";
import type { EaterMember } from "@/components/recipe-card";
import { LibraryItem, RecipeLibrary } from "@/components/recipe-library";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/components/use-media-query";
import { WeekPicker } from "@/components/week-picker";
import { buildBoard, type BoardSlot } from "@/lib/board";
import type { MealType, SlotInput } from "@/lib/meal-slots";
import { canEat } from "@/lib/planner";
import type { RecipeMember } from "@/lib/recipes-data";
import { describeEaters } from "@/lib/recipes";
import type { WeekCard, WeekRecipe } from "@/lib/week-data";
import {
  anotherIdeaAction,
  placeRecipeAction,
  proposeWeekAction,
  swapCardsAction,
  toggleLockAction,
  type PlaceTarget,
} from "./actions";
import { BoardCard, DraggableRecipe, DroppableSlot } from "./board-pieces";

type Card = WeekCard & { vid: string };
type Day = { short: string; long: string; date: string };
type Drag = { kind: "card"; card: Card } | { kind: "recipe"; recipe: WeekRecipe };
type SheetTarget =
  | { kind: "card"; cardId: string }
  | { kind: "slot"; day: number; meal_type: MealType; member_ids: string[] };

// « le dîner de mardi », « le pique-nique de mercredi ».
const MEAL_NOUN: Record<MealType, string> = {
  petit_dej: "le petit-déj",
  midi: "le midi",
  pique_nique: "le pique-nique",
  soir: "le dîner",
};

// Défilement qui amène la colonne d'un jour au bord gauche (marge comprise).
function dayOffset(scroller: HTMLElement | null, day: number) {
  const section = scroller?.querySelector<HTMLElement>(`[data-day="${day}"]`);
  if (!scroller || !section) return null;
  return section.offsetLeft - parseFloat(getComputedStyle(scroller).paddingLeft);
}

// Zone, au bord de l'écran, où un plat glissé fait venir le jour voisin (px).
const EDGE = 44;

const SAVE_ERROR = "L'enregistrement n'a pas abouti. Vérifie ta connexion, puis réessaie.";

export function WeekBoard({
  weekStart,
  label,
  relation,
  prevHref,
  nextHref,
  days,
  firstDay,
  members,
  slots,
  recipes,
  initialCards,
}: {
  weekStart: string;
  label: string;
  relation: "current" | "next" | null;
  prevHref: string;
  nextHref: string;
  days: Day[];
  // Jour affiché d'abord sur téléphone.
  firstDay: number;
  members: RecipeMember[];
  slots: SlotInput[];
  recipes: WeekRecipe[];
  initialCards: WeekCard[];
}) {
  const [cards, setCards] = useState<Card[]>(() => initialCards.map((card) => ({ ...card, vid: card.id })));
  const [delays, setDelays] = useState<Record<string, number>>({});
  const [tried, setTried] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(firstDay);
  const activeDayRef = useRef(firstDay);
  const edge = useRef<{ direction: number; timer: number } | null>(null);
  const [proposing, startProposing] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery("(min-width: 1280px)");

  const board = useMemo(() => buildBoard(slots, cards), [slots, cards]);
  const recipeById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Appui long au doigt : un simple balayage fait défiler les jours.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  // Les messages d'information s'effacent d'eux-mêmes.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Sur téléphone, on arrive sur le bon jour.
  useEffect(() => {
    const left = dayOffset(scroller.current, firstDay);
    if (left !== null && scroller.current) scroller.current.scrollLeft = left;
  }, [firstDay]);

  // Dans l'ordre du foyer, comme partout ailleurs.
  const eatersOf = (memberIds: string[], recipe?: WeekRecipe): EaterMember[] =>
    members
      .filter((member) => memberIds.includes(member.id))
      .map((member) => ({ ...member, out: recipe ? !canEat(recipe, member) : false }));

  // ─── Enregistrer, en remettant l'écran d'aplomb si ça échoue ──────────────
  async function save(change: (current: Card[]) => Card[], action: () => Promise<{ error: string } | object>) {
    const before = cards;
    setCards(change);
    setError(null);
    const result = await action().catch(() => ({ error: SAVE_ERROR }));
    if ("error" in result) {
      setCards(before);
      setError(result.error as string);
    }
  }

  function propose() {
    startProposing(async () => {
      setError(null);
      const result = await proposeWeekAction(weekStart).catch(() => ({ error: SAVE_ERROR }));
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const fresh = result.cards.filter((card) => !card.locked);
      setDelays(Object.fromEntries(fresh.map((card, index) => [card.id, Math.min(index * 0.03, 0.6)])));
      setCards((current) =>
        result.cards.map((card) => ({ ...card, vid: current.find((item) => item.id === card.id)?.vid ?? card.id })),
      );
      setTried({});
    });
  }

  function toggleLock(card: Card) {
    void save(
      (current) => current.map((item) => (item.id === card.id ? { ...item, locked: !card.locked } : item)),
      () => toggleLockAction(weekStart, card.id, !card.locked),
    );
  }

  function swap(first: Card, second: Card) {
    void save(
      (current) =>
        current.map((item) =>
          item.id === first.id
            ? { ...item, recipe_id: second.recipe_id, vid: second.vid }
            : item.id === second.id
              ? { ...item, recipe_id: first.recipe_id, vid: first.vid }
              : item,
        ),
      () => swapCardsAction(weekStart, first.id, second.id),
    );
  }

  async function place(target: SheetTarget, recipe: WeekRecipe) {
    setError(null);
    setDelays({});
    if (target.kind === "card") {
      await save(
        (current) =>
          current.map((item) =>
            item.id === target.cardId
              ? { ...item, recipe_id: recipe.id, locked: true, vid: `${item.id}:${recipe.id}` }
              : item,
          ),
        () => placeRecipeAction(weekStart, { cardId: target.cardId }, recipe.id),
      );
      return;
    }

    const tempId = `nouvelle-${Date.now()}`;
    const position = cards
      .filter((card) => card.day === target.day && card.meal_type === target.meal_type)
      .reduce((next, card) => Math.max(next, card.position + 1), 0);
    const temp: Card = {
      id: tempId,
      vid: tempId,
      day: target.day,
      meal_type: target.meal_type,
      position,
      recipe_id: recipe.id,
      member_ids: target.member_ids,
      locked: true,
    };
    const placeTarget: PlaceTarget = { day: target.day, meal_type: target.meal_type, member_ids: target.member_ids };
    setCards((current) => [...current, temp]);
    const result = await placeRecipeAction(weekStart, placeTarget, recipe.id).catch(() => ({ error: SAVE_ERROR }));
    if ("error" in result) {
      setCards((current) => current.filter((card) => card.id !== tempId));
      setError(result.error);
      return;
    }
    setCards((current) => current.map((card) => (card.id === tempId ? { ...result.card, vid: tempId } : card)));
  }

  async function anotherIdea(card: Card) {
    const already = [...(tried[card.id] ?? []), card.recipe_id];
    setBusy((current) => [...current, card.id]);
    setError(null);
    setDelays({});
    const result = await anotherIdeaAction(weekStart, card.id, already).catch(() => ({ error: SAVE_ERROR }));
    setBusy((current) => current.filter((id) => id !== card.id));
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if ("none" in result) {
      // Tout a été essayé : la prochaine fois, on repart du début.
      setTried((current) => ({ ...current, [card.id]: [] }));
      setNotice("Pas d’autre idée pour l’instant.");
      return;
    }
    setTried((current) => ({ ...current, [card.id]: already }));
    setCards((current) =>
      current.map((item) =>
        item.id === card.id ? { ...item, recipe_id: result.card.recipe_id, vid: `${item.id}:${result.card.recipe_id}` } : item,
      ),
    );
  }

  // ─── Glisser-déposer ──────────────────────────────────────────────────────
  const fits = (recipeId: string, mealType: MealType) => recipeById.get(recipeId)?.meal_types.includes(mealType) ?? false;

  function canDrop(current: Drag, targetId: string) {
    if (targetId.startsWith("card:")) {
      const target = cards.find((card) => `card:${card.id}` === targetId);
      if (!target || target.locked) return false;
      if (current.kind === "recipe") return current.recipe.meal_types.includes(target.meal_type);
      return (
        current.card.id !== target.id &&
        fits(current.card.recipe_id, target.meal_type) &&
        fits(target.recipe_id, current.card.meal_type)
      );
    }
    if (targetId.startsWith("slot:")) {
      const mealType = targetId.split(":")[2] as MealType;
      return current.kind === "recipe" && current.recipe.meal_types.includes(mealType);
    }
    return false;
  }

  function dropState(targetId: string): CardDragState | undefined {
    if (!drag) return undefined;
    if (drag.kind === "card" && targetId === `card:${drag.card.id}`) return "placeholder";
    if (!canDrop(drag, targetId)) return "refused";
    return overId === targetId ? "target" : undefined;
  }

  function onDragStart({ active }: DragStartEvent) {
    const id = String(active.id);
    if (id.startsWith("card:")) {
      const card = cards.find((item) => `card:${item.id}` === id);
      if (card) setDrag({ kind: "card", card });
    } else {
      const recipe = recipeById.get(id.slice("recipe:".length));
      if (recipe) setDrag({ kind: "recipe", recipe });
    }
  }

  function onDragOver({ over }: DragOverEvent) {
    setOverId(over ? String(over.id) : null);
  }

  // Jours défilants (téléphone, tablette) : le doigt qui reste au bord amène le jour voisin,
  // un jour à la fois.
  function onDragMove({ activatorEvent, delta }: DragMoveEvent) {
    if (wide) return;
    const start = activatorEvent as MouseEvent | TouchEvent;
    const x = ("touches" in start ? start.touches[0].clientX : start.clientX) + delta.x;
    const direction = x < EDGE ? -1 : x > window.innerWidth - EDGE ? 1 : 0;
    if (direction === (edge.current?.direction ?? 0)) return;
    stopEdge();
    if (direction !== 0) {
      const timer = window.setInterval(() => {
        const next = Math.min(6, Math.max(0, activeDayRef.current + direction));
        if (next !== activeDayRef.current) showDay(next);
      }, 800);
      edge.current = { direction, timer };
    }
  }

  function stopEdge() {
    if (edge.current) window.clearInterval(edge.current.timer);
    edge.current = null;
  }

  function onDragEnd({ over }: DragEndEvent) {
    const current = drag;
    stopEdge();
    setDrag(null);
    setOverId(null);
    if (!current || !over) return;
    const targetId = String(over.id);
    if (!canDrop(current, targetId)) return;

    if (targetId.startsWith("card:")) {
      const target = cards.find((card) => `card:${card.id}` === targetId)!;
      if (current.kind === "card") swap(current.card, target);
      else void place({ kind: "card", cardId: target.id }, current.recipe);
      return;
    }
    if (current.kind === "recipe") {
      const [, day, mealType] = targetId.split(":");
      const slot = slots.find((item) => item.day === Number(day) && item.meal_type === mealType);
      if (slot) void place({ kind: "slot", day: slot.day, meal_type: slot.meal_type, member_ids: slot.member_ids }, current.recipe);
    }
  }

  // ─── Téléphone : un jour à la fois ────────────────────────────────────────
  function onScroll() {
    const element = scroller.current;
    if (!element) return;
    const distance = (day: number) => Math.abs((dayOffset(element, day) ?? Infinity) - element.scrollLeft);
    const nearest = days.reduce((best, _, day) => (distance(day) < distance(best) ? day : best), 0);
    activeDayRef.current = nearest;
    setActiveDay(nearest);
  }

  function showDay(day: number) {
    const left = dayOffset(scroller.current, day);
    if (left !== null) scroller.current?.scrollTo({ left, behavior: "smooth" });
    activeDayRef.current = day;
    setActiveDay(day);
  }

  // ─── Panneau « Changer » ──────────────────────────────────────────────────
  const sheetCard = sheet?.kind === "card" ? cards.find((card) => card.id === sheet.cardId) : undefined;
  const sheetMeal = sheet ? (sheet.kind === "card" ? sheetCard?.meal_type : sheet.meal_type) : undefined;
  const sheetDay = sheet ? (sheet.kind === "card" ? sheetCard?.day : sheet.day) : undefined;
  const sheetEaterIds = sheet ? (sheet.kind === "card" ? (sheetCard?.member_ids ?? []) : sheet.member_ids) : [];

  const hasCards = cards.length > 0;
  const proposeButton = (block: boolean) => (
    <Button size="lg" block={block} onClick={propose} disabled={proposing}>
      <Sparkles aria-hidden="true" />
      {proposing ? "Je prépare…" : hasCards ? "Relancer" : "Proposer la semaine"}
    </Button>
  );

  const renderSlot = (slot: BoardSlot<Card>) => {
    const slotLabel = `${MEAL_NOUN[slot.meal_type]} de ${days[slot.day].long}`;
    return (
      <div key={slot.meal_type} className="flex flex-col gap-2">
        <h3
          className={cn(
            "text-[0.9375rem] font-semibold text-muted-foreground",
            // Dans la grille, la ligne dit déjà le repas ; le pique-nique le rappelle sur sa carte.
            (slot.meal_type !== "pique_nique" || slot.cards.length > 0) && "xl:sr-only",
          )}
        >
          <MealLabel type={slot.meal_type} />
        </h3>
        {slot.cards.length === 0 ? (
          <DroppableSlot
            id={`slot:${slot.day}:${slot.meal_type}`}
            label={`Choisir ${slotLabel}`}
            compact={wide}
            dropState={dropState(`slot:${slot.day}:${slot.meal_type}`) as "target" | "refused" | undefined}
            onClick={() => setSheet({ kind: "slot", day: slot.day, meal_type: slot.meal_type, member_ids: slot.member_ids })}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {slot.cards.map((card) => {
                const recipe = recipeById.get(card.recipe_id);
                return (
                  <BoardCard
                    key={card.vid}
                    id={card.id}
                    vid={card.vid}
                    delay={delays[card.id] ?? 0}
                    recipe={{
                      title: recipe?.title ?? "Recette",
                      minutes: recipe?.minutes ?? 0,
                      photo_url: recipe?.photo_url ?? null,
                      mealType: slot.meal_type,
                    }}
                    eaters={eatersOf(card.member_ids, recipe)}
                    household={members}
                    locked={card.locked}
                    layout={wide ? "column" : "row"}
                    dragState={dropState(`card:${card.id}`)}
                    showMeal={slot.meal_type === "pique_nique"}
                    busy={busy.includes(card.id)}
                    onOpen={() => setSheet({ kind: "card", cardId: card.id })}
                    onToggleLock={() => toggleLock(card)}
                    onAnotherIdea={() => void anotherIdea(card)}
                  />
                );
              })}
            </AnimatePresence>
          </ul>
        )}
        {slot.unfed.length > 0 && (
          <p className="text-[0.9375rem] text-muted-foreground">
            Rien de prévu pour{" "}
            {new Intl.ListFormat("fr", { type: "conjunction" }).format(
              slot.unfed.map((id) => memberById.get(id)?.first_name ?? "?"),
            )}
            .{" "}
            <Button
              variant="link"
              className="min-h-0 align-baseline"
              onClick={() => setSheet({ kind: "slot", day: slot.day, meal_type: slot.meal_type, member_ids: slot.unfed })}
            >
              Choisir
            </Button>
          </p>
        )}
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      // Les jours ne défilent pas tout seuls (voir onDragMove) ; la page, si.
      autoScroll={{ canScroll: (element) => element !== scroller.current }}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        stopEdge();
        setDrag(null);
        setOverId(null);
      }}
    >
      <PageHeader
        title="La semaine"
        lead={
          hasCards
            ? "Touche un plat pour le changer, fais-le glisser sur un autre pour les échanger, verrouille ce que tu gardes."
            : "Touche « Proposer la semaine » : tous les repas se remplissent d’un coup, selon les goûts de chacun."
        }
        action={
          <div className="hidden items-center gap-2 sm:flex">
            <Button
              variant="secondary"
              size="lg"
              className="hidden lg:inline-flex"
              aria-expanded={drawer}
              aria-controls="bibliotheque"
              onClick={() => setDrawer((open) => !open)}
            >
              <BookOpen aria-hidden="true" />
              Bibliothèque
            </Button>
            {proposeButton(false)}
          </div>
        }
      />

      <div className="mt-6 max-w-md">
        <WeekPicker label={label} relation={relation} prevHref={prevHref} nextHref={nextHref} />
      </div>
      <div className="mt-5 sm:hidden">{proposeButton(true)}</div>

      <div className="mt-4 min-h-6" aria-live="polite">
        {error && <FieldError alert>{error}</FieldError>}
        {notice && <p className="font-semibold text-muted-foreground">{notice}</p>}
      </div>

      <DayStrip
        days={days}
        active={activeDay}
        onSelect={showDay}
        className="sticky top-(--header-height) z-20 -mx-5 mt-2 bg-background/95 px-5 py-2 backdrop-blur-md sm:hidden"
      />

      <LayoutGroup>
        <motion.div
          ref={scroller}
          layoutScroll
          onScroll={onScroll}
          className={cn(
            "relative -mx-5 mt-3 flex scroll-px-5 gap-5 overflow-x-auto px-5 pb-6 sm:scroll-px-8 [scrollbar-width:none] sm:-mx-8 sm:gap-4 sm:px-8 xl:mx-0 xl:grid xl:grid-cols-[6rem_repeat(7,minmax(0,1fr))] xl:gap-x-3 xl:gap-y-4 xl:overflow-visible xl:px-0 [&::-webkit-scrollbar]:hidden",
            drag ? "snap-none" : "snap-x snap-mandatory",
          )}
        >
          {/* Ordinateur : les noms des lignes, à gauche. */}
          <div aria-hidden="true" className="hidden xl:grid xl:grid-rows-subgrid" style={{ gridRow: `span ${board.length + 1}` }}>
            <span />
            {board.map((row) => (
              <p key={row.row} className="pt-2 font-heading text-[1.25rem] leading-tight">
                <MealLabel type={row.row} className="flex-col items-start gap-1" />
              </p>
            ))}
          </div>

          {days.map((day, index) => (
            <section
              key={day.short}
              data-day={index}
              aria-label={`${day.long} ${day.date}`}
              className="flex w-full min-w-0 shrink-0 snap-start flex-col gap-5 sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)] xl:grid xl:w-auto xl:grid-rows-subgrid xl:gap-y-4"
              style={{ gridRow: `span ${board.length + 1}` }}
            >
              <h2 className="sr-only sm:not-sr-only sm:flex sm:items-baseline sm:gap-2 sm:font-heading sm:text-[1.375rem] xl:justify-center">
                <span className="first-letter:uppercase">{day.short}</span>
                <span className="text-muted-foreground">{day.date}</span>
              </h2>
              {board.map((row) =>
                row.days[index].slots.length === 0 ? (
                  <div key={row.row} aria-hidden="true" className="hidden xl:block" />
                ) : (
                  <div key={row.row} className="flex flex-col gap-4">
                    {row.days[index].slots.map(renderSlot)}
                  </div>
                ),
              )}
            </section>
          ))}
        </motion.div>
      </LayoutGroup>

      {/* Ordinateur : la Bibliothèque, d'où l'on glisse des recettes. Elle s'efface pendant le glisser. */}
      <AnimatePresence>
        {drawer && (
          <motion.aside
            id="bibliotheque"
            aria-label="Bibliothèque"
            initial={{ x: "100%" }}
            animate={{ x: drag?.kind === "recipe" ? "105%" : 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="fixed inset-y-0 right-0 z-40 hidden w-[26rem] flex-col overflow-y-auto border-l border-border/80 bg-card px-5 pt-6 pb-10 shadow-lift lg:flex"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[1.625rem] leading-tight">Bibliothèque</h2>
                <p className="mt-1 text-muted-foreground">Glisse une recette sur un repas de la semaine.</p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Fermer la Bibliothèque" onClick={() => setDrawer(false)}>
                <X aria-hidden="true" />
              </Button>
            </div>
            <RecipeLibrary
              className="mt-5"
              recipes={recipes}
              renderItem={(recipe, item) => <DraggableRecipe id={recipe.id}>{item}</DraggableRecipe>}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      <DragOverlay dropAnimation={null}>
        {drag?.kind === "card" && (
          <PlannedMealCard
            recipe={{
              title: recipeById.get(drag.card.recipe_id)?.title ?? "Recette",
              minutes: recipeById.get(drag.card.recipe_id)?.minutes ?? 0,
              photo_url: recipeById.get(drag.card.recipe_id)?.photo_url ?? null,
              mealType: drag.card.meal_type,
            }}
            eaters={eatersOf(drag.card.member_ids, recipeById.get(drag.card.recipe_id))}
            household={members}
            locked={false}
            layout={wide ? "column" : "row"}
            dragState="lifted"
          />
        )}
        {drag?.kind === "recipe" && <LibraryItem recipe={drag.recipe} className="w-[24rem] shadow-lift" />}
      </DragOverlay>

      <Sheet open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
        <SheetContent>
          {sheet && sheetMeal !== undefined && sheetDay !== undefined && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {sheet.kind === "card" ? "Changer" : "Choisir"} {MEAL_NOUN[sheetMeal]} de {days[sheetDay].long}
                </SheetTitle>
                <SheetDescription>
                  {describeEaters(
                    members,
                    members.filter((member) => !sheetEaterIds.includes(member.id)).map((member) => member.id),
                  )}
                  {sheetCard && (
                    <>
                      {" · "}
                      <Link href={`/recettes/${sheetCard.recipe_id}`} className="text-link">
                        Voir la recette
                      </Link>
                    </>
                  )}
                </SheetDescription>
              </SheetHeader>
              <RecipeLibrary
                recipes={recipes}
                mealType={sheetMeal}
                eaters={sheetEaterIds.map((id) => memberById.get(id)).filter((member) => member !== undefined)}
                onPick={(recipe) => {
                  const target = sheet;
                  setSheet(null);
                  void place(target, recipe as WeekRecipe);
                }}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </DndContext>
  );
}
