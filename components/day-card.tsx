import { cn } from "cn";
import { MealLabel } from "@/components/meal-label";
import { MemberAvatars, type AvatarMember } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import type { MealType } from "@/lib/meal-slots";

export type DayMeal = { type: MealType; members: AvatarMember[] };

// Une journée de la semaine type : chaque repas, et les avatars de ceux qui sont là.
export function DayCard({
  day,
  today = false,
  meals,
  className,
}: {
  day: string;
  today?: boolean;
  meals: DayMeal[];
  className?: string;
}) {
  return (
    <section
      aria-label={today ? `${day}, aujourd’hui` : day}
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-soft",
        today ? "border-primary/60 ring-4 ring-primary/10" : "border-border/70",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl leading-tight first-letter:uppercase">{day}</h3>
        {today && <Badge variant="tomato">Aujourd’hui</Badge>}
      </div>
      <ul className="mt-3 divide-y divide-border/70">
        {meals.map((meal) => (
          <li key={meal.type} className="flex min-h-12 items-center justify-between gap-3 py-2">
            <MealLabel type={meal.type} className="text-base font-medium" />
            <MemberAvatars members={meal.members} />
          </li>
        ))}
      </ul>
    </section>
  );
}
