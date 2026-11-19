"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { DateTone } from "@/lib/fridge-items";

export type FridgeRowItem = {
  id: string;
  label: string;
  quantity: string;
  date: { text: string; tone: DateTone } | null;
  // En plus de la date : « semaine du 23 nov. ».
  note?: string;
};

const TONES: Record<DateTone, string> = {
  expired: "font-semibold text-tomato-deep",
  soon: "font-semibold text-mustard-deep",
  ok: "text-muted-foreground",
};

// Une ligne du frigo : toute la ligne ouvre le panneau de l'article ; « Fini » (48 px) le sort du
// frigo, et la ligne s'en va en glissant.
export function FridgeItemRow({ item, onOpen, onFinish }: { item: FridgeRowItem; onOpen: () => void; onFinish: () => void }) {
  const details: ReactNode[] = [];
  if (item.date) details.push(<span key="date" className={TONES[item.date.tone]}>{item.date.text}</span>);
  if (item.note) details.push(<span key="note">{item.note}</span>);

  return (
    <motion.li
      layout="position"
      exit={{ opacity: 0, x: 56, transition: { duration: 0.22 } }}
      transition={{ type: "spring", stiffness: 500, damping: 42 }}
      className="flex items-center gap-2 border-b border-border/70 last:border-b-0"
    >
      <button
        type="button"
        onClick={onOpen}
        className="press flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl py-2 pr-1 pl-1 text-left outline-offset-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[1.0625rem] leading-snug font-semibold break-words">{item.label}</span>
          {details.length > 0 && (
            <span className="block text-[0.875rem] text-muted-foreground">
              {details.map((detail, index) => (
                <span key={index}>
                  {index > 0 && " · "}
                  {detail}
                </span>
              ))}
            </span>
          )}
        </span>
        {item.quantity && <span className="text-right font-semibold whitespace-nowrap tabular-nums">{item.quantity}</span>}
      </button>
      <Button type="button" variant="secondary" size="icon" aria-label={`Fini : ${item.label}`} onClick={onFinish} className="text-[0.9375rem]">
        Fini
      </Button>
    </motion.li>
  );
}
