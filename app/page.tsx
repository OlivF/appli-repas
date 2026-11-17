import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading, Screen } from "@/components/screen";
import { SubmitButton } from "@/components/submit-button";
import { loadHousehold } from "@/lib/data";
import { summarizeMeals } from "@/lib/meal-slots";
import { describeMember } from "@/lib/members";
import { signOut } from "./connexion/actions";

// Tableau de bord : récapitulatif du foyer.
export default function HomePage() {
  return (
    <Screen>
      <Suspense fallback={<Loading />}>
        <Dashboard />
      </Suspense>
    </Screen>
  );
}

async function Dashboard() {
  const { household, members, slots, step } = await loadHousehold();
  // Parcours inachevé : on reprend là où il s'est arrêté.
  if (step !== null || !household) redirect(step ?? "/bienvenue");

  const currentYear = new Date().getFullYear();
  const meals = summarizeMeals(slots, members);

  return (
    <>
      <h1 className="page-title">{household.name}</h1>
      <Link href="/bienvenue" className="text-link mt-1 inline-block text-base">
        Renommer le foyer
      </Link>

      <section aria-labelledby="meals-title" className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="meals-title" className="section-title">
            Les repas de la semaine
          </h2>
          <Link href="/bienvenue/repas" aria-label="Modifier les repas" className="text-link text-base">
            Modifier
          </Link>
        </div>
        <div className="mt-3 divide-y divide-line border-y border-line">
          {meals.map((meal) => (
            <div key={meal.label} className="grid grid-cols-[7rem_1fr] gap-3 py-4">
              <h3 className="font-extrabold text-rim">{meal.label}</h3>
              <ul className="space-y-3">
                {meal.lines.map((line) => (
                  <li key={`${line.who}|${line.when}`}>
                    <span className="block font-bold">{line.who}</span>
                    <span className="block text-ink-soft">{line.when}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="household-title" className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="household-title" className="section-title">
            Le foyer
          </h2>
          <Link href="/bienvenue/membres" aria-label="Modifier les membres" className="text-link text-base">
            Modifier
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {members.map((member) => (
            <li key={member.id} className="py-3">
              <span className="block font-bold">{member.first_name}</span>
              <span className="block text-ink-soft">{describeMember(member, currentYear)}</span>
            </li>
          ))}
        </ul>
      </section>

      <form action={signOut} className="mt-12">
        <SubmitButton variant="secondary">Se déconnecter</SubmitButton>
      </form>
    </>
  );
}
