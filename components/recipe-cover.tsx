"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "cn";
import { mealType } from "@/components/meal-label";
import type { MealType } from "@/lib/meal-slots";

// Couverture d'une recette : sa photo, ou l'emoji du repas posé sur une assiette
// (aussi quand la photo ne se charge pas). Le parent fixe la taille et la couleur de fond.
// `small` : vignette (carte du planning, Bibliothèque), l'assiette rapetisse.
export function RecipeCover({
  image,
  mealType: type,
  sizes,
  priority = false,
  small = false,
}: {
  image?: { src: string; alt: string };
  mealType: MealType;
  sizes: string;
  priority?: boolean;
  small?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (image && !failed) {
    return (
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        priority={priority}
        // Photo collée par le foyer : n'importe quel site, on l'affiche telle quelle.
        unoptimized={!image.src.startsWith("/")}
        onError={() => setFailed(true)}
        className="object-cover"
      />
    );
  }

  return (
    <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
      <div
        className={cn(
          "grid place-items-center rounded-full bg-card/70 shadow-soft",
          small ? "size-11 ring-4 ring-card/35" : "size-28 ring-8 ring-card/35",
        )}
      >
        <span className={cn("leading-none", small ? "text-[1.5rem]" : "text-[3.25rem]")}>{mealType(type).emoji}</span>
      </div>
    </div>
  );
}
