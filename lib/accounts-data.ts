import type { HouseholdAccount, HouseholdRole } from "@/lib/household-accounts";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// Une invitation encore valide, telle que la section « Qui organise les repas » la montre.
export type PendingInvite = { id: string; code: string; role: HouseholdRole; expires_at: string };

export const INVITE_COLUMNS = "id, code, role, expires_at";

// Les comptes du foyer du compte connecté, par ordre d'arrivée, et ses invitations en attente.
// La RLS ne montre les invitations qu'aux comptes qui peuvent inviter : liste vide pour les autres.
// À appeler après connection() (l'heure courante filtre les invitations expirées).
export async function loadHouseholdAccounts(
  supabase: Client,
  householdId: string,
): Promise<{ accounts: HouseholdAccount[]; invites: PendingInvite[] }> {
  const [accountsResult, invitesResult] = await Promise.all([
    supabase.rpc("household_accounts"),
    supabase
      .from("household_invites")
      .select(INVITE_COLUMNS)
      .eq("household_id", householdId)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at"),
  ]);
  if (accountsResult.error) throw new Error(accountsResult.error.message);
  if (invitesResult.error) throw new Error(invitesResult.error.message);
  return { accounts: accountsResult.data, invites: invitesResult.data };
}
