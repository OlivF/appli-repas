import Link from "next/link";
import { Clock, CookingPot, Heart } from "lucide-react";
import { cn } from "cn";
import { DietBadge } from "@/components/diet-badge";
import { MEAL_TINT, MealLabel } from "@/components/meal-label";
import { MemberAvatars, type AvatarMember } from "@/components/member-avatar";
import { RecipeCover } from "@/components/recipe-cover";
import { Badge } from "@/components/ui/badge";
import type { MealType } from "@/lib/meal-slots";
import type { Diet } from "@/lib/members";
import { describeEaters, formatDuration } from "@/lib/recipes";

// `out` : ce membre ne la mange pas (exclu, ou écarté par son régime) ; son avatar est barré.
export type EaterMember = AvatarMember & { out?: boolean };

export type RecipeCardProps = {
  title: string;
  mealTypes: MealType[];
  // Temps total : préparation + cuisson.
  minutes: number;
  // Se prépare à l'avance (batch cooking du dimanche).
  batch?: boolean;
  diets: Diet[];
  favorite?: boolean;
  // Tous les membres du foyer.
  members: EaterMember[];
  image?: { src: string; alt: string };
  // Avec `href`, toute la carte ouvre la fiche.
  href?: string;
  className?: string;
};

// Carte recette : une photo (ou, à défaut, l'emoji du repas sur sa couleur), le titre,
// le temps, les régimes, et les membres de la maison, barrés pour ceux qui n'en mangent pas.
export function RecipeCard({
  title,
  mealTypes,
  minutes,
  batch,
  diets,
  favorite = false,
  members,
  image,
  href,
  className,
}: RecipeCardProps) {
  const [mainMeal = "soir"] = mealTypes;
  const outIds = members.filter((member) => member.out).map((member) => member.id);

  const body = (
    <>
      <div className={cn("relative aspect-[16/10] overflow-hidden", MEAL_TINT[mainMeal])}>
        <RecipeCover image={image} mealType={mainMeal} sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw" />
        <ul className="absolute top-3 left-3 flex flex-wrap gap-1.5 pr-14">
          {mealTypes.map((type) => (
            <li
              key={type}
              className="inline-flex h-8 items-center rounded-full bg-card/95 px-3 text-[0.875rem] font-semibold text-foreground shadow-soft"
            >
              <MealLabel type={type} />
            </li>
          ))}
        </ul>
        {favorite && (
          <span
            role="img"
            aria-label="Favori"
            className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-card/95 shadow-soft"
          >
            <Heart aria-hidden="true" className="size-4.5 fill-primary text-primary" />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="text-[1.375rem] leading-tight">{title}</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.9375rem] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden="true" className="size-4" />
            {formatDuration(minutes)}
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
        {members.length > 0 && (
          <div className="mt-auto flex items-center gap-3 border-t border-border/70 pt-3">
            <MemberAvatars members={members} crossedIds={outIds} decorative />
            <span className="min-w-0 text-[0.9375rem] text-muted-foreground">{describeEaters(members, outIds)}</span>
          </div>
        )}
      </div>
    </>
  );

  const frame = "flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft";

  // Carte cliquable : le lien porte directement le contenu, sans <article> dedans (Chromium
  // ne calcule pas le nom d'un lien à travers un article : il serait annoncé sans nom).
  return href ? (
    <Link href={href} className={cn(frame, "lift press active:scale-[0.98]", className)}>
      {body}
    </Link>
  ) : (
    <article className={cn(frame, className)}>{body}</article>
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
