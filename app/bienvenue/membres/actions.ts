"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { SAVE_ERROR, loadHousehold } from "@/lib/data";
import { parseMemberForm, type MemberFormErrors } from "@/lib/members";

export type MemberFormValues = {
  first_name: string;
  age: string;
  diets: string[];
  appetite: string;
};

export type MemberFormState = {
  errors: MemberFormErrors & { form?: string };
  values: MemberFormValues;
} | null;

// Ajoute un membre, ou le modifie quand le formulaire porte son id.
export async function saveMember(
  _state: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const values: MemberFormValues = {
    first_name: String(formData.get("first_name") ?? ""),
    age: String(formData.get("age") ?? ""),
    diets: formData.getAll("diets").map(String),
    appetite: String(formData.get("appetite") ?? "normal"),
  };

  const { supabase, household } = await loadHousehold();
  if (!household) redirect("/bienvenue");

  const parsed = parseMemberForm(formData, new Date().getFullYear());
  if (!parsed.ok) return { errors: parsed.errors, values };

  const memberId = String(formData.get("id") ?? "");
  const { error } = memberId
    ? await supabase
        .from("members")
        .update(parsed.member)
        .eq("id", memberId)
        .eq("household_id", household.id)
    : await supabase.from("members").insert({ ...parsed.member, household_id: household.id });
  if (error) return { errors: { form: SAVE_ERROR }, values };

  redirect("/bienvenue/membres");
}

// Retire un membre ; la base le retire aussi de ses créneaux.
export async function deleteMember(formData: FormData) {
  const { supabase, household } = await loadHousehold();
  if (!household) redirect("/bienvenue");

  await supabase
    .from("members")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("household_id", household.id);
  refresh();
}
