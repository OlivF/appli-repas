import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading, Screen, StepIndicator } from "@/components/screen";
import { loadHousehold } from "@/lib/data";
import { ageFromBirthYear, describeMember } from "@/lib/members";
import { deleteMember } from "./actions";
import { MemberForm } from "./member-form";

// Écran 2 du parcours : les personnes du foyer. Sert aussi à les modifier.
export default function MembresPage(props: PageProps<"/bienvenue/membres">) {
  return (
    <Screen>
      <Suspense fallback={<Loading />}>
        <MembersStep searchParams={props.searchParams} />
      </Suspense>
    </Screen>
  );
}

async function MembersStep({
  searchParams,
}: {
  searchParams: PageProps<"/bienvenue/membres">["searchParams"];
}) {
  const { household, members, step } = await loadHousehold();
  if (!household) redirect("/bienvenue");

  const { modifier } = await searchParams;
  const edited = members.find((member) => member.id === modifier) ?? null;
  const onboarding = step !== null;
  const currentYear = new Date().getFullYear();

  return (
    <>
      {onboarding && <StepIndicator step={2} />}
      <h1 className="page-title">Qui vit à la maison ?</h1>
      <p className="lead">Ajoute chaque personne qui mange à la maison, même de temps en temps.</p>

      {members.length > 0 && (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{member.first_name}</p>
                <p className="text-base text-ink-soft">{describeMember(member, currentYear)}</p>
              </div>
              <Link
                href={`/bienvenue/membres?modifier=${member.id}`}
                aria-label={`Modifier ${member.first_name}`}
                className="text-link px-2 text-base"
              >
                Modifier
              </Link>
              <form action={deleteMember}>
                <input type="hidden" name="id" value={member.id} />
                <button
                  type="submit"
                  aria-label={`Retirer ${member.first_name}`}
                  className="min-h-11 cursor-pointer px-2 text-base font-bold text-danger underline decoration-2 underline-offset-4"
                >
                  Retirer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="member-form-title" className="mt-10">
        <h2 id="member-form-title" className="section-title">
          {edited ? `Modifier ${edited.first_name}` : "Ajouter une personne"}
        </h2>
        {/* La clé remet le formulaire à zéro après chaque ajout ou modification. */}
        <MemberForm
          key={edited?.id ?? `nouveau-${members.length}`}
          member={
            edited && {
              id: edited.id,
              first_name: edited.first_name,
              age: ageFromBirthYear(edited.birth_year, currentYear),
              diets: edited.diets,
              appetite: edited.appetite,
            }
          }
        />
      </section>

      {members.length > 0 && !edited && (
        <div className="mt-10 space-y-3">
          <Link href="/bienvenue/repas" className="btn btn-primary">
            {onboarding ? "Continuer" : "Continuer vers les repas"}
          </Link>
          {!onboarding && (
            <p className="text-center">
              <Link href="/foyer" className="text-link">
                Retour au foyer
              </Link>
            </p>
          )}
        </div>
      )}
    </>
  );
}
