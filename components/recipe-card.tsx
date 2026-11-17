import Image from "next/image";
import { Clock, CookingPot } from "lucide-react";
import { cn } from "cn";
import { DietBadge } from "@/components/diet-badge";
import { MEAL_TINT, MealLabel, mealType } from "@/components/meal-label";
import { MemberAvatars, type AvatarMember } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import type { MealType } from "@/lib/meal-slots";
import type { Diet } from "@/lib/members";

export type RecipeCardProps = {
  title: string;
  mealType: MealType;
  minutes: number;
  // Se prépare à l'avance (batch cooking du dimanche).
  batch?: boolean;
  diets: Diet[];
  // Les membres pour qui la recette convient.
  members: AvatarMember[];
  image?: { src: string; alt: string };
  className?: string;
};

// Carte recette : une photo (ou, à défaut, l'emoji du repas sur sa couleur), le titre,
// le temps, les régimes compatibles et les avatars de ceux qui peuvent en manger.
export function RecipeCard({ title, mealType: type, minutes, batch, diets, members, image, className }: RecipeCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft",
        className,
      )}
    >
      <div className={cn("relative aspect-[16/10] overflow-hidden", !image && MEAL_TINT[type])}>
        {image ? (
          <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1024px) 22rem, 100vw" className="object-cover" />
        ) : (
          <RecipeCover emoji={mealType(type).emoji} />
        )}
        <span className="absolute top-3 left-3 inline-flex h-8 items-center rounded-full bg-card/95 px-3 text-[0.875rem] font-semibold text-foreground shadow-soft">
          <MealLabel type={type} />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="text-[1.375rem] leading-tight">{title}</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.9375rem] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden="true" className="size-4" />
            {minutes} min
          </span>
          {batch && (
            <span className="inline-flex items-center gap-1.5">
              <CookingPot aria-hidden="true" className="size-4" />
              Se prépare à l’avance
            </span>
          )}
        </div>
        {diets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {diets.map((diet) => (
              <DietBadge key={diet} diet={diet} />
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center gap-3 border-t border-border/70 pt-3">
          <MemberAvatars members={members} />
          <span className="text-[0.9375rem] text-muted-foreground">
            {members.length === 1 ? `Pour ${members[0].first_name}` : `Pour ${members.length}`}
          </span>
        </div>
      </div>
    </article>
  );
}

// Couverture illustrée : l'emoji du repas, posé sur une assiette.
function RecipeCover({ emoji }: { emoji: string }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
      <div className="grid size-28 place-items-center rounded-full bg-card/70 shadow-soft ring-8 ring-card/35">
        <span className="text-[3.25rem] leading-none">{emoji}</span>
      </div>
    </div>
  );
}

export function BatchBadge() {
  return (
    <Badge variant="sage">
      <CookingPot aria-hidden="true" />
      À l’avance
    </Badge>
  );
}
