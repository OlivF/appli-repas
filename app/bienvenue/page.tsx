import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading, Screen, StepIndicator } from "@/components/screen";
import { loadHousehold } from "@/lib/data";
import { pendingInviteCode } from "@/lib/invite-cookie";
import { HouseholdForm } from "./household-form";
import { InviteCodeField } from "./invite-code-field";

// Écran 1 du parcours : le nom du foyer. Sert aussi à le renommer.
export default function BienvenuePage() {
  return (
    <Screen>
      <Suspense fallback={<Loading />}>
        <HouseholdStep />
      </Suspense>
    </Screen>
  );
}

async function HouseholdStep() {
  const { household, step } = await loadHousehold();
  const renaming = step === null;

  // Venu d'une invitation (lien de confirmation de l'email, par exemple) : on la reprend.
  if (!household) {
    const code = await pendingInviteCode();
    if (code) redirect(`/rejoindre/${code}`);
  }

  return (
    <>
      {!renaming && <StepIndicator step={1} />}
      <h1 className="page-title">
        {renaming ? "Renommer le foyer" : "Comment s’appelle ton foyer ?"}
      </h1>
      {/* La clé recrée le champ quand le nom enregistré change : Next.js peut afficher cet écran
          d'abord avec l'ancien nom (page gardée ou préparée d'avance). Voir repas/page.tsx. */}
      <HouseholdForm
        key={household?.name ?? ""}
        name={household?.name ?? ""}
        submitLabel={renaming ? "Enregistrer" : "Continuer"}
      />
      {!household && (
        <div className="mt-6 flex flex-col items-center">
          <InviteCodeField />
        </div>
      )}
      {renaming && (
        <p className="mt-6 text-center">
          <Link href="/foyer" className="text-link">
            Annuler
          </Link>
        </p>
      )}
    </>
  );
}
