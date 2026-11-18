import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppPage } from "@/components/app-page";
import { Loading } from "@/components/screen";
import { addDays, dayLabel, parseWeekParam, todayInParis, weekLabel, weekRelation } from "@/lib/week";
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
  const { members, slots, recipes, cards } = await loadWeek(weekStart);
  const relation = weekRelation(weekStart, today);

  return (
    <WeekBoard
      // Une autre semaine repart d'un état neuf.
      key={weekStart}
      weekStart={weekStart}
      label={weekLabel(weekStart)}
      relation={relation}
      prevHref={`/semaine?semaine=${addDays(weekStart, -7)}`}
      nextHref={`/semaine?semaine=${addDays(weekStart, 7)}`}
      days={[0, 1, 2, 3, 4, 5, 6].map((day) => dayLabel(weekStart, day))}
      firstDay={relation === "current" ? [0, 1, 2, 3, 4, 5, 6].find((day) => addDays(weekStart, day) === today) ?? 0 : 0}
      members={members}
      slots={slots}
      recipes={recipes}
      initialCards={cards}
    />
  );
}
