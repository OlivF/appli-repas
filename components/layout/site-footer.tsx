import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const LINKS = [
  { href: "/connexion", label: "Connexion" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
];

// Pied des pages publiques : le logo, le slogan, et les liens utiles.
export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <Logo />
          <p className="mt-3 text-muted-foreground">Les repas de la semaine, sans prise de tête.</p>
        </div>
        <nav aria-label="Liens du pied de page">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-block py-2 font-semibold text-muted-foreground hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
