"use server";

import { redirect } from "next/navigation";
import { authErrorMessage } from "@/lib/auth-errors";
import { afterSignInPath } from "@/lib/invite-cookie";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error: string; email: string } | null;

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error.code), email };
  // Venu d'une invitation : on y retourne.
  redirect(await afterSignInPath("/semaine"));
}

export async function signUp(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: authErrorMessage(error.code), email };
  // Seulement si la confirmation par email est activée dans Supabase.
  if (!data.session) {
    return { error: "Ton compte est créé : confirme ton email avec le lien reçu, puis connecte-toi.", email };
  }
  redirect(await afterSignInPath("/bienvenue"));
}

export async function signOut() {
  const supabase = await createClient();
  // « local » : déconnecte ce téléphone seulement, pas ceux du reste du foyer.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
