"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// La liste mémorise sa dernière adresse (recherche et filtres) : le retour la retrouve.
export const LIST_HREF_KEY = "popote:recettes";

function readListHref() {
  const saved = window.sessionStorage.getItem(LIST_HREF_KEY);
  return saved?.startsWith("/recettes") ? saved : "/recettes";
}

export function BackToList() {
  const href = useSyncExternalStore(
    () => () => {},
    readListHref,
    () => "/recettes",
  );
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3">
      <Link href={href}>
        <ArrowLeft aria-hidden="true" />
        Recettes
      </Link>
    </Button>
  );
}
