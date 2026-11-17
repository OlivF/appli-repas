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
      <HouseholdForm
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
