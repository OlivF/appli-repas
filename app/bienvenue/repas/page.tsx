import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading, Screen, StepIndicator } from "@/components/screen";
import { loadHousehold } from "@/lib/data";
import { initialSelection } from "@/lib/meal-slots";
import { MealSlotsForm } from "./meal-slots-form";

// Écran 3 du parcours : qui mange quoi dans la semaine. Sert aussi à le modifier.
export default function RepasPage() {
  return (
    <Screen>
      <Suspense fallback={<Loading />}>
        <MealsStep />
      </Suspense>
    </Screen>
  );
}

async function MealsStep() {
  const { household, members, slots, step } = await loadHousehold();
  if (!household) redirect("/bienvenue");
  if (members.length === 0) redirect("/bienvenue/membres");

  const onboarding = step !== null;

  return (
    <>
      {onboarding && <StepIndicator step={3} />}
      <h1 className="page-title">Qui mange à la maison ?</h1>
      <p className="lead">
        {onboarding
          ? "Touche une case pour dire qui est là. Le petit-déj et le dîner sont déjà cochés pour tout le monde."
          : "Touche une case pour dire qui est là."}
      </p>
      <MealSlotsForm
        members={members.map(({ id, first_name }) => ({ id, first_name }))}
        selected={initialSelection(
          slots,
          members.map((member) => member.id),
        )}
      />
    </>
  );
}
