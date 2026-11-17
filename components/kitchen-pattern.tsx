import {
  Apple,
  Carrot,
  Cherry,
  CookingPot,
  Croissant,
  Egg,
  Fish,
  Salad,
  Soup,
  Utensils,
  Wheat,
  Citrus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";

// Motif culinaire au trait : douze ustensiles et ingrédients semés sur une tuile qui se répète.
const TILE = 240;
const ITEMS: { Icon: LucideIcon; x: number; y: number; r: number; s: number }[] = [
  { Icon: Carrot, x: 18, y: 16, r: -18, s: 38 },
  { Icon: Cherry, x: 104, y: 6, r: 12, s: 30 },
  { Icon: Utensils, x: 178, y: 26, r: -8, s: 34 },
  { Icon: Egg, x: 62, y: 74, r: 20, s: 28 },
  { Icon: Soup, x: 136, y: 78, r: -6, s: 40 },
  { Icon: Wheat, x: 10, y: 120, r: 14, s: 34 },
  { Icon: Croissant, x: 88, y: 136, r: -14, s: 36 },
  { Icon: Citrus, x: 196, y: 124, r: 22, s: 28 },
  { Icon: Fish, x: 150, y: 168, r: -20, s: 36 },
  { Icon: CookingPot, x: 32, y: 190, r: 6, s: 34 },
  { Icon: Apple, x: 104, y: 202, r: 16, s: 26 },
  { Icon: Salad, x: 202, y: 200, r: -10, s: 30 },
];

// Un seul motif par page : son identifiant SVG est fixe.
export function KitchenPattern({ className }: { className?: string }) {
  const id = "kitchen-pattern";
  return (
    <svg aria-hidden="true" className={cn("absolute inset-0 size-full", className)}>
      <defs>
        <pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          {ITEMS.map(({ Icon, x, y, r, s }, index) => (
            <g key={index} transform={`rotate(${r} ${x + s / 2} ${y + s / 2})`}>
              <Icon x={x} y={y} width={s} height={s} strokeWidth={1.4} />
            </g>
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
