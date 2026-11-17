import Link from "next/link";
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

export function AuthPage({ mode }: { mode: "connexion" | "inscription" }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-10 pb-12">
      <WeekDots />
      <h1 className="mt-6 text-[2.5rem] leading-none font-extrabold tracking-tight">Nos repas</h1>
      <p className="lead">Le menu de la semaine, pour toute la famille.</p>

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
  );
}
