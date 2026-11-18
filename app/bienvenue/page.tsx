import Link from "next/link";
import { Suspense } from "react";
import { Loading, Screen, StepIndicator } from "@/components/screen";
import { loadHousehold } from "@/lib/data";
import { HouseholdForm } from "./household-form";

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
