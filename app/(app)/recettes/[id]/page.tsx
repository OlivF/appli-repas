import Link from "next/link";
import { Suspense } from "react";
import { Clock, Copy, CookingPot, Pencil } from "lucide-react";
import { cn } from "cn";
import { AppPage } from "@/components/app-page";
import { DietBadge, KidBadge } from "@/components/diet-badge";
import { FormSubmit } from "@/components/form-submit";
import { MEAL_TINT, MealPill } from "@/components/meal-label";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { BatchBadge } from "@/components/recipe-card";
import { RecipeChip, RecipeChipRow } from "@/components/recipe-chip";
import { RecipeCover } from "@/components/recipe-cover";
import { RecipeSteps } from "@/components/recipe-steps";
import { Loading } from "@/components/screen";
import { ServingsIngredients } from "@/components/servings-ingredients";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/recipes";
import { loadRecipe } from "@/lib/recipes-data";
import { copyRecipe } from "../actions";
import { BackToList } from "../back-to-list";
import { RecipeEaters } from "./recipe-eaters";
import { RecipeFavorite } from "./recipe-favorite";

export default function RecipePage({ params }: PageProps<"/recettes/[id]">) {
  return (
    <AppPage>
      <BackToList />
      <Suspense fallback={<Loading />}>
        <RecipeDetail params={params} />
      </Suspense>
    </AppPage>
  );
}

// « 30 min de préparation · 45 min de cuisson », « 10 min de préparation, sans cuisson ».
function timeLine(prep: number, cook: number) {
  if (prep === 0 && cook === 0) return null;
  const parts = [];
  if (prep > 0) parts.push(`${formatDuration(prep)} de préparation`);
  if (cook > 0) parts.push(`${formatDuration(cook)} de cuisson`);
  return cook === 0 ? `${parts[0]}, sans cuisson` : parts.join(" · ");
}

async function RecipeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { recipe, ingredients, members, isCatalog, favorite, excludedIds, partners } = await loadRecipe(id);
  const [mainMeal = "soir"] = recipe.meal_types;
  const time = timeLine(recipe.prep_minutes, recipe.cook_minutes);

  return (
    <article className="mt-2">
      <div className={cn("relative aspect-[16/9] overflow-hidden rounded-3xl lg:aspect-[4/1]", MEAL_TINT[mainMeal])}>
        <RecipeCover
          image={recipe.photo_url ? { src: recipe.photo_url, alt: "" } : undefined}
          mealType={mainMeal}
          sizes="(min-width: 1024px) 64rem, 100vw"
          priority
        />
      </div>

      <PageHeader
        className="mt-6"
        title={recipe.title}
        lead={recipe.description}
        action={<RecipeFavorite recipeId={recipe.id} favorite={favorite} />}
      />

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <ul className="flex flex-wrap gap-2">
          {recipe.meal_types.map((type) => (
            <li key={type}>
              <MealPill type={type} />
            </li>
          ))}
        </ul>
        {time && (
          <p className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock aria-hidden="true" className="size-4.5" />
            {time}
          </p>
        )}
      </div>

      {(recipe.diets.length > 0 || recipe.batch_friendly || recipe.kid_friendly) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {recipe.diets.map((diet) => (
            <DietBadge key={diet} diet={diet} />
          ))}
          {recipe.batch_friendly && <BatchBadge />}
          {recipe.kid_friendly && <KidBadge />}
        </div>
      )}

      {partners.length > 0 && (
        <RecipeChipRow id="partners-title" label="Se marie avec" className="mt-5">
          {partners.map((partner) => (
            <li key={partner.id}>
              <RecipeChip label={partner.title} keto={partner.diets.includes("keto")} href={`/recettes/${partner.id}`} />
            </li>
          ))}
        </RecipeChipRow>
      )}

      <div className="mt-6">
        {isCatalog ? (
          <form action={copyRecipe} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <input type="hidden" name="id" value={recipe.id} />
            <FormSubmit variant="secondary" pendingLabel="Copie…">
              <Copy aria-hidden="true" />
              Copier dans mes recettes
            </FormSubmit>
            <p className="max-w-[44ch] text-[0.9375rem] text-muted-foreground">
              Une recette du catalogue. Copie-la pour changer ses ingrédients ou ses étapes : ta version
              la remplacera dans ta liste.
            </p>
          </form>
        ) : (
          <Button asChild variant="secondary">
            <Link href={`/recettes/${recipe.id}/modifier`}>
              <Pencil aria-hidden="true" />
              Modifier la recette
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <div className="space-y-10">
          <section aria-labelledby="eaters-title">
            <SectionHeader id="eaters-title" title="À table" />
            <div className="mt-2">
              <RecipeEaters
                recipeId={recipe.id}
                recipeDiets={recipe.diets}
                members={members}
                excludedIds={excludedIds}
              />
            </div>
          </section>

          <section aria-labelledby="ingredients-title">
            <SectionHeader id="ingredients-title" title="Ingrédients" />
            <div className="mt-3">
              {ingredients.length > 0 ? (
                <ServingsIngredients
                  ingredients={ingredients}
                  servings={recipe.servings}
                  initialPersons={members.length}
                />
              ) : (
                <p className="text-muted-foreground">Pas encore d’ingrédient.</p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-10">
          <section aria-labelledby="steps-title">
            <SectionHeader id="steps-title" title="Étapes" />
            <div className="mt-4">
              {recipe.steps.length > 0 ? (
                <RecipeSteps steps={recipe.steps} />
              ) : (
                <p className="text-muted-foreground">Pas encore d’étape.</p>
              )}
            </div>
          </section>

          {recipe.batch_friendly && recipe.batch_notes && (
            <section aria-labelledby="batch-title">
              <Card className="gap-3 bg-muted p-6 shadow-none">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-sage-soft text-sage-deep">
                    <CookingPot aria-hidden="true" className="size-5" />
                  </span>
                  <h2 id="batch-title" className="text-[1.625rem] leading-tight">
                    Le dimanche
                  </h2>
                </div>
                <p className="max-w-[60ch]">{recipe.batch_notes}</p>
              </Card>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
