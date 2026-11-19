import type { Metadata } from "next";
import { Suspense } from "react";
import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
import { Loading } from "@/components/screen";
import { loadRecipeForm } from "@/lib/recipes-data";
import { BackToList } from "../back-to-list";
import { RecipeForm } from "../recipe-form";

export const metadata: Metadata = { title: "Nouvelle recette" };

export default function NewRecipePage() {
  return (
    <AppPage narrow>
      <BackToList />
      <PageHeader className="mt-2" title="Nouvelle recette" lead="Un plat de la famille, à glisser dans la semaine." />
      <Suspense fallback={<Loading />}>
        <NewRecipeForm />
      </Suspense>
    </AppPage>
  );
}

async function NewRecipeForm() {
  const { members, known, bases } = await loadRecipeForm();
  return <RecipeForm recipe={null} ingredients={[]} members={members} excludedIds={[]} known={known} bases={bases} />;
}
