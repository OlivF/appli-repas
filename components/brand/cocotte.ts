// Le logo de Popote : une cocotte ronde vue de face, dont la vapeur dessine un cœur.
// Dessiné à la main sur une grille de 32 unités (à 16 px, une unité = un demi-pixel : aucun
// détail sous 2 unités). Deux couleurs : tomate (corps, anses, cœur) et brun (couvercle) ;
// sur fond sombre, le brun devient crème.
//
// Module sans dépendance ni JSX : le composant <Logo> le lit, et le script
// scripts/brand-icons.mjs aussi (Node lit le TypeScript) pour écrire les icônes.

export type CocottePart = { d: string; color: "tomato" | "brown" };

export const BRAND_COLORS = {
  tomato: "#e4572e",
  brown: "#2b2118",
  cream: "#f6eee3",
  // Fond des pages (crème) et fond sombre (chocolat).
  paper: "#fbf7f0",
  chocolate: "#1e1611",
  // Cocotte crème sur la tuile tomate.
  tile: "#fffdf9",
} as const;

const n = (value: number) => +value.toFixed(2);

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  const sx = n(w - 2 * r);
  const sy = n(h - 2 * r);
  return (
    `M${n(x + r)} ${y}h${sx}a${r} ${r} 0 0 1 ${r} ${r}v${sy}a${r} ${r} 0 0 1 ${-r} ${r}` +
    `h${-sx}a${r} ${r} 0 0 1 ${-r} ${-r}v${-sy}a${r} ${r} 0 0 1 ${r} ${-r}Z`
  );
}

export const COCOTTE_PARTS: readonly CocottePart[] = [
  // Le cœur de vapeur.
  {
    d: "M16 9C13.3 7.1 11 5.5 11 3.6C11 2.1 12.2 1 13.6 1C14.7 1 15.6 1.9 16 3.1C16.4 1.9 17.3 1 18.4 1C19.8 1 21 2.1 21 3.6C21 5.5 18.7 7.1 16 9Z",
    color: "tomato",
  },
  // Le couvercle : un dôme posé sur un rebord arrondi.
  { d: "M7.5 13.6C8.6 12 11.8 11.2 16 11.2S23.4 12 24.5 13.6Z", color: "brown" },
  { d: roundRect(4, 13, 24, 3.5, 1.75), color: "brown" },
  // Le corps : bord droit en haut, fond bien rond.
  { d: "M7 18.5H25a1 1 0 0 1 1 1V22.5C26 26.6 22.6 30 18.5 30H13.5C9.4 30 6 26.6 6 22.5V19.5a1 1 0 0 1 1-1Z", color: "tomato" },
  // Les anses.
  { d: roundRect(2.5, 19.5, 4.5, 3, 1.5), color: "tomato" },
  { d: roundRect(25, 19.5, 4.5, 3, 1.5), color: "tomato" },
];

// La cocotte en SVG autonome (favicon, images générées). `darkBrown` : couleur du couvercle
// quand le navigateur est en mode sombre (onglet sombre), là où le brun ne se verrait plus.
export function cocotteSvg({
  tomato,
  brown,
  darkBrown,
  size,
}: {
  tomato: string;
  brown: string;
  darkBrown?: string;
  size?: number;
}) {
  const style = darkBrown ? `<style>@media (prefers-color-scheme: dark){.brown{fill:${darkBrown}}}</style>` : "";
  const dimensions = size ? ` width="${size}" height="${size}"` : "";
  const paths = COCOTTE_PARTS.map(
    (part) => `<path class="${part.color}" fill="${part.color === "tomato" ? tomato : brown}" d="${part.d}"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"${dimensions}>${style}${paths}</svg>\n`;
}

// L'icône d'appli : la cocotte crème au centre d'une tuile tomate. `radius` en part de la taille
// (0 : carré plein, pour iOS qui arrondit lui-même).
export function tileSvg({ size, radius, scale = 0.62 }: { size: number; radius: number; scale?: number }) {
  const mark = size * scale;
  const offset = n((size - mark) / 2);
  const paths = COCOTTE_PARTS.map((part) => `<path d="${part.d}"/>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="${n(size * radius)}" fill="${BRAND_COLORS.tomato}"/>` +
    `<g transform="translate(${offset} ${offset}) scale(${n(mark / 32)})" fill="${BRAND_COLORS.tile}">${paths}</g>` +
    `</svg>`
  );
}
