import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import { AppPage } from "@/components/app-page";
import { EmptyState } from "@/components/empty-state";
import { BasketIllustration } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";
import { Loading } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { WeekPicker } from "@/components/week-picker";
import { loadShopping } from "@/lib/shopping-data";
import { addDays } from "@/lib/week";
import { ShoppingBoard } from "./shopping-board";

export const metadata: Metadata = { title: "Courses" };

export default function CoursesPage({ searchParams }: PageProps<"/courses">) {
  return (
    <AppPage narrow>
      <PageHeader title="Courses" />
      <Suspense fallback={<Loading />}>
        <Courses searchParams={searchParams} />
      </Suspense>
    </AppPage>
  );
}

async function Courses({ searchParams }: Pick<PageProps<"/courses">, "searchParams">) {
  // La date du jour et la liste changent d'une requête à l'autre : rien n'est pré-rendu.
  await connection();
  const { semaine } = await searchParams;
  const shopping = await loadShopping(typeof semaine === "string" ? semaine : undefined);
  const { weekStart } = shopping;

  return (
    <>
      <div className="mt-6">
        <WeekPicker
          label={shopping.label}
          relation={shopping.relation}
          prevHref={`/courses?semaine=${addDays(weekStart, -7)}`}
          nextHref={`/courses?semaine=${addDays(weekStart, 7)}`}
        />
      </div>

      {shopping.listId ? (
        <ShoppingBoard
          // Une autre semaine, ou une liste changée ailleurs (l'autre téléphone), repart d'un état neuf.
          key={`${weekStart}:${shopping.outdated}:${shopping.storedAt}:${JSON.stringify(shopping.items)}`}
          today={shopping.today}
          weekStart={weekStart}
          label={shopping.label}
          listId={shopping.listId}
          outdated={shopping.outdated}
          initialItems={shopping.items}
          known={shopping.known}
          ingredients={shopping.ingredients}
          fridgeDates={shopping.fridgeDates}
          storedAt={shopping.storedAt}
          settledAt={shopping.settledAt}
        />
      ) : (
        <EmptyState
          className="mt-8"
          illustration={<BasketIllustration />}
          title="Pas encore de menu pour cette semaine"
          action={
            <Button asChild block>
              <Link href={`/semaine?semaine=${weekStart}`}>
                <CalendarDays aria-hidden="true" />
                Préparer le menu
              </Link>
            </Button>
          }
        >
          La liste se remplit toute seule avec le menu, rayon par rayon.
        </EmptyState>
      )}
    </>
  );
}
