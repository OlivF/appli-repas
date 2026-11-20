import { weekdayDate } from "@/lib/fridge-items";
import type { Database } from "@/lib/supabase/database.types";
import { addDays, todayInParis } from "@/lib/week";

// Les comptes qui organisent un foyer et les invitations, sans Supabase. Un compte n'est pas un
// mangeur : son « C'est moi » (member_id) sert seulement à afficher un prénom.

export type HouseholdRole = Database["public"]["Enums"]["household_role"];

// Une ligne de household_accounts().
export type HouseholdAccount = {
  user_id: string;
  email: string;
  role: HouseholdRole;
  member_id: string | null;
  member_chosen_at: string | null;
  joined_at: string;
  is_me: boolean;
};

// ─── Codes d'invitation ─────────────────────────────────────────────────────

// Lisible au téléphone : ni 0, O, 1, I ni L. Le même qu'en base (0013_household_accounts.sql).
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const INVITE_CODE = new RegExp(`^[${INVITE_ALPHABET}]{8}$`);
// Espaces et tirets, y compris ceux que glisse le clavier du téléphone (– —).
const SEPARATORS = /[\s\-‐‑‒–—−]/g;

// Le code tapé ou collé (« 7kqm-3fxp ») → « 7KQM3FXP », ou null s'il ne peut pas en être un.
export function normalizeInviteCode(raw: string): string | null {
  const code = raw.replace(SEPARATORS, "").toUpperCase();
  return INVITE_CODE.test(code) ? code : null;
}

// « 7KQM-3FXP » : à dicter.
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function inviteUrl(origin: string, code: string): string {
  return `${origin}/rejoindre/${code}`;
}

export function inviteShareText(householdName: string, url: string): string {
  return `Rejoins le foyer « ${householdName} » sur Popote pour qu’on prépare les menus à deux : ${url}`;
}

// « Valable jusqu'au jeu. 26 nov. », à l'heure de Paris.
export function inviteExpiryLabel(expiresAt: string, today: string): string {
  const day = todayInParis(new Date(expiresAt));
  if (day === today) return "Valable encore aujourd’hui";
  if (day === addDays(today, 1)) return "Valable jusqu’à demain";
  return `Valable jusqu’au ${weekdayDate(day)}`;
}

// ─── Comptes ────────────────────────────────────────────────────────────────

// Le prénom du mangeur « C'est moi », sinon l'email.
export function accountLabel(
  account: Pick<HouseholdAccount, "email" | "member_id">,
  members: readonly { id: string; first_name: string }[],
): string {
  const member = account.member_id ? members.find((m) => m.id === account.member_id) : undefined;
  return member?.first_name ?? account.email;
}

// Inviter, retirer quelqu'un, changer qui peut inviter.
export function canManageAccounts(role: HouseholdRole | null | undefined): boolean {
  return role === "admin";
}

// Les mangeurs qu'un compte peut choisir comme « C'est moi » : ceux qui ne sont celui d'aucun
// autre compte (le sien reste proposé).
export function claimableMembers<M extends { id: string }>(
  members: readonly M[],
  accounts: readonly Pick<HouseholdAccount, "member_id" | "is_me">[],
): M[] {
  const taken = new Set(accounts.filter((a) => !a.is_me && a.member_id).map((a) => a.member_id));
  return members.filter((member) => !taken.has(member.id));
}

export type LeaveConsequence = "delete_household" | "promote_oldest" | "leave";

// Ce qui se passe quand on quitte le foyer, pour le dire avant de confirmer (les règles vivent
// dans le trigger de départ, en base).
export function leaveConsequence({
  accountCount,
  isLastAdmin,
}: {
  accountCount: number;
  isLastAdmin: boolean;
}): LeaveConsequence {
  if (accountCount <= 1) return "delete_household";
  if (isLastAdmin) return "promote_oldest";
  return "leave";
}

// Ce qui se passe si le compte connecté quitte le foyer, et qui pourra alors inviter à sa place
// (le compte arrivé le premier parmi les autres, comme le trigger de départ).
export function leavePlan(accounts: readonly HouseholdAccount[]): {
  consequence: LeaveConsequence;
  successor: HouseholdAccount | null;
} {
  const me = accounts.find((a) => a.is_me);
  const others = accounts.filter((a) => !a.is_me);
  const isLastAdmin = me?.role === "admin" && !others.some((a) => a.role === "admin");
  const consequence = leaveConsequence({ accountCount: accounts.length, isLastAdmin });
  const successor =
    consequence === "promote_oldest"
      ? [...others].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.user_id.localeCompare(b.user_id))[0]
      : null;
  return { consequence, successor };
}

// ─── Erreurs ────────────────────────────────────────────────────────────────

export type AccountErrorKind =
  | "already_in_household"
  | "invalid_invite"
  | "last_admin"
  | "too_many_invites"
  | "cannot_remove_self"
  | "not_allowed"
  | "not_found"
  | "member_taken"
  | "unknown";

// Les errcode des fonctions de 0013_household_accounts.sql.
const ERROR_KINDS: Record<string, AccountErrorKind> = {
  HA001: "already_in_household",
  HA002: "invalid_invite",
  HA003: "last_admin",
  HA004: "too_many_invites",
  HA005: "cannot_remove_self",
  "42501": "not_allowed",
  P0002: "not_found",
  "23505": "member_taken",
};

export function accountErrorKind(code: string | undefined): AccountErrorKind {
  return (code && ERROR_KINDS[code]) || "unknown";
}

const ERROR_MESSAGES: Partial<Record<AccountErrorKind, string>> = {
  already_in_household: "Tu fais déjà partie d’un foyer.",
  invalid_invite: "Ce lien ne marche plus. Demande un nouveau lien à la personne qui t’a invité·e.",
  last_admin: "Il faut garder au moins une personne qui peut inviter.",
  too_many_invites: "Il y a déjà 5 invitations en attente : annules-en une avant d’en créer une autre.",
  cannot_remove_self: "Pour toi, c’est « Quitter ce foyer », en bas de la page.",
  not_allowed: "Seule une personne qui peut inviter peut faire ça.",
  member_taken: "Une autre personne du foyer a déjà choisi ce prénom.",
};

// Une erreur des fonctions du foyer, en une phrase ; `fallback` (la phrase de l'écran) pour ce qui
// est introuvable ou inattendu. Jamais l'erreur brute.
export function accountErrorMessage(code: string | undefined, fallback: string): string {
  return ERROR_MESSAGES[accountErrorKind(code)] ?? fallback;
}
