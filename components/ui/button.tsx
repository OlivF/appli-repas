import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Boutons ronds, au moins 44 px de haut, qui « rebondissent » au toucher (utilitaire press).
// Le bouton principal a toujours un libellé gros et gras : blanc sur tomate = 3,7:1, assez
// pour du texte de 19 px en gras (WCAG AA, grand texte), pas pour du petit texte.
const buttonVariants = cva(
  "press inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 border-transparent text-center leading-tight whitespace-nowrap outline-none select-none disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-[1.1875rem] font-bold text-primary-foreground shadow-soft hover:bg-primary-hover",
        secondary:
          "border-border bg-card text-base font-semibold text-foreground shadow-soft hover:border-input/50 hover:bg-muted",
        outline:
          "border-link bg-transparent text-base font-semibold text-link hover:bg-tomato-soft",
        ghost: "text-base font-semibold text-link hover:bg-muted",
        destructive:
          "bg-transparent text-base font-semibold text-destructive hover:bg-destructive/10",
        link: "min-h-11 rounded-md px-1 text-base font-semibold text-link underline decoration-2 underline-offset-4 hover:decoration-link/40",
      },
      size: {
        default: "min-h-12 px-6 py-2",
        lg: "min-h-14 px-8 py-3",
        sm: "min-h-11 px-4 py-1.5",
        icon: "size-12",
        "icon-sm": "size-11",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [{ variant: "link", className: "min-h-11 px-1 py-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
      block: false,
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  block = false,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, block, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
