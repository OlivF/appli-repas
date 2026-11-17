const MAX_NAME_LENGTH = 80;

export type HouseholdNameResult = { ok: true; name: string } | { ok: false; error: string };

export function parseHouseholdName(form: FormData): HouseholdNameResult {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Donne un nom à ton foyer." };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Ce nom est trop long (${MAX_NAME_LENGTH} caractères au plus).` };
  }
  return { ok: true, name };
}

export type OnboardingState = { hasHousehold: boolean; memberCount: number; slotCount: number };

// Prochain écran du parcours /bienvenue, ou null s'il est terminé.
export function nextOnboardingStep(state: OnboardingState): string | null {
  if (!state.hasHousehold) return "/bienvenue";
  if (state.memberCount === 0) return "/bienvenue/membres";
  if (state.slotCount === 0) return "/bienvenue/repas";
  return null;
}
