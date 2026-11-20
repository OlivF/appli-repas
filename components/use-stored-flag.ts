"use client";

import { useCallback, useSyncExternalStore } from "react";

// Un oui/non retenu par l'appareil : `local` (jusqu'à ce qu'on vide le navigateur) ou `session`
// (le temps de l'onglet). Sans stockage (navigation privée), retenu le temps de la visite.
// `serverValue` : la valeur du rendu serveur, la plus probable, pour que rien ne saute à
// l'arrivée (un encart déjà fermé : oui ; « Plus tard », rare : non).
const listeners = new Set<() => void>();
const memory = new Set<string>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function storageOf(kind: "local" | "session") {
  return kind === "local" ? window.localStorage : window.sessionStorage;
}

function read(kind: "local" | "session", key: string) {
  if (memory.has(`${kind}:${key}`)) return true;
  try {
    return storageOf(kind).getItem(key) === "1";
  } catch {
    return false;
  }
}

export function useStoredFlag(kind: "local" | "session", key: string, serverValue: boolean): [boolean, () => void] {
  const flag = useSyncExternalStore(
    subscribe,
    () => read(kind, key),
    () => serverValue,
  );
  const set = useCallback(() => {
    memory.add(`${kind}:${key}`);
    try {
      storageOf(kind).setItem(key, "1");
    } catch {
      // Navigation privée : retenu pour la visite seulement.
    }
    listeners.forEach((listener) => listener());
  }, [kind, key]);
  return [flag, set];
}
