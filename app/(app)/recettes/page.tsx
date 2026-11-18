import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
import { Loading } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { loadRecipeList } from "@/lib/recipes-data";
import { RecipeBrowser } from "./recipe-browser";

export const metadata: Metadata = { title: "Recettes" };

export default function RecipesPage() {
  return (
    <AppPage>
      <PageHeader
        title="Recettes"
        lead="Les tiennes et celles du catalogue, à piocher pour la semaine."
        action={
          <Button asChild>
            <Link href="/recettes/nouvelle">
              <Plus aria-hidden="true" />
              Ajouter
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<Loading />}>
        <RecipeList />
      </Suspense>
    </AppPage>
  );
}

async function RecipeList() {
  const { recipes, members } = await loadRecipeList();
  return <RecipeBrowser recipes={recipes} members={members} />;
}
