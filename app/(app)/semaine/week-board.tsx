"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
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
import { BookOpen, ShoppingBasket, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { CookedControls } from "@/components/cooked-controls";
import { DayStrip } from "@/components/day-strip";
import { EatersPicker } from "@/components/eaters-picker";
import { AddExtraChip, ExtraChip } from "@/components/extra-chip";
import { ExtrasPanel, mealCount, type AddExtrasResult, type ExtrasScope } from "@/components/extras-panel";
import { FieldError } from "@/components/field";
import { MealLabel } from "@/components/meal-label";
import { PageHeader } from "@/components/page-header";
import { PlannedMealCard, type CardDragState } from "@/components/planned-meal-card";
import type { EaterMember } from "@/components/recipe-card";
import { LibraryItem, RecipeLibrary } from "@/components/recipe-library";
import { SameBaseNote } from "@/components/same-base-note";
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
import { baseKey } from "@/lib/bases";
import { buildBoard, canDropOn, extrasToAdd, menuBase, moveEaters, type BoardSlot, type ExtraItem, type ExtraTarget } from "@/lib/board";
import type { FridgeHint } from "@/lib/fridge";
import type { MealType, SlotInput } from "@/lib/meal-slots";
import { canEat } from "@/lib/planner";
import type { QuickRecipeInput } from "@/lib/quick-recipe";
import type { KnownIngredient, RecipeMember } from "@/lib/recipes-data";
import { courseOf, describeEaters, isExtra, type Course } from "@/lib/recipes";
import type { WeekCard, WeekRecipe } from "@/lib/week-data";
import {
  addDishAction,
  addExtrasAction,
  anotherIdeaAction,
  createQuickRecipeAction,
  placeRecipeAction,
  removeCardAction,
  restoreCardAction,
  setEatersAction,
  setSkippedAction,
  proposeWeekAction,
  swapCardsAction,
  toggleLockAction,
  type PlaceTarget,
} from "./actions";
import { addLeftoverAction } from "../frigo/actions";
import { BoardCard, DraggableExtra, DraggableRecipe, DroppableSlot, TrashZone } from "./board-pieces";

type Card = WeekCard & { vid: string };
type Day = { short: string; long: string; date: string };
// Un plat de la grille, une puce (entrée, dessert…), ou une recette de la Bibliothèque.
type Drag = { kind: "card"; card: Card } | { kind: "extra"; card: Card } | { kind: "recipe"; recipe: WeekRecipe };
// Le panneau du bas : changer un plat, choisir pour un repas (ou ses présents sans plat),
// ajouter un plat (« Pour qui ? », recette déjà choisie après un dépôt), dire qui mange un plat,
// ajouter des desserts, fruits… (« extras »), ou en ouvrir un (« extra »).
type SheetTarget =
  | { kind: "card"; cardId: string }
  | { kind: "slot"; day: number; meal_type: MealType; member_ids: string[] }
  | { kind: "add"; day: number; meal_type: MealType; recipeId?: string }
  | { kind: "eaters"; cardId: string }
  | { kind: "extras"; day: number; meal_type: MealType }
  | { kind: "extra"; cardId: string };
type PlaceSheet = Extract<SheetTarget, { kind: "card" | "slot" }>;

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

// « au dîner de mardi », « au pique-nique de mercredi ».
const toMeal = (mealType: MealType) => MEAL_NOUN[mealType].replace(/^le /, "au ");
// « retiré du dîner de mardi ».
const fromMeal = (mealType: MealType) => MEAL_NOUN[mealType].replace(/^le /, "du ");

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
  todayDay = null,
  members,
  slots,
  recipes,
  extraRecipes,
  fridgeHints,
  known,
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
  // Aujourd'hui, dans la semaine en cours (sinon null) : « Pas cuisiné » et « Il en reste »
  // valent pour les plats d'aujourd'hui et des jours passés.
  todayDay?: number | null;
  members: RecipeMember[];
  slots: SlotInput[];
  // Les plats (planificateur, Bibliothèque).
  recipes: WeekRecipe[];
  // Entrées, desserts, fruits, fromages, laitages (puces, panneau d'ajout).
  extraRecipes: WeekRecipe[];
  // Ce qu'on a déjà au frigo, parmi eux (« Au frigo », « À finir »).
  fridgeHints: Record<string, FridgeHint>;
  // Le référentiel, pour deviner la sorte d'une recette créée à la volée.
  known: KnownIngredient[];
  initialCards: WeekCard[];
}) {
  const [cards, setCards] = useState<Card[]>(() => initialCards.map((card) => ({ ...card, vid: card.id })));
  const [delays, setDelays] = useState<Record<string, number>>({});
  const [tried, setTried] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  // « Pour qui ? » / « Qui mange ce plat ? » : les présents cochés, et le rappel quand personne ne l'est.
  const [picked, setPicked] = useState<string[]>([]);
  const [pickHint, setPickHint] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // Au-dessus de la corbeille, la page ne défile pas toute seule (voir autoScroll).
  const overTrash = useRef(false);
  const [activeDay, setActiveDay] = useState(firstDay);
  const activeDayRef = useRef(firstDay);
  const edge = useRef<{ direction: number; timer: number } | null>(null);
  const [proposing, startProposing] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery("(min-width: 1280px)");
  const router = useRouter();
  // Les plats légers créés à la volée pendant la visite, en plus de ceux du serveur ; la
  // dernière sorte ouverte dans le panneau d'ajout.
  const [createdExtras, setCreatedExtras] = useState<WeekRecipe[]>([]);
  const [extraCourse, setExtraCourse] = useState<Course>("dairy");
  const extraList = useMemo(
    () => [...extraRecipes, ...createdExtras.filter((recipe) => !extraRecipes.some((other) => other.id === recipe.id))],
    [extraRecipes, createdExtras],
  );

  const board = useMemo(() => buildBoard(slots, cards), [slots, cards]);
  const recipeById = useMemo(
    () => new Map([...recipes, ...extraList].map((recipe) => [recipe.id, recipe])),
    [recipes, extraList],
  );
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

  // « Pas cuisiné » : ses ingrédients restent au frigo au bilan de la semaine.
  function setSkipped(card: Card, skipped: boolean) {
    void save(
      (current) => current.map((item) => (item.id === card.id ? { ...item, skipped } : item)),
      () => setSkippedAction(weekStart, card.id, skipped),
    );
  }

  // « Il en reste » : un reste de plat au frigo.
  async function storeLeftover(card: Card, parts: number) {
    const result = await addLeftoverAction(card.recipe_id, parts).catch(() => ({ error: SAVE_ERROR }));
    if ("error" in result) return result.error;
    setSheet(null);
    toast("Rangé au frigo");
    return null;
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

  async function place(target: PlaceSheet, recipe: WeekRecipe) {
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
      course: "main",
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
      current.map((item) => {
        const changed = result.cards.find((other) => other.id === item.id);
        return changed ? { ...item, recipe_id: changed.recipe_id, vid: `${item.id}:${changed.recipe_id}` } : item;
      }),
    );
  }

  // ─── Plusieurs plats par repas ────────────────────────────────────────────
  // Les cartes rendues par le serveur, en gardant l'identité visuelle de celles déjà là
  // (`fresh` : l'identité à donner aux nouvelles).
  function syncCards(result: WeekCard[], before: readonly Card[], fresh?: string) {
    setCards((current) =>
      result.map((card) => ({
        ...card,
        vid: current.find((item) => item.id === card.id)?.vid ?? (before.some((item) => item.id === card.id) ? card.id : (fresh ?? card.id)),
      })),
    );
  }

  const presentAt = (day: number, mealType: MealType) =>
    slots.find((slot) => slot.day === day && slot.meal_type === mealType)?.member_ids ?? [];

  // « + Ajouter un plat » : pré-cochés, les présents qui ont un régime.
  function openAdd(day: number, mealType: MealType, recipeId?: string) {
    setPicked(presentAt(day, mealType).filter((id) => (memberById.get(id)?.diets.length ?? 0) > 0));
    setPickHint(false);
    setSheet({ kind: "add", day, meal_type: mealType, recipeId });
  }

  function openEaters(card: Card) {
    setPicked(card.member_ids);
    setPickHint(false);
    setSheet({ kind: "eaters", cardId: card.id });
  }

  async function addDish(day: number, mealType: MealType, recipeId: string, memberIds: string[]) {
    const before = cards;
    const tempId = `nouvelle-${Date.now()}`;
    const position = cards
      .filter((card) => card.day === day && card.meal_type === mealType)
      .reduce((next, card) => Math.max(next, card.position + 1), 0);
    setError(null);
    setDelays({});
    setCards((current) =>
      moveEaters(
        [
          ...current,
          { id: tempId, vid: tempId, day, meal_type: mealType, position, recipe_id: recipeId, member_ids: memberIds, locked: true, course: "main" },
        ],
        tempId,
        memberIds,
      ),
    );
    const result = await addDishAction(weekStart, { day, meal_type: mealType }, recipeId, memberIds).catch(() => ({
      error: SAVE_ERROR,
    }));
    if ("error" in result) {
      setCards(before);
      setError(result.error);
      return;
    }
    syncCards(result.cards, before, tempId);
  }

  async function changeEaters(cardId: string, memberIds: string[]) {
    const before = cards;
    setError(null);
    setDelays({});
    setCards((current) => moveEaters(current, cardId, memberIds));
    const result = await setEatersAction(weekStart, cardId, memberIds).catch(() => ({ error: SAVE_ERROR }));
    if ("error" in result) {
      setCards(before);
      setError(result.error);
      return;
    }
    syncCards(result.cards, before);
  }

  // ─── Desserts, fruits, fromages ───────────────────────────────────────────
  function openExtra(card: Card) {
    setPicked(card.member_ids);
    setPickHint(false);
    setSheet({ kind: "extra", cardId: card.id });
  }

  // Le premier jour visé par « Tous les dîners de la semaine » : aujourd'hui dans la semaine en
  // cours, lundi sinon.
  const fromDay = todayDay ?? 0;

  // Les ajouts tout de suite à l'écran (fusion ou nouvelle puce), puis les cartes du serveur.
  function withExtras(current: Card[], items: readonly ExtraItem[]) {
    let next = [...current];
    for (const item of items) {
      if (item.cardId) {
        next = next.map((card) => (card.id === item.cardId ? { ...card, member_ids: item.member_ids } : card));
        continue;
      }
      const tempId = `nouvelle-${item.day}-${item.meal_type}-${item.recipe_id}`;
      const position = next
        .filter((card) => card.day === item.day && card.meal_type === item.meal_type)
        .reduce((max, card) => Math.max(max, card.position + 1), 0);
      next.push({ ...item, id: tempId, vid: tempId, position, locked: false, course: recipeById.get(item.recipe_id)?.course });
    }
    return next;
  }

  async function addExtras(
    day: number,
    mealType: MealType,
    scope: ExtrasScope,
    recipeIds: string[],
    memberIds: string[],
  ): Promise<AddExtrasResult> {
    const target: ExtraTarget = scope === "meal" ? { day, meal_type: mealType } : { meal_type: mealType, fromDay };
    const chosen = recipeIds.map((id) => recipeById.get(id)).filter((recipe) => recipe !== undefined);
    const before = cards;
    setError(null);
    setDelays({});
    setCards((current) =>
      withExtras(current, extrasToAdd({ recipes: chosen, eaterIds: memberIds, target, slots, cards: current, members }).items),
    );
    const result = await addExtrasAction(weekStart, target, recipeIds, memberIds).catch(() => ({ error: SAVE_ERROR }));
    if ("error" in result) {
      setCards(before);
      return { error: result.error };
    }
    syncCards(result.cards, before);
    if (result.meals > 0) {
      // Un dessert créé avec son titre seulement : on propose de le compléter.
      const incomplete = chosen.find((recipe) => recipe.ingredientNames.length === 0);
      toast(
        scope === "week" ? `Ajouté à ${mealCount(mealType, result.meals)}` : `Ajouté ${toMeal(mealType)} de ${days[day].long}`,
        incomplete
          ? { action: { label: "Compléter la recette", onClick: () => router.push(`/recettes/${incomplete.id}/modifier`) } }
          : undefined,
      );
    }
    return { unserved: result.unserved };
  }

  async function createQuick(input: QuickRecipeInput) {
    const result = await createQuickRecipeAction(input).catch(() => ({ error: SAVE_ERROR }));
    if ("recipe" in result) setCreatedExtras((current) => [...current, result.recipe]);
    return result;
  }

  function removeCard(cardId: string) {
    void save(
      (current) => current.filter((card) => card.id !== cardId),
      () => removeCardAction(weekStart, cardId),
    );
  }

  // La corbeille : la carte part tout de suite, « Annuler » la fait revenir pendant 5 secondes.
  function trash(card: Card) {
    const title = recipeById.get(card.recipe_id)?.title ?? "Recette";
    const before = cards;
    removeCard(card.id);
    navigator.vibrate?.(15);
    toast(`${title} retiré ${fromMeal(card.meal_type)} de ${days[card.day].long}`, {
      duration: 5000,
      action: { label: "Annuler", onClick: () => void restore(card, before) },
    });
  }

  async function restore(card: Card, before: readonly Card[]) {
    const { vid, ...saved } = card;
    setError(null);
    setDelays({});
    const result = await restoreCardAction(weekStart, saved).catch(() => ({ error: SAVE_ERROR }));
    if ("error" in result) {
      setError(result.error);
      return;
    }
    syncCards(result.cards, before.filter((item) => item.id !== card.id), vid);
  }

  // La base que partagent au moins deux plats du repas, telle qu'écrite sur la recette.
  function sharedBase(list: readonly Card[]) {
    const seen = new Map<string, string>();
    for (const card of list) {
      const base = recipeById.get(card.recipe_id)?.base;
      const key = baseKey(base);
      if (!key || !base) continue;
      if (seen.has(key)) return seen.get(key)!;
      seen.set(key, base);
    }
    return null;
  }

  // ─── Glisser-déposer ──────────────────────────────────────────────────────
  const fits = (recipeId: string, mealType: MealType) => recipeById.get(recipeId)?.meal_types.includes(mealType) ?? false;

  const canDrop = (current: Drag, targetId: string) => canDropOn(current, targetId, cards, fits);

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
    } else if (id.startsWith("extra:")) {
      const card = cards.find((item) => `extra:${item.id}` === id);
      if (card) setDrag({ kind: "extra", card });
    } else {
      const recipe = recipeById.get(id.slice("recipe:".length));
      if (recipe) setDrag({ kind: "recipe", recipe });
    }
  }

  function onDragOver({ over }: DragOverEvent) {
    overTrash.current = over?.id === "trash";
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
    overTrash.current = false;
    if (!current || !over) return;
    const targetId = String(over.id);
    if (!canDrop(current, targetId)) return;

    if (targetId === "trash" && current.kind !== "recipe") {
      trash(current.card);
      return;
    }

    if (targetId.startsWith("card:")) {
      const target = cards.find((card) => `card:${card.id}` === targetId)!;
      if (current.kind === "card") swap(current.card, target);
      else if (current.kind === "recipe") void place({ kind: "card", cardId: target.id }, current.recipe);
      return;
    }
    if (current.kind === "recipe" && targetId.startsWith("add:")) {
      const [, day, mealType] = targetId.split(":");
      openAdd(Number(day), mealType as MealType, current.recipe.id);
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
  const sheetCard = sheet && "cardId" in sheet ? cards.find((card) => card.id === sheet.cardId) : undefined;
  const sheetMeal = sheet ? ("cardId" in sheet ? sheetCard?.meal_type : sheet.meal_type) : undefined;
  const sheetDay = sheet ? ("cardId" in sheet ? sheetCard?.day : sheet.day) : undefined;
  const sheetEaterIds = !sheet
    ? []
    : sheet.kind === "slot"
      ? sheet.member_ids
      : sheet.kind === "add"
        ? picked
        : (sheetCard?.member_ids ?? []);
  // Les présents du repas, dans l'ordre du foyer, comme partout ailleurs.
  const sheetPresent =
    sheetDay !== undefined && sheetMeal !== undefined
      ? members.filter((member) => presentAt(sheetDay, sheetMeal).includes(member.id))
      : [];
  const pickedMembers = members.filter((member) => picked.includes(member.id));
  // L'élément principal déjà au menu de ce repas : ses basiques passent en tête (une seule cuisson).
  const sheetBase =
    sheetDay !== undefined && sheetMeal !== undefined
      ? menuBase(cards, (recipeId) => recipeById.get(recipeId)?.base, {
          day: sheetDay,
          meal_type: sheetMeal,
          cardId: sheetCard?.id,
        })
      : null;

  function sheetBody(target: SheetTarget, mealType: MealType, day: number) {
    const mealOfDay = `${MEAL_NOUN[mealType]} de ${days[day].long}`;

    if (target.kind === "extras") {
      return (
        <ExtrasPanel
          mealType={mealType}
          dayLabel={days[day].long}
          present={sheetPresent}
          recipes={extraList}
          already={cards
            .filter((card) => card.day === day && card.meal_type === mealType && isExtra(card.course))
            .map((card) => card.recipe_id)}
          weekMeals={slots.filter((slot) => slot.meal_type === mealType && slot.day >= fromDay).length}
          fridgeHints={fridgeHints}
          known={known}
          course={extraCourse}
          onCourseChange={setExtraCourse}
          onAdd={(scope, recipeIds, memberIds) => addExtras(day, mealType, scope, recipeIds, memberIds)}
          onCreate={createQuick}
          onClose={() => setSheet(null)}
        />
      );
    }

    if (target.kind === "extra") {
      if (!sheetCard) return null;
      const recipe = recipeById.get(sheetCard.recipe_id);
      // Un dessert complet ou une entrée : sa fiche, et « Il en reste ». Un yaourt, une pomme : non.
      const light = !recipe || (recipe.servings === 1 && recipe.ingredientNames.length <= 1);
      return (
        <>
          <SheetHeader>
            <SheetTitle>{recipe?.title ?? "Recette"}</SheetTitle>
            <SheetDescription>
              {courseOf(sheetCard.course).label} · {mealOfDay}
              {!light && (
                <>
                  {" · "}
                  <Link href={`/recettes/${sheetCard.recipe_id}`} className="text-link">
                    Voir la recette
                  </Link>
                </>
              )}
            </SheetDescription>
          </SheetHeader>
          {todayDay !== null && sheetCard.day <= todayDay && (
            <div className="mb-4">
              <CookedControls
                eaten
                skipped={Boolean(sheetCard.skipped)}
                onSkippedChange={(skipped) => setSkipped(sheetCard, skipped)}
                onLeftover={light ? undefined : (parts) => storeLeftover(sheetCard, parts)}
              />
            </div>
          )}
          <EatersPicker label="Qui en mange ?" members={sheetPresent} selected={picked} onChange={setPicked} recipe={recipe} />
          <Button
            block
            size="lg"
            className="mt-5"
            disabled={picked.length === 0}
            onClick={() => {
              setSheet(null);
              void changeEaters(sheetCard.id, picked);
            }}
          >
            Valider
          </Button>
          <Button
            variant="ghost"
            block
            className="mt-2 text-muted-foreground"
            onClick={() => {
              setSheet(null);
              removeCard(sheetCard.id);
            }}
          >
            <Trash2 aria-hidden="true" />
            Retirer
          </Button>
        </>
      );
    }

    if (target.kind === "eaters") {
      const recipe = sheetCard ? recipeById.get(sheetCard.recipe_id) : undefined;
      return (
        <>
          <SheetHeader>
            <SheetTitle>Qui mange ce plat ?</SheetTitle>
            <SheetDescription>
              {recipe?.title ?? "Recette"} · {mealOfDay}
            </SheetDescription>
          </SheetHeader>
          <EatersPicker
            label="Ceux qui le mangent"
            labelHidden
            members={sheetPresent}
            selected={picked}
            onChange={setPicked}
            recipe={recipe}
          />
          <p className="mt-3 text-[0.9375rem] text-muted-foreground">
            Un membre coché ici quitte l’autre plat du repas.
          </p>
          <Button
            block
            size="lg"
            className="mt-5"
            disabled={picked.length === 0}
            onClick={() => {
              setSheet(null);
              void changeEaters(target.cardId, picked);
            }}
          >
            Valider
          </Button>
        </>
      );
    }

    if (target.kind === "add") {
      const chosen = target.recipeId ? recipeById.get(target.recipeId) : undefined;
      return (
        <>
          <SheetHeader>
            <SheetTitle>
              Ajouter un plat {toMeal(mealType)} de {days[day].long}
            </SheetTitle>
            <SheetDescription>
              {chosen ? "Coche qui le mange, puis valide." : "Coche qui le mange, puis choisis la recette."}
            </SheetDescription>
          </SheetHeader>
          <EatersPicker
            members={sheetPresent}
            selected={picked}
            onChange={(ids) => {
              setPicked(ids);
              setPickHint(false);
            }}
            recipe={chosen}
          />
          {chosen ? (
            <>
              <LibraryItem recipe={chosen} mealType={mealType} className="mt-5" />
              <Button
                block
                size="lg"
                className="mt-5"
                disabled={picked.length === 0}
                onClick={() => {
                  setSheet(null);
                  void addDish(day, mealType, chosen.id, picked);
                }}
              >
                Valider
              </Button>
            </>
          ) : (
            <>
              {pickHint && (
                <div className="mt-3">
                  <FieldError alert>Touche d’abord qui mange ce plat.</FieldError>
                </div>
              )}
              <RecipeLibrary
                className="mt-5"
                recipes={recipes}
                mealType={mealType}
                eaters={pickedMembers}
                firstBase={menuBase(cards, (recipeId) => recipeById.get(recipeId)?.base, { day, meal_type: mealType })}
                onPick={(recipe) => {
                  if (picked.length === 0) {
                    setPickHint(true);
                    return;
                  }
                  setSheet(null);
                  void addDish(day, mealType, recipe.id, picked);
                }}
              />
            </>
          )}
        </>
      );
    }

    return (
      <>
        <SheetHeader>
          <SheetTitle>
            {target.kind === "card" ? "Changer" : "Choisir"} {mealOfDay}
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
        {target.kind === "card" && sheetCard && todayDay !== null && sheetCard.day <= todayDay && (
          <div className="mb-4">
            <CookedControls
              skipped={Boolean(sheetCard.skipped)}
              onSkippedChange={(skipped) => setSkipped(sheetCard, skipped)}
              onLeftover={(parts) => storeLeftover(sheetCard, parts)}
            />
          </div>
        )}
        {target.kind === "card" && (
          <div className="-mt-2 mb-1">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 text-muted-foreground"
              onClick={() => {
                setSheet(null);
                removeCard(target.cardId);
              }}
            >
              <Trash2 aria-hidden="true" />
              Retirer ce plat
            </Button>
          </div>
        )}
        <RecipeLibrary
          recipes={recipes}
          mealType={mealType}
          eaters={sheetEaterIds.map((id) => memberById.get(id)).filter((member) => member !== undefined)}
          firstBase={sheetBase}
          onPick={(recipe) => {
            setSheet(null);
            void place(target, recipe as WeekRecipe);
          }}
        />
      </>
    );
  }

  // « Relancer » quand il y a des plats ; un yaourt seul ne compte pas.
  const hasCards = cards.some((card) => !isExtra(card.course));
  const proposeButton = (block: boolean) => (
    <Button size="lg" block={block} onClick={propose} disabled={proposing}>
      <Sparkles aria-hidden="true" />
      {proposing ? "Je prépare…" : hasCards ? "Relancer" : "Proposer la semaine"}
    </Button>
  );

  // Les puces d'un repas : avatars seulement quand ce n'est pas pour tous les présents (ou que
  // quelqu'un en mange sans le pouvoir).
  const extraChips = (slot: BoardSlot<Card>, list: Card[], trailing?: ReactNode) =>
    (list.length > 0 || trailing) && (
      <ul className="flex min-w-0 flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {list.map((card) => {
            const recipe = recipeById.get(card.recipe_id);
            const eaters = members.filter((member) => card.member_ids.includes(member.id));
            const out = recipe ? eaters.filter((member) => !canEat(recipe, member)).map((member) => member.id) : [];
            const forAll = slot.member_ids.every((id) => card.member_ids.includes(id));
            return (
              <motion.li
                key={card.vid}
                layout="position"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                className="min-w-0 max-w-full"
              >
                <DraggableExtra id={card.id}>
                  <ExtraChip
                    course={card.course ?? "dessert"}
                    title={recipe?.title ?? "Recette"}
                    eaters={forAll && out.length === 0 ? undefined : eaters}
                    outIds={out}
                    skipped={Boolean(card.skipped)}
                    onOpen={() => openExtra(card)}
                  />
                </DraggableExtra>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {trailing && <li className="min-w-0 max-w-full">{trailing}</li>}
      </ul>
    );

  const renderSlot = (slot: BoardSlot<Card>) => {
    const slotLabel = `${MEAL_NOUN[slot.meal_type]} de ${days[slot.day].long}`;
    return (
      <div key={slot.meal_type} data-meal={slot.meal_type} className="flex min-w-0 flex-col gap-2">
        <h3
          className={cn(
            "text-[0.9375rem] font-semibold text-muted-foreground",
            // Dans la grille, la ligne dit déjà le repas ; le pique-nique le rappelle sur sa carte.
            (slot.meal_type !== "pique_nique" || slot.cards.length > 0) && "xl:sr-only",
          )}
        >
          <MealLabel type={slot.meal_type} />
        </h3>
        {extraChips(slot, slot.starters)}
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
                    skipped={Boolean(card.skipped)}
                    busy={busy.includes(card.id)}
                    onOpen={() => setSheet({ kind: "card", cardId: card.id })}
                    onEaters={() => openEaters(card)}
                    onToggleLock={() => toggleLock(card)}
                    onAnotherIdea={() => void anotherIdea(card)}
                  />
                );
              })}
            </AnimatePresence>
          </ul>
        )}
        {slot.cards.length > 1 && sharedBase(slot.cards) && <SameBaseNote base={sharedBase(slot.cards)!} />}
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
        {slot.cards.length > 0 && (
          <DroppableSlot
            id={`add:${slot.day}:${slot.meal_type}`}
            variant="add"
            label={`Ajouter un plat ${toMeal(slot.meal_type)} de ${days[slot.day].long}`}
            compact={wide}
            dropState={dropState(`add:${slot.day}:${slot.meal_type}`) as "target" | "refused" | undefined}
            onClick={() => openAdd(slot.day, slot.meal_type)}
          />
        )}
        {extraChips(
          slot,
          slot.extras,
          <AddExtraChip
            label={`Ajouter un dessert, un fruit… ${toMeal(slot.meal_type)} de ${days[slot.day].long}`}
            onClick={() => setSheet({ kind: "extras", day: slot.day, meal_type: slot.meal_type })}
          />,
        )}
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      // Les jours ne défilent pas tout seuls (voir onDragMove) ; la page, si, sauf au-dessus de la
      // corbeille (fixée en bas de l'écran, là où la page se mettrait à descendre).
      autoScroll={{ canScroll: (element) => element !== scroller.current && !overTrash.current }}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        stopEdge();
        setDrag(null);
        setOverId(null);
        overTrash.current = false;
      }}
    >
      <PageHeader
        title="La semaine"
        lead={
          hasCards
            ? "Touche un plat pour le changer. Reste appuyé pour le déplacer sur un autre, ou le jeter dans la corbeille. Verrouille ce que tu gardes."
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

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="w-full max-w-md">
          <WeekPicker label={label} relation={relation} prevHref={prevHref} nextHref={nextHref} />
        </div>
        {cards.length > 0 && <ShoppingLink className="hidden sm:inline-flex" weekStart={weekStart} />}
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:hidden">
        {proposeButton(true)}
        {cards.length > 0 && <ShoppingLink block weekStart={weekStart} />}
      </div>

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
                  <div key={row.row} className="flex min-w-0 flex-col gap-4">
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
            locked={drag.card.locked}
            layout={wide ? "column" : "row"}
            dragState="lifted"
          />
        )}
        {drag?.kind === "extra" && (
          <ExtraChip
            course={drag.card.course ?? "dessert"}
            title={recipeById.get(drag.card.recipe_id)?.title ?? "Recette"}
            skipped={Boolean(drag.card.skipped)}
            onOpen={() => {}}
            className="shadow-lift"
          />
        )}
        {drag?.kind === "recipe" && <LibraryItem recipe={drag.recipe} className="w-[24rem] shadow-lift" />}
      </DragOverlay>

      {/* La corbeille, pendant qu'on fait glisser un plat ou une puce (pas une recette). */}
      <AnimatePresence>{drag && drag.kind !== "recipe" && <TrashZone over={overId === "trash"} />}</AnimatePresence>

      <Sheet open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
        <SheetContent>{sheet && sheetMeal !== undefined && sheetDay !== undefined && sheetBody(sheet, sheetMeal, sheetDay)}</SheetContent>
      </Sheet>
    </DndContext>
  );
}

// « Faire les courses » : la liste de courses de la semaine affichée.
function ShoppingLink({ weekStart, block = false, className }: { weekStart: string; block?: boolean; className?: string }) {
  return (
    <Button asChild variant="secondary" size="lg" block={block} className={className}>
      <Link href={`/courses?semaine=${weekStart}`}>
        <ShoppingBasket aria-hidden="true" />
        Faire les courses
      </Link>
    </Button>
  );
}
