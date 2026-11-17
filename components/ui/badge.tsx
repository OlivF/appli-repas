import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Pastilles d'information : fond doux et texte foncé de la même couleur (≥ 4,5:1).
const badgeVariants = cva(
  "inline-flex h-7 w-fit shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-[0.875rem] leading-none font-semibold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        tomato: "bg-tomato-soft text-tomato-deep",
        sage: "bg-sage-soft text-sage-deep",
        mustard: "bg-mustard-soft text-mustard-deep",
        plum: "bg-plum-soft text-plum-deep",
        oat: "bg-oat-soft text-oat-deep",
        outline: "border border-border bg-card text-foreground",
      },
    },
    defaultVariants: {
      variant: "oat",
    },
  }
)

function Badge({
  className,
  variant = "oat",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
