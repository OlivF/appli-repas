import type { EaterMember } from "@/components/recipe-card";
import type { PlannedRecipe } from "@/components/planned-meal-card";
import { avatarInitials } from "@/lib/members";

// Une famille inventée pour la page d'accueil (page publique : jamais les vrais prénoms du
// foyer de test). Camille mange céto ; Jules et Lou ont 9 et 6 ans.
const NAMES = ["Camille", "Karim", "Jules", "Lou"];
const initials = avatarInitials(NAMES);
export const LANDING_FAMILY: EaterMember[] = NAMES.map((first_name, index) => ({
  id: first_name.toLowerCase(),
  first_name,
  color: index,
  initials: initials[index],
}));

const [CAMILLE, KARIM, JULES, LOU] = LANDING_FAMILY;

export const LANDING_DAYS = ["Lundi", "Mardi", "Mercredi"];

// La mini-semaine du haut de page : trois jours, midi et soir, une carte par créneau.
// Chaque plat convient à ceux qui le mangent (aucun avertissement sur la vitrine).
export const LANDING_MEALS: { day: number; row: 0 | 1; recipe: PlannedRecipe; eaters: EaterMember[] }[] = [
  { day: 0, row: 0, recipe: { title: "Omelette aux champignons", minutes: 15, photo_url: null, mealType: "midi" }, eaters: [CAMILLE] },
  { day: 0, row: 1, recipe: { title: "Gratin de courgettes", minutes: 45, photo_url: null, mealType: "soir" }, eaters: LANDING_FAMILY },
  { day: 1, row: 0, recipe: { title: "Salade de poulet et avocat", minutes: 15, photo_url: null, mealType: "midi" }, eaters: [CAMILLE, KARIM] },
  { day: 1, row: 1, recipe: { title: "Poulet rôti, haricots verts", minutes: 60, photo_url: null, mealType: "soir" }, eaters: LANDING_FAMILY },
  { day: 2, row: 0, recipe: { title: "Wraps houmous et crudités", minutes: 10, photo_url: null, mealType: "pique_nique" }, eaters: [JULES, LOU] },
  { day: 2, row: 1, recipe: { title: "Saumon au four et brocolis", minutes: 30, photo_url: null, mealType: "soir" }, eaters: LANDING_FAMILY },
];
