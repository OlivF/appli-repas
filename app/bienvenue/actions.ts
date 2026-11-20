"use server";

import { redirect } from "next/navigation";
import { SAVE_ERROR, loadHousehold } from "@/lib/data";
import { parseHouseholdName } from "@/lib/household";
import { accountErrorMessage } from "@/lib/household-accounts";

export type HouseholdFormState = { error: string; name: string } | null;

export async function saveHousehold(
  _state: HouseholdFormState,
  formData: FormData,
): Promise<HouseholdFormState> {
  const submitted = String(formData.get("name") ?? "");
  const parsed = parseHouseholdName(formData);
  if (!parsed.ok) return { error: parsed.error, name: submitted };

  const { supabase, household, step } = await loadHousehold();

  if (household) {
    const { error } = await supabase
      .from("households")
      .update({ name: parsed.name })
      .eq("id", household.id);
    if (error) return { error: SAVE_ERROR, name: submitted };
    // Foyer déjà complet : on revient au tableau de bord.
    redirect(step === null ? "/foyer" : "/bienvenue/membres");
  }

  const { error } = await supabase.rpc("create_household", { household_name: parsed.name });
  // « Tu fais déjà partie d'un foyer » : un double envoi, par exemple.
  if (error) return { error: accountErrorMessage(error.code, SAVE_ERROR), name: submitted };
  redirect("/bienvenue/membres");
}
