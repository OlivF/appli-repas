"use client";

import { useSyncExternalStore } from "react";

// Vrai quand la requête média correspond (faux au rendu serveur, puis mis à jour).
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
