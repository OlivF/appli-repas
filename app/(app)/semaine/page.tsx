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
import type { SlotInput } from "@/lib/meal-slots";
import { loadWeek } from "@/lib/week-data";
import { WeekBoard } from "./week-board";

export const metadata: Metadata = { title: "La semaine" };

// Les repas, en texte (« 0:soir:id,id;… »), dans un ordre fixe : la base ne garantit pas le sien.
const mealsKey = (slots: readonly SlotInput[]) =>
  slots
    .map((slot) => `${slot.day}:${slot.meal_type}:${[...slot.member_ids].sort().join(",")}`)
    .sort()
    .join(";");

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
  const { supabase, household, members, slots, homeSlots, changes, recipes, extraRecipes, cards } = await loadWeek(weekStart);
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
        // Une autre semaine repart d'un état neuf ; des repas changés ailleurs aussi (le foyer) :
        // Next.js garde l'écran déjà visité, avec ses repas d'avant, et ne passe que les props.
        key={`${weekStart}|${mealsKey(homeSlots)}|${mealsKey(slots)}`}
        weekStart={weekStart}
        label={weekLabel(weekStart)}
        relation={relation}
        prevHref={`/semaine?semaine=${addDays(weekStart, -7)}`}
        nextHref={`/semaine?semaine=${addDays(weekStart, 7)}`}
        days={[0, 1, 2, 3, 4, 5, 6].map((day) => dayLabel(weekStart, day))}
        firstDay={todayDay ?? 0}
        todayDay={todayDay}
        members={members}
        initialSlots={slots}
        homeSlots={homeSlots}
        initialChanges={changes}
        recipes={recipes}
        extraRecipes={extraRecipes}
        fridgeHints={fridgeHints}
        known={known}
        initialCards={cards}
      />
    </>
  );
}
