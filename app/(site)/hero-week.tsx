import type { CSSProperties } from "react";
import { cn } from "cn";
import { MemberAvatars } from "@/components/member-avatar";
import { PlannedMealCard } from "@/components/planned-meal-card";
import { LANDING_DAYS, LANDING_FAMILY, LANDING_MEALS } from "./landing-data";

// D'où arrive chaque carte (décalage en px, inclinaison en degrés) avant de se poser.
const ARRIVALS = [
  { x: 60, y: -70, rotate: -9 },
  { x: 90, y: -30, rotate: 7 },
  { x: 40, y: -90, rotate: 10 },
  { x: 70, y: -40, rotate: -6 },
  { x: 30, y: -110, rotate: -12 },
  { x: 50, y: -60, rotate: 8 },
];

// La carte du mardi soir reste soulevée au-dessus de sa case, penchée, comme tenue au doigt :
// c'est le geste de l'appli, on échange les plats d'un glisser.
const LIFTED = LANDING_MEALS.findIndex((meal) => meal.day === 1 && meal.row === 1);
const LIFTED_POSE = "translate(10px, -14px) rotate(-3deg) scale(1.03)";

// La mise en scène du haut de page : une mini-semaine où de vraies cartes de l'appli viennent se
// poser une à une. Purement décorative (aria-hidden, inert) : le texte à côté dit tout.
// L'animation est en CSS (utilitaire card-land) : elle démarre dès l'affichage, sans attendre le
// JavaScript, et se coupe si le téléphone demande moins d'animations.
// Sur téléphone, deux jours ; trois à partir de 640 px.
export function HeroWeek({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" inert className={cn("relative", className)}>
      <div className="rounded-[2rem] border border-border/70 bg-card p-4 shadow-lift sm:p-5">
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="font-heading text-[1.375rem] leading-tight">Cette semaine</p>
          <MemberAvatars members={LANDING_FAMILY} decorative />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LANDING_DAYS.map((day, index) => (
            <p
              key={day}
              className={cn("px-1 text-[0.9375rem] font-semibold text-muted-foreground", index === 2 && "max-sm:hidden")}
            >
              {day}
            </p>
          ))}
          {[0, 1].flatMap((row) =>
            LANDING_DAYS.map((_, day) => {
              const index = LANDING_MEALS.findIndex((meal) => meal.day === day && meal.row === row);
              const meal = LANDING_MEALS[index];
              const from = ARRIVALS[index];
              const lifted = index === LIFTED;
              // La carte soulevée arrive en dernier.
              const order = lifted ? LANDING_MEALS.length : index - (index > LIFTED ? 1 : 0);
              const style = {
                "--from-x": `${from.x}px`,
                "--from-y": `${from.y}px`,
                "--from-r": `${from.rotate}deg`,
                "--delay": `${250 + order * 130}ms`,
                transform: lifted ? LIFTED_POSE : undefined,
              } as CSSProperties;
              return (
                <div
                  key={`${row}-${day}`}
                  className={cn(
                    "relative rounded-2xl border-2 border-dashed",
                    lifted ? "z-10 border-primary/45 bg-tomato-soft/40" : "border-border",
                    day === 2 && "max-sm:hidden",
                  )}
                >
                  <div style={style} className="card-land -m-0.5 h-[calc(100%+4px)]">
                    <PlannedMealCard
                      layout="column"
                      recipe={meal.recipe}
                      eaters={meal.eaters}
                      locked={false}
                      showMeal
                      dragState={lifted ? "lifted" : undefined}
                      className="h-full"
                    />
                  </div>
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
