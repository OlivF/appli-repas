"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CakeSlice, CookingPot, Heart, Salad, UtensilsCrossed } from "lucide-react";
import { ChoiceChip } from "@/components/choice-chip";
import { EmptyState } from "@/components/empty-state";
import { ChoiceRow } from "@/components/field";
import { BookIllustration } from "@/components/illustrations";
import { RecipeCard } from "@/components/recipe-card";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { MEAL_TYPES } from "@/lib/meal-slots";
import { DIETS } from "@/lib/members";
import type { ListRecipe, RecipeMember } from "@/lib/recipes-data";
import {
  RECIPE_SORTS,
  filterRecipes,
  filtersFromSearchParams,
  filtersToSearchParams,
  memberEatability,
  type RecipeFilters,
} from "@/lib/recipes";
import { LIST_HREF_KEY } from "./back-to-list";

const NO_FILTERS: RecipeFilters = {
  query: "",
  mealTypes: [],
  diets: [],
  batch: false,
  favorites: false,
  basic: false,
  sorts: [],
};
const SORT_ICONS = { entree: <Salad />, fin: <CakeSlice /> };

function toggle<T>(list: T[], value: T, on: boolean) {
  return on ? [...list, value] : list.filter((item) => item !== value);
}

// Recherche instantanée et filtres en puces ; ils restent dans l'adresse, pour les retrouver
// en revenant d'une fiche.
export function RecipeBrowser({ recipes, members }: { recipes: ListRecipe[]; members: RecipeMember[] }) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromSearchParams(new URLSearchParams(searchParams.toString())));
  const visible = useMemo(() => filterRecipes(recipes, filters), [recipes, filters]);
  const filtered = filtersToSearchParams(filters).toString() !== "";

  useEffect(() => {
    const query = filtersToSearchParams(filters).toString();
    const href = query ? `/recettes?${query}` : "/recettes";
    window.history.replaceState(null, "", href);
    window.sessionStorage.setItem(LIST_HREF_KEY, href);
  }, [filters]);

  const update = (patch: Partial<RecipeFilters>) => setFilters((current) => ({ ...current, ...patch }));

  return (
    <>
      <SearchField
        id="recipe-search"
        label="Chercher une recette"
        placeholder="Une recette, un ingrédient…"
        value={filters.query}
        onValueChange={(query) => update({ query })}
        className="mt-6"
      />

      <div className="mt-4 space-y-1.5">
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
        <ChoiceRow legend="Régime">
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
        <ChoiceRow legend="Sorte">
          {RECIPE_SORTS.map((sort) => (
            <ChoiceChip
              key={sort.value}
              type="checkbox"
              checked={filters.sorts.includes(sort.value)}
              onChange={(event) => update({ sorts: toggle(filters.sorts, sort.value, event.target.checked) })}
              icon={SORT_ICONS[sort.value]}
            >
              {sort.label}
            </ChoiceChip>
          ))}
        </ChoiceRow>
        <ChoiceRow legend="Autres filtres">
          <ChoiceChip
            type="checkbox"
            checked={filters.batch}
            onChange={(event) => update({ batch: event.target.checked })}
            icon={<CookingPot />}
          >
            À l’avance
          </ChoiceChip>
          <ChoiceChip
            type="checkbox"
            checked={filters.favorites}
            onChange={(event) => update({ favorites: event.target.checked })}
            icon={<Heart />}
          >
            Favoris
          </ChoiceChip>
          <ChoiceChip
            type="checkbox"
            checked={filters.basic}
            onChange={(event) => update({ basic: event.target.checked })}
            icon={<UtensilsCrossed />}
          >
            Basiques
          </ChoiceChip>
        </ChoiceRow>
      </div>

      <div className="mt-4 flex min-h-11 items-center justify-between gap-4">
        <p role="status" className="font-semibold text-muted-foreground">
          {visible.length} {visible.length > 1 ? "recettes" : "recette"}
        </p>
        {filtered && (
          <Button variant="link" onClick={() => setFilters(NO_FILTERS)}>
            Effacer les filtres
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-4"
          illustration={<BookIllustration />}
          title="Aucune recette ne correspond"
          action={
            <Button block variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
              Effacer les filtres
            </Button>
          }
        >
          Essaie un autre mot, ou retire un filtre.
        </EmptyState>
      ) : (
        <ul className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((recipe) => (
            <li key={recipe.id}>
              <RecipeCard
                href={`/recettes/${recipe.id}`}
                title={recipe.title}
                mealTypes={recipe.meal_types}
                minutes={recipe.minutes}
                batch={recipe.batch_friendly}
                diets={recipe.diets}
                course={recipe.course}
                favorite={recipe.favorite}
                image={recipe.photo_url ? { src: recipe.photo_url, alt: "" } : undefined}
                members={members.map((member) => ({
                  ...member,
                  out: memberEatability(recipe, member, recipe.excludedIds) !== "ok",
                }))}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
