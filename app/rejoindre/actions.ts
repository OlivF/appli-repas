"use server";

import { redirect } from "next/navigation";
import { SAVE_ERROR } from "@/lib/data";
import { accountErrorMessage, normalizeInviteCode } from "@/lib/household-accounts";
import { forgetInvite, rememberInvite } from "@/lib/invite-cookie";
import { createClient } from "@/lib/supabase/server";

// /rejoindre/<code> : créer son compte ou se connecter en gardant l'invitation (cookie), la
// rejoindre, ou la refuser. Les erreurs de la base deviennent des phrases.

export type JoinResult = { ok: true; householdName: string } | { error: string };

// « Créer mon compte » / « J'ai déjà un compte » : on retient le code, puis on y revient après.
export async function startAccountAction(rawCode: string, mode: "signup" | "signin") {
  const code = normalizeInviteCode(rawCode);
  if (code) await rememberInvite(code);
  redirect(mode === "signup" ? "/connexion/inscription" : "/connexion");
}

// « Rejoindre le foyer » ; avec leaveCurrent, on quitte d'abord son foyer actuel.
export async function acceptInviteAction(rawCode: string, leaveCurrent: boolean): Promise<JoinResult> {
  const code = normalizeInviteCode(rawCode);
  if (!code) {
    await forgetInvite();
    return { error: accountErrorMessage("HA002", SAVE_ERROR) };
  }

  const supabase = await createClient();
  const { data: householdId, error } = await supabase.rpc("accept_household_invite", {
    invite_code: code,
    leave_current: leaveCurrent,
  });
  if (error) {
    if (error.code === "HA002") await forgetInvite();
    return { error: accountErrorMessage(error.code, SAVE_ERROR) };
  }

  await forgetInvite();
  const { data: household } = await supabase.from("households").select("name").eq("id", householdId).maybeSingle();
  return { ok: true, householdName: household?.name ?? "" };
}

// « Non, garder mon foyer ».
export async function declineInviteAction() {
  await forgetInvite();
  redirect("/semaine");
}

// Le lien ne marche plus, ou on est déjà dans ce foyer : l'invitation en attente ne sert plus.
export async function forgetInviteAction() {
  await forgetInvite();
}
