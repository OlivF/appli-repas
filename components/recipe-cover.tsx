"use client";

import Image from "next/image";
import { useState } from "react";
import { mealType } from "@/components/meal-label";
import type { MealType } from "@/lib/meal-slots";

// Couverture d'une recette : sa photo, ou l'emoji du repas posé sur une assiette
// (aussi quand la photo ne se charge pas). Le parent fixe la taille et la couleur de fond.
export function RecipeCover({
  image,
  mealType: type,
  sizes,
  priority = false,
}: {
  image?: { src: string; alt: string };
  mealType: MealType;
  sizes: string;
  priority?: boolean;
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
      <div className="grid size-28 place-items-center rounded-full bg-card/70 shadow-soft ring-8 ring-card/35">
        <span className="text-[3.25rem] leading-none">{mealType(type).emoji}</span>
      </div>
    </div>
  );
}
