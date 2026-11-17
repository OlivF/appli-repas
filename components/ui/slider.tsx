"use client"

import * as React from "react"
import { cn } from "cn"
import { Slider as SliderPrimitive } from "radix-ui"

// Curseur : rail de 10 px, poignée de 28 px (zone tactile élargie à 44 px), rempli en tomate.
// Se règle aussi aux flèches du clavier.
function Slider({
  className,
  thumbLabel,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  // Nom lu par les lecteurs d'écran sur la poignée.
  thumbLabel?: string
}) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex h-11 w-full touch-none items-center select-none data-[disabled]:opacity-55",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-2.5 grow overflow-hidden rounded-full bg-muted ring-1 ring-border"
      >
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full rounded-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        aria-label={thumbLabel}
        className="relative block size-7 rounded-full border-[3px] border-primary bg-card shadow-soft transition-transform outline-none after:absolute after:-inset-2 hover:scale-105 focus-visible:ring-4 focus-visible:ring-primary/25 active:scale-110 motion-reduce:transition-none"
      />
    </SliderPrimitive.Root>
  )
}

export { Slider }
