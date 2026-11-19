"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { BookOpen, CalendarDays, House, Refrigerator, ShoppingBasket, type LucideIcon } from "lucide-react";
import { cn } from "cn";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/semaine", label: "Semaine", icon: CalendarDays },
  { href: "/recettes", label: "Recettes", icon: BookOpen },
  { href: "/courses", label: "Courses", icon: ShoppingBasket },
  { href: "/frigo", label: "Frigo", icon: Refrigerator },
  { href: "/foyer", label: "Foyer", icon: House },
];

const FRIDGE_HREF = "/frigo";

function isActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavProps = {
  // Adresse à surligner ; par défaut, celle de la page.
  current?: string;
  demo?: boolean;
  onSelect?: (href: string) => void;
  // Articles « À finir vite » : la pastille de l'onglet Frigo (rien à 0).
  fridgeCount?: number;
};

// La pastille tomate de l'onglet Frigo ; le nombre est lu avec le nom de l'onglet.
function FridgeBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-5 min-w-5 place-items-center rounded-full bg-tomato-deep px-1 text-[0.75rem] leading-none font-bold text-card tabular-nums ring-2 ring-card",
        className,
      )}
    >
      {count}
    </span>
  );
}

function badgeLabel(href: string, count: number) {
  if (href !== FRIDGE_HREF || count <= 0) return null;
  return <span className="sr-only">{`, ${count} ${count > 1 ? "articles" : "article"} à finir vite`}</span>;
}

// La barre d'onglets de l'appli, en bas sur téléphone ; sur ordinateur, la navigation est dans
// le header (TopNav). Sous une adresse inconnue au prérendu (/recettes/[id]), lire l'adresse
// suspend le rendu : la barre s'affiche d'abord sans onglet actif, puis s'allume.
export function AppNav({ fridgeCount = 0 }: { fridgeCount?: number }) {
  return (
    <Suspense fallback={<BottomNavBar active="" fridgeCount={fridgeCount} />}>
      <BottomNav fridgeCount={fridgeCount} />
    </Suspense>
  );
}

export function BottomNav({ current, ...props }: NavProps) {
  const pathname = usePathname();
  return <BottomNavBar active={current ?? pathname} {...props} />;
}

export function TopNav({ current, ...props }: NavProps) {
  const pathname = usePathname();
  return <TopNavBar active={current ?? pathname} {...props} />;
}

// Dans le header : même règle que la barre du bas, d'abord sans onglet actif si l'adresse
// n'est pas encore connue. Rien pendant le parcours /bienvenue (le foyer n'est pas prêt).
export function HeaderNav({ fridgeCount = 0 }: { fridgeCount?: number }) {
  return (
    <Suspense fallback={<TopNavBar active="" fridgeCount={fridgeCount} />}>
      <HeaderNavInner fridgeCount={fridgeCount} />
    </Suspense>
  );
}

function HeaderNavInner({ fridgeCount }: { fridgeCount: number }) {
  const pathname = usePathname();
  if (pathname === "/bienvenue" || pathname.startsWith("/bienvenue/")) return null;
  return <TopNavBar active={pathname} fridgeCount={fridgeCount} />;
}

// Barre du bas sur téléphone : cinq gros onglets, la pastille glisse vers l'onglet touché.
// Collée au bas et aux bords de l'écran, coins du haut arrondis : rien ne défile dessous.
// La marge du bas suit la zone sûre (barre d'accueil) quand la page s'étend sous elle.
// `demo` : affichée dans la page /design, dans le flux, en pilule entière.
function BottomNavBar({ active, demo = false, onSelect, fridgeCount = 0 }: Omit<NavProps, "current"> & { active: string }) {
  return (
    <nav
      aria-label={demo ? "Exemple de navigation" : "Navigation principale"}
      className={cn(
        "z-40 border-border/80 bg-card/95 p-1.5 shadow-lift backdrop-blur-md",
        demo
          ? "relative rounded-[1.75rem] border"
          : "fixed inset-x-0 bottom-0 rounded-t-[1.75rem] border-t pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden",
      )}
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const on = isActive(href, active);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                onClick={onSelect && ((event) => (event.preventDefault(), onSelect(href)))}
                className={cn(
                  "press flex min-h-15 flex-col items-center justify-center gap-1 rounded-3xl text-[0.8125rem] font-semibold",
                  on ? "text-tomato-deep" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative grid h-8 w-14 place-items-center">
                  {on && (
                    <motion.span
                      layoutId={demo ? "nav-pill-demo" : "nav-pill"}
                      className="absolute inset-0 rounded-full bg-tomato-soft"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <Icon aria-hidden="true" className="relative size-5.5" strokeWidth={on ? 2.4 : 2} />
                  {href === FRIDGE_HREF && <FridgeBadge count={fridgeCount} className="absolute -top-1 right-0.5" />}
                </span>
                {label}
                {badgeLabel(href, fridgeCount)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Navigation du header sur ordinateur (à partir de 1024 px) : cinq onglets en ligne, la
// pastille tomate glisse vers l'onglet choisi.
function TopNavBar({ active, demo = false, onSelect, fridgeCount = 0 }: Omit<NavProps, "current"> & { active: string }) {
  return (
    <nav aria-label={demo ? "Exemple de navigation du header" : "Navigation principale"}>
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const on = isActive(href, active);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                onClick={onSelect && ((event) => (event.preventDefault(), onSelect(href)))}
                className={cn(
                  "press relative flex min-h-11 items-center gap-2 rounded-full px-4 text-base font-semibold",
                  on ? "text-tomato-deep" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {on && (
                  <motion.span
                    layoutId={demo ? "top-pill-demo" : "top-pill"}
                    className="absolute inset-0 rounded-full bg-tomato-soft"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <Icon aria-hidden="true" className="relative size-5" strokeWidth={on ? 2.4 : 2} />
                <span className="relative">{label}</span>
                {href === FRIDGE_HREF && <FridgeBadge count={fridgeCount} className="relative" />}
                {badgeLabel(href, fridgeCount)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
