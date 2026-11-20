"use client";

import { useId, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ChoiceChip } from "@/components/choice-chip";
import { EatersPicker } from "@/components/eaters-picker";
import { ExtraTile } from "@/components/extra-tile";
import { ChoiceRow, FieldError } from "@/components/field";
import { RecipeChip } from "@/components/recipe-chip";
import { SearchField } from "@/components/search-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Unserved } from "@/lib/board";
import type { FridgeHint } from "@/lib/fridge";
import type { MealType } from "@/lib/meal-slots";
import { DIETS, type Diet } from "@/lib/members";
import { canEat } from "@/lib/planner";
import { guessCourse, guessDiets, matchKnown, type QuickRecipeInput } from "@/lib/quick-recipe";
import { UNITS, courseOf, isLightCourse, matchesSearch, type Course, type IngredientUnit } from "@/lib/recipes";
import type { KnownIngredient, RecipeMember } from "@/lib/recipes-data";
import type { WeekRecipe } from "@/lib/week-data";

// Le panneau « Dessert, fruit, fromage… » d'un repas : pour qui, quoi (plusieurs à la fois),
// ce repas ou tous ceux de ce type dans la semaine. Ensuite, pour un présent coché qui n'a rien
// eu de compatible (céto…), une ligne « Et pour Marie-Laure ? ». La recherche qui ne trouve rien
// propose de créer la recette.

export type ExtrasScope = "meal" | "week";
export type AddExtrasResult = { unserved: Unserved[] } | { error: string };

// L'ordre des sortes dans le panneau : la fin du repas, puis l'entrée.
export const ADD_COURSES: Course[] = ["dairy", "fruit", "cheese", "dessert", "starter"];

const MEAL_WORDS: Record<MealType, { noun: string; one: string; many: string }> = {
  petit_dej: { noun: "le petit-déj", one: "petit-déj", many: "petits-déj" },
  midi: { noun: "le midi", one: "midi", many: "midis" },
  pique_nique: { noun: "le pique-nique", one: "pique-nique", many: "pique-niques" },
  soir: { noun: "le dîner", one: "dîner", many: "dîners" },
};

// « 7 dîners », « 1 midi ».
export function mealCount(mealType: MealType, count: number) {
  return `${count} ${count > 1 ? MEAL_WORDS[mealType].many : MEAL_WORDS[mealType].one}`;
}

const HINT_RANK: Record<FridgeHint, number> = { soon: 0, fridge: 1 };
// « Et pour Marie-Laure ? » : quelques puces, pas tout le catalogue.
const MAX_SUGGESTIONS = 8;
const PER_OTHER_COURSE = 3;

// Ce qui est au frigo d'abord (à finir avant tout), puis les favoris, puis par titre.
function byPreference(hints: Record<string, FridgeHint>) {
  return (a: WeekRecipe, b: WeekRecipe) =>
    (HINT_RANK[hints[a.id]] ?? 2) - (HINT_RANK[hints[b.id]] ?? 2) ||
    Number(b.favorite) - Number(a.favorite) ||
    a.title.localeCompare(b.title, "fr");
}

// Ce qui lui va : la même sorte que ce qu'on vient d'ajouter d'abord, puis le reste de la fin du
// repas sorte par sorte (laitage, fruit, fromage, dessert ; quelques-uns de chaque). Une entrée
// seulement si on vient d'en ajouter une.
function suggestionsFor(fits: WeekRecipe[], courses: readonly Course[], hints: Record<string, FridgeHint>) {
  const rank = byPreference(hints);
  const same = fits.filter((recipe) => courses.includes(recipe.course)).sort(rank);
  const others = ADD_COURSES.filter((course) => course !== "starter" && !courses.includes(course)).flatMap((course) =>
    fits
      .filter((recipe) => recipe.course === course)
      .sort(rank)
      .slice(0, PER_OTHER_COURSE),
  );
  return [...same, ...others].slice(0, MAX_SUGGESTIONS);
}

type Draft = { title: string; course: Course; quantity: string; unit: IngredientUnit; diets: Diet[] };

export function ExtrasPanel({
  mealType,
  dayLabel,
  present,
  recipes,
  already,
  weekMeals,
  fridgeHints,
  known,
  course: initialCourse,
  onCourseChange,
  onAdd,
  onCreate,
  onClose,
}: {
  mealType: MealType;
  // « lundi ».
  dayLabel: string;
  // Les présents du repas, dans l'ordre du foyer.
  present: RecipeMember[];
  // Entrées, desserts, fruits, fromages, laitages (foyer + catalogue).
  recipes: WeekRecipe[];
  // Les recettes déjà au repas.
  already: readonly string[];
  // Le nombre de repas que vise « Tous les … de la semaine ».
  weekMeals: number;
  fridgeHints: Record<string, FridgeHint>;
  known: readonly KnownIngredient[];
  // La sorte ouverte d'abord (la dernière utilisée).
  course: Course;
  onCourseChange: (course: Course) => void;
  onAdd: (scope: ExtrasScope, recipeIds: string[], memberIds: string[]) => Promise<AddExtrasResult>;
  onCreate: (input: QuickRecipeInput) => Promise<{ recipe: WeekRecipe } | { error: string }>;
  onClose: () => void;
}) {
  const id = useId();
  const words = MEAL_WORDS[mealType];
  const [course, setCourse] = useState(initialCourse);
  const [eaters, setEaters] = useState(() => present.map((member) => member.id));
  const [selected, setSelected] = useState<string[]>([]);
  const [scope, setScope] = useState<ExtrasScope>("meal");
  const [query, setQuery] = useState("");
  const [created, setCreated] = useState<WeekRecipe[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Après « Ajouter » : les présents restés sans rien, et ce qu'on venait de choisir.
  const [waiting, setWaiting] = useState<{ members: RecipeMember[]; courses: Course[]; scope: ExtrasScope } | null>(null);

  const all = useMemo(
    () => [...created.filter((recipe) => !recipes.some((other) => other.id === recipe.id)), ...recipes],
    [recipes, created],
  );
  const ofMeal = useMemo(() => all.filter((recipe) => recipe.meal_types.includes(mealType)), [all, mealType]);
  const searching = query.trim() !== "";
  const shown = useMemo(() => {
    const list = searching
      ? ofMeal.filter((recipe) => matchesSearch(recipe, query))
      : ofMeal.filter((recipe) => recipe.course === course);
    return list.sort(
      (a, b) => ADD_COURSES.indexOf(a.course) - ADD_COURSES.indexOf(b.course) || byPreference(fridgeHints)(a, b),
    );
  }, [ofMeal, searching, query, course, fridgeHints]);

  const chooseCourse = (value: Course) => {
    setCourse(value);
    onCourseChange(value);
  };

  async function add(nextScope: ExtrasScope, recipeIds: string[], memberIds: string[]) {
    setPending(true);
    setError(null);
    const result = await onAdd(nextScope, recipeIds, memberIds);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return null;
    }
    return new Set(result.unserved.flatMap((meal) => meal.member_ids));
  }

  async function submit() {
    const left = await add(scope, selected, eaters);
    if (!left) return;
    const members = present.filter((member) => left.has(member.id));
    if (members.length === 0) {
      onClose();
      return;
    }
    const courses = [...new Set(all.filter((recipe) => selected.includes(recipe.id)).map((recipe) => recipe.course))];
    setWaiting({ members, courses, scope });
  }

  function done(memberId: string) {
    const members = waiting?.members.filter((member) => member.id !== memberId) ?? [];
    if (members.length === 0) onClose();
    else setWaiting((current) => current && { ...current, members });
  }

  // ─── Créer à la volée ─────────────────────────────────────────────────────
  function startDraft() {
    const raw = query.trim();
    const title = raw.charAt(0).toLocaleUpperCase("fr") + raw.slice(1);
    const draftCourse = guessCourse(matchKnown(title, known)?.aisle) ?? course;
    setDraft({ title, course: draftCourse, quantity: "1", unit: "piece", diets: guessFor(draftCourse, title) });
  }

  function guessFor(draftCourse: Course, title: string) {
    return guessDiets(draftCourse, matchKnown(title, known)?.name ?? title, recipes);
  }

  async function create() {
    if (!draft) return;
    const match = matchKnown(draft.title, known);
    const input: QuickRecipeInput = isLightCourse(draft.course)
      ? {
          title: draft.title,
          course: draft.course,
          quantity: draft.quantity,
          unit: draft.unit,
          ingredient: match?.name ?? draft.title,
          aisle: match?.aisle,
          diets: draft.diets,
        }
      : { title: draft.title, course: draft.course, diets: draft.diets };
    setPending(true);
    setError(null);
    const result = await onCreate(input);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setCreated((current) => [result.recipe, ...current]);
    setSelected((current) => [...current, result.recipe.id]);
    setDraft(null);
    setQuery("");
    chooseCourse(result.recipe.course);
  }

  const mealOfDay = `${words.noun} de ${dayLabel}`;
  const header = (
    <SheetHeader>
      <SheetTitle>Pour finir {mealOfDay}</SheetTitle>
      <SheetDescription>Coche ce qu’on mange, pour qui, puis ajoute.</SheetDescription>
    </SheetHeader>
  );

  // ─── « Et pour Marie-Laure ? » ────────────────────────────────────────────
  if (waiting) {
    return (
      <>
        {header}
        <p className="font-semibold">C’est ajouté.</p>
        <div className="mt-4 space-y-5">
          {waiting.members.map((member) => {
            const suggestions = suggestionsFor(
              ofMeal.filter((recipe) => canEat(recipe, member) && !selected.includes(recipe.id)),
              waiting.courses,
              fridgeHints,
            );
            return (
              <ExtraSuggestions
                key={member.id}
                name={member.first_name}
                suggestions={suggestions}
                disabled={pending}
                onPick={async (recipe) => {
                  if (await add(waiting.scope, [recipe.id], [member.id])) done(member.id);
                }}
                onSkip={() => done(member.id)}
              />
            );
          })}
        </div>
        {error && (
          <div className="mt-3">
            <FieldError alert>{error}</FieldError>
          </div>
        )}
      </>
    );
  }

  const fresh = selected.filter((recipeId) => !already.includes(recipeId));
  const label =
    scope === "week" ? `Ajouter à ${mealCount(mealType, weekMeals)}` : fresh.length > 0 ? `Ajouter ${fresh.length}` : "Ajouter";

  return (
    <>
      {header}
      <EatersPicker members={present} selected={eaters} onChange={setEaters} />

      <div className="mt-5 space-y-3">
        <ChoiceRow legend="Sorte">
          {ADD_COURSES.map((value) => {
            const { label: courseLabel, icon: Icon } = courseOf(value);
            return (
              <ChoiceChip
                key={value}
                type="radio"
                name={`${id}-course`}
                checked={!searching && course === value}
                onChange={() => {
                  setQuery("");
                  chooseCourse(value);
                }}
                icon={<Icon />}
              >
                {courseLabel}
              </ChoiceChip>
            );
          })}
        </ChoiceRow>
        <SearchField
          id={`${id}-search`}
          label="Chercher un dessert, un fruit…"
          placeholder="Un dessert, un fruit, un fromage…"
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setDraft(null);
          }}
        />
      </div>

      <ul aria-label="Recettes" className="mt-4 grid grid-cols-2 gap-2">
        {shown.map((recipe) => (
          <li key={recipe.id}>
            <ExtraTile
              recipe={recipe}
              checked={selected.includes(recipe.id)}
              already={already.includes(recipe.id)}
              hint={fridgeHints[recipe.id]}
              onChange={(on) =>
                setSelected((current) => (on ? [...current, recipe.id] : current.filter((item) => item !== recipe.id)))
              }
            />
          </li>
        ))}
        {searching && shown.length === 0 && !draft && (
          <li className="col-span-2">
            <button
              type="button"
              onClick={startDraft}
              className="press flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/50 p-3 text-left font-semibold text-muted-foreground outline-none hover:border-input/60 hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Plus aria-hidden="true" className="size-5 shrink-0" />
              Créer « {query.trim().charAt(0).toLocaleUpperCase("fr") + query.trim().slice(1)} »
            </button>
          </li>
        )}
      </ul>

      {draft && (
        <fieldset className="mt-3 space-y-4 rounded-2xl bg-muted/70 px-4 py-3">
          <legend className="sr-only">Créer « {draft.title} »</legend>
          <p aria-hidden="true" className="font-semibold">
            Créer « {draft.title} »
          </p>
          <ChoiceRow legend="C’est…">
            {ADD_COURSES.map((value) => (
              <ChoiceChip
                key={value}
                type="radio"
                name={`${id}-draft-course`}
                checked={draft.course === value}
                onChange={() => setDraft({ ...draft, course: value, diets: guessFor(value, draft.title) })}
              >
                {courseOf(value).label}
              </ChoiceChip>
            ))}
          </ChoiceRow>
          {isLightCourse(draft.course) && (
            <div className="space-y-2">
              <label htmlFor={`${id}-quantity`} className="block font-semibold">
                Une portion, c’est
              </label>
              <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                <Input
                  id={`${id}-quantity`}
                  inputMode="decimal"
                  value={draft.quantity}
                  onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
                  className="text-center"
                />
                <NativeSelect
                  aria-label="Unité"
                  value={draft.unit}
                  onChange={(event) => setDraft({ ...draft, unit: event.target.value as IngredientUnit })}
                >
                  {UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          )}
          <ChoiceRow legend="Régimes">
            {DIETS.map((diet) => (
              <ChoiceChip
                key={diet.value}
                type="checkbox"
                checked={draft.diets.includes(diet.value)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    diets: event.target.checked ? [...draft.diets, diet.value] : draft.diets.filter((item) => item !== diet.value),
                  })
                }
              >
                {diet.label}
              </ChoiceChip>
            ))}
          </ChoiceRow>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={create} disabled={pending}>
              Créer
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              Annuler
            </Button>
          </div>
        </fieldset>
      )}

      {/* Toujours sous le pouce, même au bas d'une longue liste. */}
      <div className="sticky -bottom-6 z-10 -mx-5 mt-4 border-t border-border/70 bg-card px-5 pt-3 pb-6">
        <fieldset>
          <legend className="sr-only">Où l’ajouter ?</legend>
          <div className="flex flex-wrap gap-2">
            <ChoiceChip type="radio" name={`${id}-scope`} checked={scope === "meal"} onChange={() => setScope("meal")}>
              Ce repas
            </ChoiceChip>
            <ChoiceChip type="radio" name={`${id}-scope`} checked={scope === "week"} onChange={() => setScope("week")}>
              Tous les {words.many} de la semaine
            </ChoiceChip>
          </div>
        </fieldset>
        {error && (
          <div className="mt-3">
            <FieldError alert>{error}</FieldError>
          </div>
        )}
        <Button
          block
          size="lg"
          className="mt-3"
          disabled={pending || fresh.length === 0 || eaters.length === 0 || (scope === "week" && weekMeals === 0)}
          onClick={submit}
        >
          {label}
        </Button>
      </div>
    </>
  );
}

// « Et pour Marie-Laure ? » : les plats légers qui lui vont, en puces ; une touche l'ajoute pour
// elle seule, « Rien pour Marie-Laure » passe.
export function ExtraSuggestions({
  name,
  suggestions,
  disabled = false,
  onPick,
  onSkip,
}: {
  name: string;
  suggestions: readonly { id: string; title: string; diets: readonly Diet[] }[];
  disabled?: boolean;
  onPick: (recipe: { id: string; title: string }) => void;
  onSkip: () => void;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <h3 id={id} className="text-xl">
        Et pour {name} ?
      </h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {suggestions.map((recipe) => (
          <li key={recipe.id}>
            <RecipeChip
              label={recipe.title}
              keto={recipe.diets.includes("keto")}
              onClick={disabled ? undefined : () => onPick(recipe)}
            />
          </li>
        ))}
        <li>
          <Button variant="ghost" className="min-h-12" onClick={onSkip}>
            Rien pour {name}
          </Button>
        </li>
      </ul>
    </div>
  );
}
