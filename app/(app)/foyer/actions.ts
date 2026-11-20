"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { INVITE_COLUMNS, type PendingInvite } from "@/lib/accounts-data";
import { SAVE_ERROR } from "@/lib/data";
import { accountErrorMessage } from "@/lib/household-accounts";
import { createClient } from "@/lib/supabase/server";

// Les comptes du foyer et les invitations. Tout passe par les fonctions de la base
// (0013_household_accounts.sql), qui vérifient qui a le droit ; leurs erreurs sont traduites en
// phrases. Après chaque geste, la page se rafraîchit.

export type ActionError = { error: string };
export type DoneResult = { ok: true } | ActionError;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GONE = "Cette personne ne fait plus partie du foyer. Recharge la page.";
const INVITE_GONE = "Cette invitation ne marche plus. Recharge la page.";

type RpcError = { code?: string } | null;

function done(error: RpcError, fallback = SAVE_ERROR): DoneResult {
  if (error) return { error: accountErrorMessage(error.code, fallback) };
  refresh();
  return { ok: true };
}

// « Inviter quelqu'un » : un nouveau code, qui permet d'inviter à son tour (l'interrupteur du
// panneau le change ensuite).
export async function createInviteAction(): Promise<{ invite: PendingInvite } | ActionError> {
  const supabase = await createClient();
  const { data: household } = await supabase.from("households").select("id").order("created_at").limit(1).maybeSingle();
  if (!household) return { error: SAVE_ERROR };

  const { data, error } = await supabase.rpc("create_household_invite", { target_household_id: household.id });
  const created = data?.[0];
  if (error || !created) return { error: accountErrorMessage(error?.code, SAVE_ERROR) };

  const { data: invite } = await supabase.from("household_invites").select(INVITE_COLUMNS).eq("code", created.code).maybeSingle();
  if (!invite) return { error: SAVE_ERROR };
  refresh();
  return { invite };
}

export async function setInviteRoleAction(inviteId: string, canInvite: boolean): Promise<DoneResult> {
  if (!UUID.test(inviteId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_household_invite_role", {
    invite_id: inviteId,
    new_role: canInvite ? "admin" : "member",
  });
  return done(error, INVITE_GONE);
}

export async function revokeInviteAction(inviteId: string): Promise<DoneResult> {
  if (!UUID.test(inviteId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_household_invite", { invite_id: inviteId });
  return done(error, INVITE_GONE);
}

export async function setAccountRoleAction(userId: string, canInvite: boolean): Promise<DoneResult> {
  if (!UUID.test(userId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_household_role", {
    target_user_id: userId,
    new_role: canInvite ? "admin" : "member",
  });
  return done(error, GONE);
}

export async function removeAccountAction(userId: string): Promise<DoneResult> {
  if (!UUID.test(userId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_household_account", { target_user_id: userId });
  return done(error, GONE);
}

// « C'est moi » ; null : « Je ne mange pas ici ».
export async function setMyMemberAction(memberId: string | null): Promise<DoneResult> {
  if (memberId !== null && !UUID.test(memberId)) return { error: SAVE_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_member", { target_member_id: memberId as string });
  return done(error, "Ce prénom n’est plus dans le foyer. Recharge la page.");
}

// Quitter le foyer, puis repartir de /bienvenue (créer un foyer, ou entrer un code).
export async function leaveHouseholdAction(): Promise<ActionError> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_household");
  if (error && error.code !== "P0002") return { error: accountErrorMessage(error.code, SAVE_ERROR) };
  redirect("/bienvenue");
}
