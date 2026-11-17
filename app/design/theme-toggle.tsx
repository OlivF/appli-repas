"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// Pour comparer : force le mode sombre ou clair sur toute la page, le temps de la visite.
// L'appli, elle, suit toujours le réglage du téléphone.
export function ThemeToggle() {
  const systemDark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
  const [forced, setForced] = useState<boolean | null>(null);
  const dark = forced ?? systemDark;

  useEffect(() => {
    if (forced === null) return;
    document.documentElement.dataset.theme = forced ? "dark" : "light";
  }, [forced]);

  // En quittant /design, on rend la main au réglage du téléphone.
  useEffect(() => () => document.documentElement.removeAttribute("data-theme"), []);

  return (
    <label className="inline-flex min-h-12 cursor-pointer items-center gap-3 rounded-full border border-border bg-card py-2 pr-2.5 pl-4 font-semibold shadow-soft">
      <Moon aria-hidden="true" className="size-5 text-muted-foreground" />
      Mode sombre
      <Switch checked={dark} onCheckedChange={setForced} />
    </label>
  );
}
