"use client";

import { Check, Ellipsis } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// « 200 g + 2 c. à soupe » : chaque morceau reste d'un bloc ; la ligne ne se coupe qu'après « + ».
function unbreakableParts(quantity: string) {
  return quantity
    .split(" + ")
    .map((part) => part.replace(/ /g, "\u00a0"))
    .join(" + ");
}

// La case d'une ligne (liste de courses, rangement au frigo) : la ligne entière la coche.
export function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-sm border-2 transition-colors",
        checked ? "border-sage bg-sage text-white" : "border-input bg-card",
      )}
    >
      {checked && <Check className="size-4.5" strokeWidth={3.5} />}
    </span>
  );
}

export type RowItem = {
  id: string;
  label: string;
  quantity: string;
  checked: boolean;
  quantityChanged: boolean;
  // Le frigo : « + 200 g au frigo », « Tu en as peut-être au frigo ».
  note?: string | null;
};

// Une ligne de la liste : toute la ligne coche ou décoche (cible ≥ 56 px) ; « … » ouvre le panneau
// de l'article. Coché : barré, et l'article glisse en bas de son rayon (animation de mise en page).
export function ShoppingItemRow({ item, onToggle, onMore }: { item: RowItem; onToggle: () => void; onMore: () => void }) {
  return (
    <motion.li
      layout="position"
      transition={{ type: "spring", stiffness: 500, damping: 42 }}
      className="flex items-center gap-1 border-b border-border/70 last:border-b-0"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        onClick={onToggle}
        className="press flex min-h-14 min-w-0 flex-1 items-center gap-3.5 rounded-2xl py-2 pr-2 pl-1 text-left outline-offset-2"
      >
        <CheckMark checked={item.checked} />
        <span className="min-w-[40%] flex-1">
          <span
            className={cn(
              "block text-[1.0625rem] leading-snug font-semibold break-words",
              item.checked && "text-muted-foreground line-through decoration-2",
            )}
          >
            {item.label}
          </span>
          {item.quantityChanged && !item.checked && (
            <span className="block text-[0.875rem] font-semibold text-mustard-deep">quantité modifiée</span>
          )}
          {item.note && <span className="block text-[0.875rem] text-muted-foreground">{item.note}</span>}
        </span>
        {item.quantity && (
          <span className={cn("text-right font-semibold tabular-nums", item.checked && "text-muted-foreground line-through")}>
            {unbreakableParts(item.quantity)}
          </span>
        )}
      </button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Plus sur ${item.label}`} onClick={onMore} className="text-muted-foreground">
        <Ellipsis aria-hidden="true" />
      </Button>
    </motion.li>
  );
}

// Placard : à vérifier avant de commander ; toucher la ligne la passe dans la liste.
export function PantryItemRow({ label, note, onNeeded }: { label: string; note: string; onNeeded: () => void }) {
  return (
    <li className="border-b border-border/70 last:border-b-0">
      <button
        type="button"
        aria-label={`Il n'en reste plus : ${label}`}
        onClick={onNeeded}
        className="press flex min-h-14 w-full items-center gap-3 rounded-2xl py-2 pr-1 pl-1 text-left outline-offset-2 hover:bg-muted"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{label}</span>
          <span className="block text-[0.875rem] text-muted-foreground">{note}</span>
        </span>
        <Badge aria-hidden="true" variant="tomato">
          Il n&apos;en reste plus
        </Badge>
      </button>
    </li>
  );
}

// Déjà à la maison : masqué de la liste (« J'en ai déjà », on peut l'y remettre), ou entièrement
// au frigo (« 350 g au frigo »).
export function HomeItemRow({ label, note, onRestore }: { label: string; note?: string | null; onRestore?: () => void }) {
  return (
    <li className="flex min-h-14 items-center gap-3 border-b border-border/70 py-1 last:border-b-0">
      <span className="min-w-0 flex-1 pl-1">
        <span className="block font-semibold text-muted-foreground">{label}</span>
        {note && <span className="block text-[0.875rem] text-muted-foreground">{note}</span>}
      </span>
      {onRestore && (
        <Button type="button" variant="ghost" size="sm" aria-label={`Remettre dans la liste : ${label}`} onClick={onRestore}>
          Remettre dans la liste
        </Button>
      )}
    </li>
  );
}
