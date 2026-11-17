import * as React from "react"
import { cn } from "cn"

// Zone de texte sur plusieurs lignes : même contour et même focus que les champs.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-28 w-full min-w-0 resize-y rounded-lg border-2 border-input bg-card px-4 py-3 text-[1.0625rem] leading-relaxed text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
