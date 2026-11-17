import { redirect } from "next/navigation";

// L'accueil, c'est la semaine.
export default function HomePage() {
  redirect("/semaine");
}
