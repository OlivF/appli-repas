import type { Database } from "@/lib/supabase/database.types";

export type Diet = Database["public"]["Enums"]["diet"];
export type Appetite = Database["public"]["Enums"]["appetite"];

// Liste fixe : elle servira à filtrer les recettes compatibles.
export const DIETS: { value: Diet; label: string }[] = [
  { value: "keto", label: "Cétogène" },
  { value: "vegetarian", label: "Végétarien" },
  { value: "gluten_free", label: "Sans gluten" },
  { value: "lactose_free", label: "Sans lactose" },
];

export type MemberInput = {
  first_name: string;
  birth_year: number;
  diets: Diet[];
  appetite: Appetite;
};

export type MemberFormErrors = Partial<Record<"first_name" | "age", string>>;

export type MemberFormResult =
  | { ok: true; member: MemberInput }
  | { ok: false; errors: MemberFormErrors };

const MAX_FIRST_NAME_LENGTH = 50;
const MAX_AGE = 120;

// Le formulaire demande l'âge ; la base garde l'année de naissance.
export function parseMemberForm(form: FormData, currentYear: number): MemberFormResult {
  const firstName = String(form.get("first_name") ?? "").trim();
  const ageText = String(form.get("age") ?? "").trim();
  const errors: MemberFormErrors = {};

  if (!firstName) {
    errors.first_name = "Indique un prénom.";
  } else if (firstName.length > MAX_FIRST_NAME_LENGTH) {
    errors.first_name = `Ce prénom est trop long (${MAX_FIRST_NAME_LENGTH} caractères au plus).`;
  }

  const age = /^\d+$/.test(ageText) ? Number(ageText) : NaN;
  if (Number.isNaN(age) || age > MAX_AGE) {
    errors.age = "Indique un âge en années, par exemple 9.";
  }

  if (errors.first_name || errors.age) return { ok: false, errors };

  const submittedDiets = new Set(form.getAll("diets").map(String));
  const diets = DIETS.map((diet) => diet.value).filter((diet) => submittedDiets.has(diet));
  const appetite: Appetite = form.get("appetite") === "grand" ? "grand" : "normal";

  return {
    ok: true,
    member: { first_name: firstName, birth_year: currentYear - age, diets, appetite },
  };
}

export function ageFromBirthYear(birthYear: number, currentYear: number) {
  return currentYear - birthYear;
}

// Abréviations des prénoms pour les colonnes étroites de la grille des repas.
export function shortNames(names: string[]): string[] {
  const abbreviations = names.map(abbreviate);
  const labels = names.map((name, index) =>
    abbreviations.filter((abbreviation) => abbreviation === abbreviations[index]).length > 1
      ? name
      : abbreviations[index],
  );

  // Prénoms identiques : on les numérote.
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    return count === 1 ? label : `${label} ${count}`;
  });
}

function abbreviate(name: string) {
  const parts = name.trim().split(/[\s-]+/).filter(Boolean);
  if (parts.length > 1) return parts.map((part) => [...part][0].toUpperCase()).join("-");
  return [...(parts[0] ?? "")].slice(0, 3).join("");
}

// « 40 ans, cétogène », « 16 ans, grand appétit », « moins d'un an ».
export function describeMember(
  member: { birth_year: number; diets: Diet[]; appetite: Appetite },
  currentYear: number,
): string {
  const age = ageFromBirthYear(member.birth_year, currentYear);
  const parts = [age < 1 ? "moins d'un an" : age === 1 ? "1 an" : `${age} ans`];
  for (const diet of DIETS) {
    if (member.diets.includes(diet.value)) parts.push(diet.label.toLowerCase());
  }
  if (member.appetite === "grand") parts.push("grand appétit");
  return parts.join(", ");
}
