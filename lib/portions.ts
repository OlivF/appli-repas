import { ageFromBirthYear, type Appetite } from "@/lib/members";
import { scaleQuantity } from "@/lib/recipes";

// Combien chaque convive mange, en portions d'adulte : de quoi mettre une recette à l'échelle
// des mangeurs d'un plat (liste de courses).

export const GRAND_APPETITE_COEFFICIENT = 1.5;
export const CHILD_COEFFICIENT = 0.7;
// Moins de 12 ans à la date du lundi : un enfant.
export const CHILD_AGE_LIMIT = 12;

export type PortionMember = { id: string; birth_year: number; appetite: Appetite };

// Grand appétit → 1,5 ; sinon enfant → 0,7 ; sinon 1. Seule l'année de naissance est connue :
// l'âge est celui atteint dans l'année du lundi.
export function memberCoefficient(member: PortionMember, weekStart: string): number {
  if (member.appetite === "grand") return GRAND_APPETITE_COEFFICIENT;
  const age = ageFromBirthYear(member.birth_year, Number(weekStart.slice(0, 4)));
  return age < CHILD_AGE_LIMIT ? CHILD_COEFFICIENT : 1;
}

// Nombre de portions mangées par ces membres ; un membre inconnu (parti du foyer) compte pour 1.
export function portionsFor(memberIds: readonly string[], members: readonly PortionMember[], weekStart: string): number {
  return memberIds.reduce((sum, id) => {
    const member = members.find((candidate) => candidate.id === id);
    return sum + (member ? memberCoefficient(member, weekStart) : 1);
  }, 0);
}

// Facteur à appliquer aux quantités d'une recette écrite pour `servings` personnes, mangée par
// ces membres. Même mise à l'échelle que la fiche recette.
export function dishFactor(
  memberIds: readonly string[],
  members: readonly PortionMember[],
  servings: number,
  weekStart: string,
): number {
  return scaleQuantity(1, servings, portionsFor(memberIds, members, weekStart));
}
