"use server";

import { redirect } from "next/navigation";
import { SAVE_ERROR, loadHousehold } from "@/lib/data";
import { slotsFromSelection } from "@/lib/meal-slots";

export type MealSlotsFormState = { error: string; selected: string[] } | null;

// Enregistre la grille : met à jour les créneaux cochés, supprime ceux qui sont vides.
export async function saveMealSlots(
  _state: MealSlotsFormState,
  formData: FormData,
): Promise<MealSlotsFormState> {
  const selected = formData.getAll("cells").map(String);
  const { supabase, household, members, slots: existing } = await loadHousehold();
  if (!household) redirect("/bienvenue");

  const wanted = slotsFromSelection(
    selected,
    members.map((member) => member.id),
  );
  if (wanted.length === 0) return { error: "Coche au moins un repas.", selected };

  // Créneaux identifiés par (foyer, jour, repas) : on met à jour sans les recréer.
  const { error: upsertError } = await supabase
    .from("meal_slots")
    .upsert(
      wanted.map((slot) => ({ ...slot, household_id: household.id })),
      { onConflict: "household_id,day,meal_type" },
    );
  if (upsertError) return { error: SAVE_ERROR, selected };

  const wantedKeys = new Set(wanted.map((slot) => `${slot.day}:${slot.meal_type}`));
  const emptiedIds = existing
    .filter((slot) => !wantedKeys.has(`${slot.day}:${slot.meal_type}`))
    .map((slot) => slot.id);
  if (emptiedIds.length > 0) {
    const { error } = await supabase.from("meal_slots").delete().in("id", emptiedIds);
    if (error) return { error: SAVE_ERROR, selected };
  }

  redirect("/");
}
