import Link from "next/link";
import { AlarmClock, ChevronRight } from "lucide-react";

// En haut de /semaine, quand le frigo a des articles à finir vite : « À finir : poulet, crème,
// courgettes ». C'est le lundi, en préparant le menu, que ça sert. Mène au frigo.
export function FridgeStrip({ text }: { text: string }) {
  return (
    <Link
      href="/frigo"
      className="press flex min-h-12 items-center gap-3 rounded-2xl bg-mustard-soft py-2 pr-3 pl-4 font-semibold text-mustard-deep outline-offset-2"
    >
      <AlarmClock aria-hidden="true" className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">{text}</span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
    </Link>
  );
}
