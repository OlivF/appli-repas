import type { AvatarMember } from "@/components/member-avatar";
import type { CardMember } from "@/components/member-card";
import { avatarInitials } from "@/lib/members";
import type { ListRecipe } from "@/lib/recipes-data";

// Le foyer de test de CLAUDE.md, pour illustrer les composants. Aucune donnée réelle.
const PEOPLE = [
  { id: "olivier", first_name: "Olivier", age: 40, diets: [], appetite: "normal" },
  { id: "marie-laure", first_name: "Marie-Laure", age: 40, diets: ["keto"], appetite: "normal" },
  { id: "timothe", first_name: "Timothé", age: 16, diets: [], appetite: "grand" },
  { id: "anna-lucia", first_name: "Anna-Lucia", age: 9, diets: [], appetite: "normal" },
  { id: "otis", first_name: "Otis", age: 6, diets: [], appetite: "normal" },
] as const satisfies readonly Omit<CardMember, "color" | "initials">[];

const initials = avatarInitials(PEOPLE.map((person) => person.first_name));

export const FAMILY: CardMember[] = PEOPLE.map((person, index) => ({
  ...person,
  diets: [...person.diets],
  color: index,
  initials: initials[index],
}));

export const [OLIVIER, MARIE_LAURE, TIMOTHE, ANNA_LUCIA, OTIS] = FAMILY as [
  CardMember,
  CardMember,
  CardMember,
  CardMember,
  CardMember,
];

// Les huit couleurs pastel, pour le nuancier.
export const PALETTE: AvatarMember[] = [
  "Tomate",
  "Sauge",
  "Moutarde",
  "Prune",
  "Ciel",
  "Lavande",
  "Menthe",
  "Abricot",
].map((name, color) => ({ id: name, first_name: name, color, initials: name[0] }));

// Quelques recettes du catalogue, pour la Bibliothèque et les cartes du planning.
export const DEMO_RECIPES: ListRecipe[] = [
  {
    id: "saumon",
    title: "Saumon au four, beurre citronné et brocolis",
    meal_types: ["soir"],
    minutes: 30,
    diets: ["keto", "gluten_free"],
    favorite: false,
  },
  {
    id: "poulet",
    title: "Poulet à la crème et aux champignons",
    meal_types: ["soir"],
    minutes: 40,
    diets: ["keto", "gluten_free"],
    favorite: true,
  },
  { id: "lasagnes", title: "Lasagnes à la bolognaise", meal_types: ["soir"], minutes: 75, diets: [], favorite: false },
  { id: "croque", title: "Croque-monsieur et salade verte", meal_types: ["soir"], minutes: 20, diets: [], favorite: false },
  { id: "pizza", title: "Pizza à la pâte de mozzarella", meal_types: ["soir"], minutes: 45, diets: ["keto", "gluten_free"], favorite: false },
].map((recipe) => ({
  ...recipe,
  meal_types: recipe.meal_types as ListRecipe["meal_types"],
  diets: recipe.diets as ListRecipe["diets"],
  photo_url: null,
  batch_friendly: false,
  ingredientNames: [],
  excludedIds: [],
}));
