import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { DAYS } from "@/lib/meal-slots";
import { AuthForm } from "./auth-form";

// Quelques jours cochés : un avant-goût de la grille des repas.
const CHECKED_DAYS = new Set([0, 1, 3, 4, 6]);

function WeekDots() {
  return (
    <div className="flex gap-2" aria-hidden="true">
      {DAYS.map((day, index) => (
        <div key={day.short} className="flex flex-col items-center gap-1">
          <span
            className={`size-8 rounded-full border-2 ${
              CHECKED_DAYS.has(index) ? "border-rim bg-rim" : "border-control bg-tray"
            }`}
          />
          <span className="text-sm font-bold text-ink-soft">{day.short[0]}</span>
        </div>
      ))}
    </div>
  );
}

const MODES = [
  { mode: "connexion", href: "/connexion", label: "Se connecter" },
  { mode: "inscription", href: "/connexion/inscription", label: "Créer un compte" },
] as const;

// Le logo est dans le header : le titre accueille.
const TITLES = {
  connexion: { title: "Content de te revoir", lead: "Ta semaine de repas t’attend." },
  inscription: { title: "Crée ton compte", lead: "Les repas de la semaine, sans prise de tête." },
} as const;

export function AuthPage({ mode }: { mode: "connexion" | "inscription" }) {
  return (
    <div data-site>
      <main className="mx-auto w-full max-w-md px-4 pt-10 pb-16">
        <WeekDots />
        <h1 className="mt-6 text-[2.5rem] leading-[1.05]">{TITLES[mode].title}</h1>
        <p className="lead">{TITLES[mode].lead}</p>

        <nav aria-label="Compte" className="mt-10 grid grid-cols-2 gap-1 rounded-full bg-rim-pale p-1">
          {MODES.map((item) => (
            <Link
              key={item.mode}
              href={item.href}
              aria-current={item.mode === mode ? "page" : undefined}
              className={`flex min-h-12 items-center justify-center rounded-full px-3 text-base font-bold ${
                item.mode === mode ? "bg-rim text-white" : "text-rim-deep"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8">
          <AuthForm key={mode} mode={mode} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
