import { mondayOf, nextWeekStart } from "@/lib/week";

const MAX_LABEL = 80;
const MAX_QUANTITY = 40;

export type ManualItemResult = { ok: true; label: string; quantityText: string | null } | { ok: false; error: string };

// Un article ajouté (ou modifié) à la main : un nom, une quantité libre facultative.
export function parseManualItem(label: string, quantity: string): ManualItemResult {
  const cleanLabel = label.replace(/\s+/g, " ").trim();
  const cleanQuantity = quantity.replace(/\s+/g, " ").trim();
  if (!cleanLabel) return { ok: false, error: "Écris le nom de l'article." };
  if (cleanLabel.length > MAX_LABEL) return { ok: false, error: `Ce nom est trop long (${MAX_LABEL} caractères au plus).` };
  if (cleanQuantity.length > MAX_QUANTITY) {
    return { ok: false, error: `Cette quantité est trop longue (${MAX_QUANTITY} caractères au plus).` };
  }
  return { ok: true, label: cleanLabel, quantityText: cleanQuantity || null };
}

// Sans semaine dans l'adresse : la semaine prochaine si son menu est prêt (on fait les courses
// avant), sinon la semaine en cours.
export async function defaultShoppingWeek(today: string, hasMenu: (weekStart: string) => Promise<boolean>): Promise<string> {
  const next = nextWeekStart(today);
  return (await hasMenu(next)) ? next : mondayOf(today);
}
