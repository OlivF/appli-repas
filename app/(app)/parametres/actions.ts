"use server";

import { authErrorMessage } from "@/lib/auth-errors";
import { parseNewPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { ok: true } | { ok: false; error: string } | null;

export async function changePassword(_state: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = parseNewPassword(formData);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.password });
  if (error) {
    if (error.code === "same_password") {
      return { ok: false, error: "C'est déjà ton mot de passe : choisis-en un autre." };
    }
    return { ok: false, error: authErrorMessage(error.code) };
  }
  return { ok: true };
}
