"use client";

import { motion } from "framer-motion";

// Parcours /bienvenue : « Étape 2 sur 3 », et la barre qui avance depuis l'étape précédente.
export function StepProgress({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[0.9375rem] font-semibold text-muted-foreground">
        Étape {step} sur {total}
      </p>
      <div aria-hidden="true" className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          initial={{ width: `${((step - 1) / total) * 100}%` }}
          animate={{ width: `${(step / total) * 100}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.15 }}
        />
        {Array.from({ length: total - 1 }, (_, index) => (
          <span
            key={index}
            className="absolute inset-y-0 w-1 bg-background"
            style={{ left: `calc(${((index + 1) / total) * 100}% - 2px)` }}
          />
        ))}
      </div>
    </div>
  );
}
