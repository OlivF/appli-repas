"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Clock, Heart, TriangleAlert, Zap } from "lucide-react";
import { cn } from "cn";
import { ChoiceChip } from "@/components/choice-chip";
import { ChoiceRow } from "@/components/field";
import { MEAL_TINT } from "@/components/meal-label";
import { RecipeCover } from "@/components/recipe-cover";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { MEAL_TYPES, type MealType } from "@/lib/meal-slots";
import { DIETS, type Diet } from "@/lib/members";
import type { ListRecipe } from "@/lib/recipes-data";
import { filterRecipes, formatDuration, memberEatability } from "@/lib/recipes";

export type LibraryRecipe = ListRecipe;
type LibraryEater = { id: string; first_name: string; diets: readonly Diet[] };

// Une recette rapide se prépare et cuit en 30 minutes au plus.
export const QUICK_MINUTES = 30;

type Filters = { query: string; mealTypes: MealType[]; diets: Diet[]; favorites: boolean; quick: boolean };
const NO_FILTERS: Filters = { query: "", mealTypes: [], diets: [], favorites: false, quick: false };

function toggle<T>(list: T[], value: T, on: boolean) {
  return on ? [...list, value] : list.filter((item) => item !== value);
}

// Ceux de `eaters` à qui la recette ne convient pas (régime ou exclusion).
export function unsuitableFor(recipe: LibraryRecipe, eaters: readonly LibraryEater[]) {
  return eaters.filter((eater) => memberEatability(recipe, eater, recipe.excludedIds) !== "ok");
}

// La Bibliothèque : chercher et filtrer les recettes, pour en poser une dans la semaine.
// `mealType` : seulement les recettes de ce repas. `eaters` : ceux qui mangeront, pour
// signaler (et ranger en dernier) ce qui ne leur convient pas. `onPick` : chaque recette
// est un bouton. `renderItem` : pour envelopper chaque recette (glisser-déposer).
export function RecipeLibrary({
  recipes,
  mealType,
  eaters = [],
  onPick,
  renderItem,
  className,
}: {
  recipes: LibraryRecipe[];
  mealType?: MealType;
  eaters?: readonly LibraryEater[];
  onPick?: (recipe: LibraryRecipe) => void;
  renderItem?: (recipe: LibraryRecipe, item: ReactNode) => ReactNode;
  className?: string;
}) {
  const searchId = useId();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const update = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));

  const visible = useMemo(() => {
    const ofMeal = mealType ? recipes.filter((recipe) => recipe.meal_types.includes(mealType)) : recipes;
    return filterRecipes(ofMeal, { ...filters, batch: false })
      .filter((recipe) => !filters.quick || recipe.minutes <= QUICK_MINUTES)
      .map((recipe) => ({ recipe, unsuitable: unsuitableFor(recipe, eaters) }))
      .sort(
        (a, b) =>
          Number(a.unsuitable.length > 0) - Number(b.unsuitable.length > 0) ||
          a.recipe.title.localeCompare(b.recipe.title, "fr"),
      );
  }, [recipes, mealType, filters, eaters]);

  return (
    <div className={className}>
      <SearchField
        id={searchId}
        label="Chercher une recette"
        placeholder="Une recette, un ingrédient…"
        value={filters.query}
        onValueChange={(query) => update({ query })}
      />

      <div className="mt-3 space-y-1">
        {!mealType && (
          <ChoiceRow legend="Repas">
            {MEAL_TYPES.map((meal) => (
              <ChoiceChip
                key={meal.value}
                type="checkbox"
                checked={filters.mealTypes.includes(meal.value)}
                onChange={(event) => update({ mealTypes: toggle(filters.mealTypes, meal.value, event.target.checked) })}
                icon={<span className="text-[1.1em] leading-none">{meal.emoji}</span>}
              >
                {meal.label}
              </ChoiceChip>
            ))}
          </ChoiceRow>
        )}
        <ChoiceRow legend="Filtres">
          <ChoiceChip type="checkbox" checked={filters.quick} onChange={(event) => update({ quick: event.target.checked })} icon={<Zap />}>
            Rapide
          </ChoiceChip>
          <ChoiceChip
            type="checkbox"
            checked={filters.favorites}
            onChange={(event) => update({ favorites: event.target.checked })}
            icon={<Heart />}
          >
            Favoris
          </ChoiceChip>
          {DIETS.map((diet) => (
            <ChoiceChip
              key={diet.value}
              type="checkbox"
              checked={filters.diets.includes(diet.value)}
              onChange={(event) => update({ diets: toggle(filters.diets, diet.value, event.target.checked) })}
            >
              {diet.label}
            </ChoiceChip>
          ))}
        </ChoiceRow>
      </div>

      <div className="mt-2 flex min-h-11 items-center justify-between gap-4">
        <p role="status" className="font-semibold text-muted-foreground">
          {visible.length} {visible.length > 1 ? "recettes" : "recette"}
        </p>
        {JSON.stringify(filters) !== JSON.stringify(NO_FILTERS) && (
          <Button variant="link" onClick={() => setFilters(NO_FILTERS)}>
            Effacer les filtres
          </Button>
        )}
      </div>

      <ul aria-label="Recettes" className="mt-1 space-y-2">
        {visible.map(({ recipe, unsuitable }) => {
          const item = (
            <LibraryItem
              recipe={recipe}
              mealType={mealType}
              unsuitable={unsuitable.map((eater) => eater.first_name)}
              onPick={onPick && (() => onPick(recipe))}
            />
          );
          return <li key={recipe.id}>{renderItem ? renderItem(recipe, item) : item}</li>;
        })}
      </ul>
    </div>
  );
}

// Une ligne de la Bibliothèque : vignette, titre, temps, favori, et à qui elle ne convient pas.
export function LibraryItem({
  recipe,
  mealType,
  unsuitable = [],
  onPick,
  className,
}: {
  recipe: LibraryRecipe;
  mealType?: MealType;
  unsuitable?: string[];
  onPick?: () => void;
  className?: string;
}) {
  const cover = mealType ?? recipe.meal_types[0] ?? "soir";
  const content = (
    <>
      <span className={cn("relative size-14 shrink-0 overflow-hidden rounded-xl", MEAL_TINT[cover])}>
        <RecipeCover small mealType={cover} image={recipe.photo_url ? { src: recipe.photo_url, alt: "" } : undefined} sizes="3.5rem" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 font-semibold leading-snug">{recipe.title}</span>
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.875rem] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden="true" className="size-3.5" />
            {formatDuration(recipe.minutes)}
          </span>
          {recipe.favorite && (
            <span className="inline-flex items-center gap-1">
              <Heart aria-hidden="true" className="size-3.5 fill-primary text-primary" />
              Favori
            </span>
          )}
        </span>
        {unsuitable.length > 0 && (
          <span className="inline-flex items-start gap-1.5 text-[0.875rem] leading-snug font-semibold text-destructive">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            Ne convient pas à {new Intl.ListFormat("fr", { type: "conjunction" }).format(unsuitable)}
          </span>
        )}
      </span>
    </>
  );

  const frame = "flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card p-2 text-left shadow-soft";
  return onPick ? (
    <button
      type="button"
      onClick={onPick}
      className={cn(frame, "press lift outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}
    >
      {content}
    </button>
  ) : (
    <div className={cn(frame, className)}>{content}</div>
  );
}
