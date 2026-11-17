import type { Metadata } from "next";
import { Suspense } from "react";
import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
import { Loading } from "@/components/screen";
import { loadRecipeForm } from "@/lib/recipes-data";
import { BackToList } from "../../back-to-list";
import { DeleteRecipe } from "../../delete-recipe";
import { RecipeForm } from "../../recipe-form";

export const metadata: Metadata = { title: "Modifier la recette · Nos repas" };

export default function EditRecipePage({ params }: PageProps<"/recettes/[id]/modifier">) {
  return (
    <AppPage narrow>
      <BackToList />
      <Suspense fallback={<Loading />}>
        <EditRecipeForm params={params} />
      </Suspense>
    </AppPage>
  );
}

async function EditRecipeForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { recipe, ingredients, members, excludedIds, known } = await loadRecipeForm(id);
  // Le chargeur renvoie vers la fiche une recette du catalogue : ici, elle est au foyer.
  if (!recipe) return null;
  const fromCatalog = recipe.source_recipe_id !== null;

  return (
    <>
      <PageHeader
        className="mt-2"
        title="Modifier la recette"
        lead={fromCatalog ? "Ta version de la recette du catalogue : change ce que tu veux." : undefined}
      />
      <RecipeForm
        recipe={recipe}
        ingredients={ingredients}
        members={members}
        excludedIds={excludedIds}
        known={known}
      />
      <div className="mt-10 border-t border-border pt-6">
        <DeleteRecipe recipeId={recipe.id} fromCatalog={fromCatalog} />
      </div>
    </>
  );
}
