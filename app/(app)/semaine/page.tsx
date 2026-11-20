import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppPage } from "@/components/app-page";
import { FridgeStrip } from "@/components/fridge-strip";
import { Loading } from "@/components/screen";
import { extraFridgeHints } from "@/lib/fridge";
import { fridgeItems, fridgeUrgentLabels } from "@/lib/fridge-data";
import { settleFinishedWeeks } from "@/lib/fridge-settlement";
import { urgentStripText } from "@/lib/shopping-items";
import { addDays, dayLabel, parseWeekParam, todayInParis, weekLabel, weekRelation } from "@/lib/week";
import { knownIngredients } from "@/lib/recipes-data";
import { loadWeek } from "@/lib/week-data";
import { WeekBoard } from "./week-board";

export const metadata: Metadata = { title: "La semaine" };

export default function WeekPage({ searchParams }: PageProps<"/semaine">) {
  return (
    <AppPage wide>
      <Suspense fallback={<Loading />}>
        <Week searchParams={searchParams} />
      </Suspense>
    </AppPage>
  );
}

async function Week({ searchParams }: Pick<PageProps<"/semaine">, "searchParams">) {
  // La date du jour change d'une requête à l'autre : rien n'est pré-rendu.
  await connection();
  const { semaine } = await searchParams;
  const today = todayInParis();
  const weekStart = parseWeekParam(typeof semaine === "string" ? semaine : undefined, today);
  const { supabase, household, members, slots, recipes, extraRecipes, cards } = await loadWeek(weekStart);
  const relation = weekRelation(weekStart, today);
  const todayDay = relation === "current" ? ([0, 1, 2, 3, 4, 5, 6].find((day) => addDays(weekStart, day) === today) ?? null) : null;
  // Le bilan des semaines finies d'abord (silencieux), puis ce qu'il faut finir vite.
  await settleFinishedWeeks(supabase, household.id, today);
  const strip = urgentStripText(await fridgeUrgentLabels());
  // Le panneau « Dessert, fruit… » signale ce qu'on a déjà à la maison.
  const [items, known] = await Promise.all([fridgeItems(supabase, household.id), knownIngredients(supabase)]);
  const fridgeHints = extraFridgeHints({ recipes: extraRecipes, items, today });

  return (
    <>
      {strip && (
        <div className="mb-5">
          <FridgeStrip text={strip} />
        </div>
      )}
      <WeekBoard
        // Une autre semaine repart d'un état neuf.
        key={weekStart}
        weekStart={weekStart}
        label={weekLabel(weekStart)}
        relation={relation}
        prevHref={`/semaine?semaine=${addDays(weekStart, -7)}`}
        nextHref={`/semaine?semaine=${addDays(weekStart, 7)}`}
        days={[0, 1, 2, 3, 4, 5, 6].map((day) => dayLabel(weekStart, day))}
        firstDay={todayDay ?? 0}
        todayDay={todayDay}
        members={members}
        slots={slots}
        recipes={recipes}
        extraRecipes={extraRecipes}
        fridgeHints={fridgeHints}
        known={known}
        initialCards={cards}
      />
    </>
  );
}
