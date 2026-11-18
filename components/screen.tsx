import type { ReactNode } from "react";

// Cadre du parcours /bienvenue : colonne étroite, pensée pour le téléphone. Le logo est dans
// le header.
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-8 pb-12">
      <main>{children}</main>
    </div>
  );
}

// Parcours de création du foyer : « Étape 2 sur 3 » et sa barre.
export function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mb-4">
      <p className="text-base font-bold text-ink-soft">Étape {step} sur 3</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-1.5 rounded-full ${index <= step ? "bg-rim" : "bg-rim-pale"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function Loading() {
  return (
    <p role="status" className="text-ink-soft">
      Chargement…
    </p>
  );
}
