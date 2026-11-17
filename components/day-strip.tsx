"use client";

import { motion } from "framer-motion";
import { cn } from "cn";

// Les sept jours en haut de l'écran sur téléphone : le jour affiché est surligné,
// toucher un autre jour y amène.
export function DayStrip({
  days,
  active,
  onSelect,
  layoutId = "day-strip-pill",
  className,
}: {
  days: { short: string; long: string; date: string }[];
  active: number;
  onSelect: (day: number) => void;
  // Unique par barre affichée (la page /design en montre une de plus).
  layoutId?: string;
  className?: string;
}) {
  return (
    <nav aria-label="Jours de la semaine" className={className}>
      <ul className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const on = index === active;
          return (
            <li key={day.short}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${day.long} ${day.date}`}
                onClick={() => onSelect(index)}
                className={cn(
                  "press relative flex min-h-14 w-full flex-col items-center justify-center rounded-2xl text-[0.8125rem] font-semibold outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  on ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {on && (
                  <motion.span
                    layoutId={layoutId}
                    className="absolute inset-0 rounded-2xl bg-primary shadow-soft"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{day.short}</span>
                <span className={cn("relative text-[1.0625rem] font-bold", !on && "text-foreground")}>{day.date}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
