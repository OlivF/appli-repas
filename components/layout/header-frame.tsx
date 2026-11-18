"use client";

import { useEffect, useState, type ReactNode } from "react";

// Le cadre du header : collant en haut, crème translucide avec flou. Une ombre fine apparaît
// dès que la page défile, pour détacher le header du contenu qui passe dessous.
// Largeur : celle des écrans de l'appli (jusqu'à la grille de la semaine) ; sur les pages
// publiques (marquées `data-site`), celle de leur contenu, pour que le logo s'aligne dessus.
// Next garde les pages déjà visitées, cachées (style « display: none ») : seul compte le
// marqueur d'une page visible.
export function HeaderFrame({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 2);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-lg backdrop-saturate-150 transition-[border-color,box-shadow] duration-200 data-scrolled:border-border/60 data-scrolled:shadow-bar"
    >
      <div className="mx-auto flex h-(--header-height) max-w-[100rem] items-center gap-8 px-5 sm:px-8 [body:has([data-site]:not([style*=none]))_&]:max-w-6xl">{children}</div>
    </header>
  );
}
