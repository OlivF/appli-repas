// Les étapes d'une recette, numérotées dans une pastille tomate.
export function RecipeSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-5">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-4">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-tomato-soft font-heading text-lg text-tomato-deep"
          >
            {index + 1}
          </span>
          <p className="max-w-[60ch] pt-1">{step}</p>
        </li>
      ))}
    </ol>
  );
}
