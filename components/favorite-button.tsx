"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

// Le cœur des favoris : il se remplit de tomate et rebondit quand on le touche.
export function FavoriteButton({
  on,
  onToggle,
  pending = false,
  className,
}: {
  on: boolean;
  onToggle: (on: boolean) => void;
  pending?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-pressed={on}
      aria-label="Favori"
      aria-busy={pending || undefined}
      onClick={() => onToggle(!on)}
      className={cn(on && "border-primary/40 bg-tomato-soft hover:bg-tomato-soft", className)}
    >
      <motion.span
        key={String(on)}
        initial={on ? { scale: 0.5 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 14 }}
        className="grid place-items-center"
      >
        <Heart aria-hidden="true" className={cn("size-5.5", on ? "fill-primary text-primary" : "text-muted-foreground")} />
      </motion.span>
    </Button>
  );
}
