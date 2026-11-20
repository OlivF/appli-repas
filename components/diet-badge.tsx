import { Egg, Leaf, MilkOff, Smile, Utensils, WheatOff, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DIETS, type Appetite, type Diet } from "@/lib/members";
import { courseOf, isExtra, type Course } from "@/lib/recipes";

type Variant = "plum" | "sage" | "mustard" | "oat" | "tomato";

// Chaque régime garde la même couleur et la même icône partout dans l'appli.
const DIET_STYLE: Record<Diet, { variant: Variant; icon: LucideIcon }> = {
  keto: { variant: "plum", icon: Egg },
  vegetarian: { variant: "sage", icon: Leaf },
  gluten_free: { variant: "mustard", icon: WheatOff },
  lactose_free: { variant: "oat", icon: MilkOff },
};

export function DietBadge({ diet }: { diet: Diet }) {
  const { variant, icon: Icon } = DIET_STYLE[diet];
  const label = DIETS.find((item) => item.value === diet)?.short ?? diet;
  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function AppetiteBadge({ appetite }: { appetite: Appetite }) {
  if (appetite !== "grand") return null;
  return (
    <Badge variant="tomato">
      <Utensils aria-hidden="true" />
      Grand appétit
    </Badge>
  );
}

// Une recette que les enfants aiment.
export function KidBadge() {
  return (
    <Badge variant="tomato">
      <Smile aria-hidden="true" />
      Plaît aux enfants
    </Badge>
  );
}

// Les régimes dans l'ordre de la liste, puis l'appétit.
export function MemberBadges({ diets, appetite }: { diets: Diet[]; appetite: Appetite }) {
  const ordered = DIETS.map((diet) => diet.value).filter((diet) => diets.includes(diet));
  if (ordered.length === 0 && appetite !== "grand") return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {ordered.map((diet) => (
        <DietBadge key={diet} diet={diet} />
      ))}
      <AppetiteBadge appetite={appetite} />
    </div>
  );
}

// La sorte d'une recette qui n'est pas un plat : « Dessert », « Fromage »… Rien pour un plat.
export function CourseBadge({ course }: { course: Course }) {
  if (!isExtra(course)) return null;
  const { label, icon: Icon } = courseOf(course);
  return (
    <Badge variant="outline">
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
