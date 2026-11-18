// Le minimum de Supabase Auth (réglage par défaut), rappelé à l'inscription.
export const PASSWORD_MIN_LENGTH = 6;

export type NewPasswordResult = { ok: true; password: string } | { ok: false; error: string };

// Nouveau mot de passe saisi dans les Paramètres. Les espaces comptent : on ne les retire pas.
export function parseNewPassword(form: FormData): NewPasswordResult {
  const password = String(form.get("password") ?? "");
  if (!password) return { ok: false, error: "Choisis un nouveau mot de passe." };
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Choisis un mot de passe d'au moins ${PASSWORD_MIN_LENGTH} caractères.` };
  }
  return { ok: true, password };
}
