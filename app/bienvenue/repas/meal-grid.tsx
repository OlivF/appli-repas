import { DAYS, MEAL_TYPES, cellKey } from "@/lib/meal-slots";
import { shortNames } from "@/lib/members";

type Props = {
  members: { id: string; first_name: string }[];
  // Cases cochées au départ (voir initialSelection).
  selected: string[];
};

// Un tableau par repas : jours en lignes, membres en colonnes.
export function MealGrid({ members, selected }: Props) {
  const checked = new Set(selected);
  const labels = shortNames(members.map((member) => member.first_name));

  return (
    <div className="space-y-5">
      {MEAL_TYPES.map((meal) => (
        <div
          key={meal.value}
          className="overflow-x-auto rounded-3xl border-2 border-rim-pale bg-tray px-3 pt-3 pb-2"
        >
          <table className="w-full border-separate border-spacing-y-1">
            <caption className="px-1 pb-2 text-left text-xl font-extrabold text-rim">
              {meal.label}
            </caption>
            <thead>
              <tr>
                <td className="w-12" />
                {members.map((member, index) => (
                  <th
                    key={member.id}
                    scope="col"
                    title={member.first_name}
                    className="min-w-12 pb-1 text-center text-sm font-bold text-ink-soft"
                  >
                    {labels[index]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, dayIndex) => (
                <tr key={day.short}>
                  <th scope="row" className="px-1 text-left text-base font-bold">
                    {day.short}
                  </th>
                  {members.map((member) => {
                    const key = cellKey(dayIndex, meal.value, member.id);
                    return (
                      <td key={member.id} className="py-0.5 text-center">
                        <input
                          type="checkbox"
                          name="cells"
                          value={key}
                          defaultChecked={checked.has(key)}
                          aria-label={`${meal.label} ${day.long} : ${member.first_name}`}
                          className="meal-check"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
