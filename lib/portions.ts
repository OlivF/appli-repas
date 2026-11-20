import { ageFromBirthYear, type Appetite } from "@/lib/members";
import { scaleQuantity, type Course } from "@/lib/recipes";

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

// Un dessert, un fruit, un fromage ou un laitage : un mangeur = une portion, sans coefficient
// d'appétit ni d'âge (un yaourt, c'est un yaourt, même pour un grand appétit ; une mousse pour 6,
// ce sont 6 parts). Entrées et plats gardent les coefficients.
export const UNSCALED_COURSES: readonly Course[] = ["dessert", "fruit", "cheese", "dairy"];

// Le facteur d'une recette de cette sorte : la seule mise à l'échelle des courses et du bilan du
// frigo (sans sorte connue, c'est un plat).
export function courseFactor(
  course: Course | null | undefined,
  memberIds: readonly string[],
  members: readonly PortionMember[],
  servings: number,
  weekStart: string,
): number {
  if (course && UNSCALED_COURSES.includes(course)) return scaleQuantity(1, servings, memberIds.length);
  return dishFactor(memberIds, members, servings, weekStart);
}
