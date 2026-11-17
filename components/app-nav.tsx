"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { BookOpen, CalendarDays, House, ShoppingBasket, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Logo } from "@/components/logo";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/semaine", label: "Semaine", icon: CalendarDays },
  { href: "/recettes", label: "Recettes", icon: BookOpen },
  { href: "/courses", label: "Courses", icon: ShoppingBasket },
  { href: "/foyer", label: "Foyer", icon: House },
];

function isActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavProps = {
  // Adresse à surligner ; par défaut, celle de la page.
  current?: string;
  demo?: boolean;
  onSelect?: (href: string) => void;
};

// La barre d'onglets de l'appli : en bas sur téléphone, sur le côté sur ordinateur.
// Sous une adresse inconnue au prérendu (/recettes/[id]), lire l'adresse suspend le rendu :
// la barre s'affiche d'abord sans onglet actif, puis s'allume.
export function AppNav() {
  return (
    <>
      <Suspense fallback={<SideNavBar active="" />}>
        <SideNav />
      </Suspense>
      <Suspense fallback={<BottomNavBar active="" />}>
        <BottomNav />
      </Suspense>
    </>
  );
}

export function BottomNav({ current, ...props }: NavProps) {
  const pathname = usePathname();
  return <BottomNavBar active={current ?? pathname} {...props} />;
}

export function SideNav({ current, ...props }: NavProps) {
  const pathname = usePathname();
  return <SideNavBar active={current ?? pathname} {...props} />;
}

// Barre du bas sur téléphone : quatre gros onglets, la pastille glisse vers l'onglet touché.
// `demo` : affichée dans la page /design, dans le flux et non collée en bas de l'écran.
function BottomNavBar({ active, demo = false, onSelect }: Omit<NavProps, "current"> & { active: string }) {
  return (
    <nav
      aria-label={demo ? "Exemple de navigation" : "Navigation principale"}
      className={cn(
        "z-40 rounded-[1.75rem] border border-border/80 bg-card/95 p-1.5 shadow-lift backdrop-blur-md",
        demo ? "relative" : "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden",
      )}
    >
      <ul className="grid grid-cols-4">
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
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Barre latérale sur ordinateur (à partir de 1024 px).
function SideNavBar({ active, demo = false, onSelect }: Omit<NavProps, "current"> & { active: string }) {
  return (
    <nav
      aria-label={demo ? "Exemple de navigation latérale" : "Navigation principale"}
      className={cn(
        "flex w-64 flex-col gap-8 border-border/80 px-4 py-6",
        demo ? "relative rounded-3xl border bg-card shadow-soft" : "fixed inset-y-0 left-0 hidden border-r bg-card lg:flex",
      )}
    >
      <Link href="/" className="press self-start rounded-full px-3 py-1">
        <Logo />
      </Link>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const on = isActive(href, active);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                onClick={onSelect && ((event) => (event.preventDefault(), onSelect(href)))}
                className={cn(
                  "press relative flex min-h-12 items-center gap-3 rounded-full px-4 text-base font-semibold",
                  on ? "text-tomato-deep" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {on && (
                  <motion.span
                    layoutId={demo ? "side-pill-demo" : "side-pill"}
                    className="absolute inset-0 rounded-full bg-tomato-soft"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <Icon aria-hidden="true" className="relative size-5.5" strokeWidth={on ? 2.4 : 2} />
                <span className="relative">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
