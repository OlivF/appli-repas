import { redirect } from "next/navigation";
import { connection } from "next/server";
import { nextOnboardingStep } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";

export const SAVE_ERROR = "L'enregistrement n'a pas abouti. Vérifie ta connexion, puis réessaie.";

// Foyer du compte connecté, avec ses membres et ses créneaux.
// La RLS ne renvoie que les foyers dont le compte est membre.
export async function loadHousehold() {
  // Données propres à chaque requête : jamais pré-rendues. Sans cet appel, Cache Components
  // refuse l'heure courante que lit supabase-js (expiration de la session) et nos calculs d'âge.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/connexion");

  const { data: household, error } = await supabase
    .from("households")
    .select("id, name")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!household) {
    return {
      supabase,
      household: null,
      members: [],
      slots: [],
      step: nextOnboardingStep({ hasHousehold: false, memberCount: 0, slotCount: 0 }),
    };
  }

  const [membersResult, slotsResult] = await Promise.all([
    supabase
      .from("members")
      .select("id, first_name, birth_year, diets, appetite")
      .eq("household_id", household.id)
      .order("created_at"),
    supabase
      .from("meal_slots")
      .select("id, day, meal_type, member_ids")
      .eq("household_id", household.id),
  ]);
  if (membersResult.error) throw new Error(membersResult.error.message);
  if (slotsResult.error) throw new Error(slotsResult.error.message);

  const members = membersResult.data;
  const slots = slotsResult.data;
  return {
    supabase,
    household,
    members,
    slots,
    // null quand le parcours /bienvenue est terminé.
    step: nextOnboardingStep({
      hasHousehold: true,
      memberCount: members.length,
      slotCount: slots.length,
    }),
  };
}
