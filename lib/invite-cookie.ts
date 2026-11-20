import { cookies } from "next/headers";
import { normalizeInviteCode } from "@/lib/household-accounts";

// Le code d'invitation d'un visiteur parti créer son compte (ou se connecter) depuis
// /rejoindre/<code> : après la connexion, l'inscription ou le lien de confirmation de l'email,
// on le ramène sur l'invitation au lieu de la semaine ou du parcours. Effacé une fois
// l'invitation acceptée, refusée ou devenue invalide.
export const INVITE_COOKIE = "popote_invite";

// Seulement dans un composant serveur (lecture) ou une Server Action.
export async function pendingInviteCode(): Promise<string | null> {
  const value = (await cookies()).get(INVITE_COOKIE)?.value;
  return value ? normalizeInviteCode(value) : null;
}

// Seulement dans une Server Action : un composant serveur ne peut pas écrire de cookie.
export async function rememberInvite(code: string) {
  (await cookies()).set(INVITE_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function forgetInvite() {
  const store = await cookies();
  if (store.has(INVITE_COOKIE)) store.delete(INVITE_COOKIE);
}

// Où aller après la connexion ou l'inscription : l'invitation en attente, sinon `fallback`.
export async function afterSignInPath(fallback: string): Promise<string> {
  const code = await pendingInviteCode();
  return code ? `/rejoindre/${code}` : fallback;
}
