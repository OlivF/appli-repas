"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Autocomplete, type AutocompleteOption } from "@/components/autocomplete";
import { ChoiceChip } from "@/components/choice-chip";
import { ChoiceGroup, Field, FieldError } from "@/components/field";
import { FormSubmit } from "@/components/form-submit";
import { MemberToggle } from "@/components/member-toggle";
import { SectionHeader } from "@/components/page-header";
import { SwitchField } from "@/components/switch-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { suggestBase } from "@/lib/bases";
import { MEAL_TYPES, type MealType } from "@/lib/meal-slots";
import { DIETS, type Diet } from "@/lib/members";
import {
  AISLES,
  UNITS,
  aisleLabel,
  dietReason,
  incompatibleDiets,
  normalizeText,
  type GroceryAisle,
  type IngredientUnit,
} from "@/lib/recipes";
import type { KnownIngredient, RecipeIngredient, RecipeMember } from "@/lib/recipes-data";
import { saveRecipe } from "./actions";

export type FormRecipe = {
  id: string;
  title: string;
  description: string | null;
  photo_url: string | null;
  meal_types: MealType[];
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  diets: Diet[];
  steps: string[];
  batch_friendly: boolean;
  batch_notes: string | null;
  kid_friendly: boolean;
  base: string | null;
  basic: boolean;
};

type Row = { key: string; name: string; quantity: string; unit: IngredientUnit; aisle: GroceryAisle };

// « 1.5 » en base, « 1,5 » à l'écran.
function quantityText(quantity: number | null) {
  return quantity === null ? "" : String(quantity).replace(".", ",");
}

function toggle<T>(list: T[], value: T, on: boolean) {
  return on ? [...list, value] : list.filter((item) => item !== value);
}

// Le formulaire d'ajout et de modification, en une page. Tous les champs sont pilotés :
// après une erreur, rien de ce qui a été saisi ne se perd.
export function RecipeForm({
  recipe,
  ingredients,
  members,
  excludedIds,
  known,
  bases,
}: {
  recipe: FormRecipe | null;
  ingredients: RecipeIngredient[];
  members: RecipeMember[];
  excludedIds: string[];
  known: KnownIngredient[];
  // Les éléments principaux déjà connus (foyer et catalogue), pour l'autocomplétion.
  bases: string[];
}) {
  const [state, formAction, pending] = useActionState(saveRecipe, null);
  const errors = state?.errors ?? {};
  const id = useId();

  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [photoUrl, setPhotoUrl] = useState(recipe?.photo_url ?? "");
  const [mealTypes, setMealTypes] = useState<MealType[]>(recipe?.meal_types ?? []);
  const [servings, setServings] = useState(String(recipe?.servings ?? 4));
  const [prep, setPrep] = useState(recipe ? String(recipe.prep_minutes) : "");
  const [cook, setCook] = useState(recipe ? String(recipe.cook_minutes) : "");
  const [diets, setDiets] = useState<Diet[]>(recipe?.diets ?? []);
  const [batch, setBatch] = useState(recipe?.batch_friendly ?? false);
  const [batchNotes, setBatchNotes] = useState(recipe?.batch_notes ?? "");
  const [kid, setKid] = useState(recipe?.kid_friendly ?? false);
  const [basic, setBasic] = useState(recipe?.basic ?? false);
  const [base, setBase] = useState(recipe?.base ?? "");
  // Une nouvelle recette prend l'élément principal de ses ingrédients, tant qu'on n'y touche pas.
  const [baseTouched, setBaseTouched] = useState(recipe !== null);
  const [steps, setSteps] = useState((recipe?.steps ?? []).join("\n"));
  const [excluded, setExcluded] = useState(excludedIds);
  const [rows, setRows] = useState<Row[]>(() => {
    const initial = ingredients.map((ingredient, index) => ({
      key: `initial-${index}`,
      name: ingredient.name,
      quantity: quantityText(ingredient.quantity),
      unit: ingredient.unit ?? "g",
      aisle: ingredient.aisle,
    }));
    return initial.length > 0 ? initial : [{ key: "initial-0", name: "", quantity: "", unit: "g", aisle: "autre" }];
  });
  // La ligne à focaliser après un ajout au clavier ou au bouton.
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const options = useMemo<AutocompleteOption[]>(
    () => known.map((ingredient) => ({ value: ingredient.name, hint: aisleLabel(ingredient.aisle) })),
    [known],
  );
  const baseOptions = useMemo<AutocompleteOption[]>(() => bases.map((value) => ({ value })), [bases]);
  const suggestedBase = useMemo(() => suggestBase(rows, bases) ?? "", [rows, bases]);
  const shownBase = baseTouched ? base : suggestedBase;
  const knownByName = useMemo(
    () => new Map(known.map((ingredient) => [normalizeText(ingredient.name), ingredient])),
    [known],
  );

  useEffect(() => {
    if (focusKey) document.getElementById(`${id}-name-${focusKey}`)?.focus();
  }, [focusKey, id]);

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function addRow() {
    const key = crypto.randomUUID();
    setRows((current) => [...current, { key, name: "", quantity: "", unit: "g", aisle: "autre" }]);
    setFocusKey(key);
  }

  function removeRow(key: string) {
    setRows((current) => {
      const rest = current.filter((row) => row.key !== key);
      return rest.length > 0 ? rest : [{ key: crypto.randomUUID(), name: "", quantity: "", unit: "g", aisle: "autre" }];
    });
  }

  // Entrée dans une ligne d'ingrédient : passer à la suivante (ou en créer une), sans envoyer.
  function nextRowOnEnter(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "Enter" || event.defaultPrevented) return;
    event.preventDefault();
    const next = rows[index + 1];
    if (next) setFocusKey(next.key);
    else addRow();
  }

  return (
    <form
      action={formAction}
      // Envoi à la main : un <form action> se vide après l'envoi, et l'interrupteur radix
      // reviendrait alors à sa valeur de départ après une erreur de saisie.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="mt-8 space-y-6"
      noValidate
    >
      {recipe && <input type="hidden" name="id" value={recipe.id} />}

      <Card className="gap-6 p-5 sm:p-6">
        <SectionHeader title="L’essentiel" />
        <Field id={`${id}-title`} label="Titre" error={errors.title}>
          {({ describedBy, invalid }) => (
            <Input
              id={`${id}-title`}
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Gratin de courgettes"
              autoComplete="off"
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
        <Field
          id={`${id}-base`}
          label="Élément principal"
          help="Deux recettes avec le même élément principal se cuisinent ensemble."
          error={errors.base}
        >
          {({ describedBy, invalid }) => (
            <Autocomplete
              id={`${id}-base`}
              name="base"
              value={shownBase}
              options={baseOptions}
              placeholder="Steak haché"
              onValueChange={(value) => {
                setBaseTouched(true);
                setBase(value);
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
        <Field
          id={`${id}-description`}
          label="En une phrase"
          help="Facultatif : ce qui donne envie."
          error={errors.description}
        >
          {({ describedBy, invalid }) => (
            <Input
              id={`${id}-description`}
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Fondant, gratiné, prêt en 30 minutes."
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
        <Field
          id={`${id}-photo`}
          label="Photo"
          help="Facultatif : l’adresse d’une image en ligne, qui commence par https://."
          error={errors.photo_url}
        >
          {({ describedBy, invalid }) => (
            <Input
              id={`${id}-photo`}
              name="photo_url"
              type="url"
              inputMode="url"
              value={photoUrl}
              onChange={(event) => setPhotoUrl(event.target.value)}
              placeholder="https://"
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      </Card>

      <Card className="gap-6 p-5 sm:p-6">
        <SectionHeader title="Quand et pour combien" />
        <div className="space-y-2">
          <ChoiceGroup legend="Pour quels repas ?">
            {MEAL_TYPES.map((meal) => (
              <ChoiceChip
                key={meal.value}
                type="checkbox"
                name="meal_types"
                value={meal.value}
                checked={mealTypes.includes(meal.value)}
                onChange={(event) => setMealTypes(toggle(mealTypes, meal.value, event.target.checked))}
                icon={<span className="text-[1.1em] leading-none">{meal.emoji}</span>}
              >
                {meal.label}
              </ChoiceChip>
            ))}
          </ChoiceGroup>
          {errors.meal_types && <FieldError>{errors.meal_types}</FieldError>}
        </div>
        <Field
          id={`${id}-servings`}
          label="Pour combien de personnes ?"
          help="Les quantités que tu saisis sont pour ce nombre de personnes."
          error={errors.servings}
        >
          {({ describedBy, invalid }) => (
            <div className="flex items-center gap-3">
              <Input
                id={`${id}-servings`}
                name="servings"
                inputMode="numeric"
                value={servings}
                onChange={(event) => setServings(event.target.value)}
                className="w-24 text-center"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
              <span className="font-semibold text-muted-foreground">personnes</span>
            </div>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              ["prep_minutes", "Préparation", prep, setPrep, errors.prep_minutes],
              ["cook_minutes", "Cuisson", cook, setCook, errors.cook_minutes],
            ] as const
          ).map(([name, label, value, setValue, error]) => (
            <Field key={name} id={`${id}-${name}`} label={label} error={error}>
              {({ describedBy, invalid }) => (
                <div className="flex items-center gap-3">
                  <Input
                    id={`${id}-${name}`}
                    name={name}
                    inputMode="numeric"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="0"
                    className="w-20 text-center"
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                  />
                  <span className="font-semibold text-muted-foreground">min</span>
                </div>
              )}
            </Field>
          ))}
        </div>
      </Card>

      <Card className="gap-6 p-5 sm:p-6">
        <SectionHeader title="Régimes et préparation" />
        <ChoiceGroup legend="Régimes compatibles">
          {DIETS.map((diet) => (
            <ChoiceChip
              key={diet.value}
              type="checkbox"
              name="diets"
              value={diet.value}
              checked={diets.includes(diet.value)}
              onChange={(event) => setDiets(toggle(diets, diet.value, event.target.checked))}
            >
              {diet.label}
            </ChoiceChip>
          ))}
        </ChoiceGroup>
        <SwitchField
          id={`${id}-batch`}
          name="batch_friendly"
          label="Se prépare à l’avance"
          description="Pour le batch cooking du dimanche."
          checked={batch}
          onCheckedChange={setBatch}
        />
        {batch && (
          <Field
            id={`${id}-batch-notes`}
            label="Ce qu’on fait le dimanche"
            help="Ce qui se prépare d’avance, et combien de temps ça se garde."
            error={errors.batch_notes}
          >
            {({ describedBy, invalid }) => (
              <Textarea
                id={`${id}-batch-notes`}
                name="batch_notes"
                value={batchNotes}
                onChange={(event) => setBatchNotes(event.target.value)}
                className="min-h-24"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
        )}
        <SwitchField
          id={`${id}-kid`}
          name="kid_friendly"
          label="Plaît aux enfants"
          checked={kid}
          onCheckedChange={setKid}
        />
        <SwitchField
          id={`${id}-basic`}
          name="basic"
          label="Recette basique"
          description="Elle apparaît dans « Les basiques » de la semaine."
          checked={basic}
          onCheckedChange={setBasic}
        />
      </Card>

      <Card className="gap-4 p-5 sm:p-6">
        <SectionHeader title="Ingrédients" />
        <p className="-mt-2 text-[0.9375rem] text-muted-foreground">
          Commence à taper : les ingrédients déjà connus arrivent avec leur rayon.
        </p>
        <ul className="space-y-3">
          {rows.map((row, index) => {
            const position = index + 1;
            return (
              <li
                key={row.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-2xl border border-border/70 bg-background p-2.5"
              >
                <Autocomplete
                  id={`${id}-name-${row.key}`}
                  name="ingredient_name"
                  aria-label={`Ingrédient ${position}`}
                  value={row.name}
                  options={options}
                  placeholder="Courgettes"
                  onValueChange={(name) => {
                    const match = knownByName.get(normalizeText(name));
                    updateRow(row.key, { name, ...(match && row.aisle === "autre" ? { aisle: match.aisle } : {}) });
                  }}
                  onPick={(option) => {
                    const match = knownByName.get(normalizeText(option.value));
                    if (match) updateRow(row.key, { aisle: match.aisle, ...(match.unit ? { unit: match.unit } : {}) });
                  }}
                  onKeyDown={(event) => nextRowOnEnter(event, index)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Retirer l’ingrédient ${position}`}
                  onClick={() => removeRow(row.key)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
                <div className="col-span-2 grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.3fr)] gap-2 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1.3fr)]">
                  <Input
                    name="ingredient_quantity"
                    aria-label={`Quantité de l’ingrédient ${position}`}
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                    onKeyDown={(event) => nextRowOnEnter(event, index)}
                    placeholder="250"
                    className="px-3 text-center"
                  />
                  <NativeSelect
                    name="ingredient_unit"
                    aria-label={`Unité de l’ingrédient ${position}`}
                    value={row.unit}
                    onChange={(event) => updateRow(row.key, { unit: event.target.value as IngredientUnit })}
                  >
                    {UNITS.map((unit) => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    name="ingredient_aisle"
                    aria-label={`Rayon de l’ingrédient ${position}`}
                    value={row.aisle}
                    onChange={(event) => updateRow(row.key, { aisle: event.target.value as GroceryAisle })}
                  >
                    {AISLES.map((aisle) => (
                      <option key={aisle.value} value={aisle.value}>
                        {aisle.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </li>
            );
          })}
        </ul>
        {errors.ingredients && <FieldError>{errors.ingredients}</FieldError>}
        <Button type="button" variant="secondary" className="self-start" onClick={addRow}>
          <Plus aria-hidden="true" />
          Ajouter un ingrédient
        </Button>
      </Card>

      <Card className="gap-4 p-5 sm:p-6">
        <SectionHeader id={`${id}-steps-title`} title="Étapes" />
        <p id={`${id}-steps-help`} className="-mt-2 text-[0.9375rem] text-muted-foreground">
          Une étape par ligne : on les numérote pour toi.
        </p>
        <Textarea
          name="steps"
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
          placeholder={"Fais revenir l’oignon dans l’huile.\nAjoute la viande et laisse dorer."}
          className="min-h-40"
          aria-labelledby={`${id}-steps-title`}
          aria-describedby={`${id}-steps-help`}
        />
      </Card>

      <Card className="gap-3 p-5 sm:p-6">
        <SectionHeader title="Qui n’en mange pas ?" />
        <p className="-mt-1 text-[0.9375rem] text-muted-foreground">
          Touche un prénom pour le barrer. Ceux que leur régime écarte sont barrés d’office.
        </p>
        <div className="flex flex-wrap">
          {members.map((member) => {
            const blocked = incompatibleDiets(diets, member.diets);
            return (
              <MemberToggle
                key={member.id}
                member={member}
                name="excluded"
                pressed={blocked.length > 0 || excluded.includes(member.id)}
                disabled={blocked.length > 0}
                reason={blocked.length > 0 ? dietReason(blocked) : undefined}
                onPressedChange={(pressed) => setExcluded(toggle(excluded, member.id, pressed))}
              />
            );
          })}
        </div>
      </Card>

      <div className="space-y-3">
        {state && (
          <FieldError alert>{errors.form ?? "Il manque quelque chose : regarde les messages en rouge."}</FieldError>
        )}
        <FormSubmit block size="lg" pending={pending} pendingLabel="Enregistrement…">
          Enregistrer la recette
        </FormSubmit>
        <Button asChild block variant="ghost">
          <Link href={recipe ? `/recettes/${recipe.id}` : "/recettes"}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
