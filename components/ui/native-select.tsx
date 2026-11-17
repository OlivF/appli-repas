import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"

// Liste de choix : le <select> du navigateur, habillé comme les champs. Sur téléphone,
// il ouvre le sélecteur du système, plus confortable au pouce qu'un menu dessiné.
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div data-slot="native-select" className={cn("relative min-w-0", className)}>
      <select
        className="h-13 w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border-2 border-input bg-card pr-10 pl-4 text-[1.0625rem] text-foreground transition-[border-color,box-shadow] outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

export { NativeSelect }
