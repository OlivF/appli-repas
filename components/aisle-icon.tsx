import { Archive, Beef, Carrot, Croissant, CupSoda, Fish, Milk, ShoppingBasket, Snowflake, Wheat, type LucideIcon } from "lucide-react";
import type { GroceryAisle } from "@/lib/recipes";

const ICONS: Record<GroceryAisle | "placard", LucideIcon> = {
  fruits_legumes: Carrot,
  boucherie: Beef,
  poissonnerie: Fish,
  cremerie: Milk,
  boulangerie: Croissant,
  epicerie: Wheat,
  surgeles: Snowflake,
  boissons: CupSoda,
  autre: ShoppingBasket,
  placard: Archive,
};

// L'icône d'un rayon de la liste de courses (décorative : le titre du rayon est lu).
export function AisleIcon({ aisle, className }: { aisle: GroceryAisle | "placard"; className?: string }) {
  const Icon = ICONS[aisle];
  return <Icon aria-hidden="true" className={className} />;
}
