import type { AvatarMember } from "@/components/member-avatar";
import type { CardMember } from "@/components/member-card";
import { avatarInitials } from "@/lib/members";

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
