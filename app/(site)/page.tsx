import Link from "next/link";
import type { ReactNode } from "react";
import { CookingPot, Egg, Heart, Sandwich, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { DietBadge } from "@/components/diet-badge";
import { BasketIllustration } from "@/components/illustrations";
import { KitchenPattern } from "@/components/kitchen-pattern";
import { MemberAvatars } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { HeroWeek } from "./hero-week";
import { LANDING_FAMILY } from "./landing-data";
import { SwapCardDemo } from "./swap-card-demo";

// La page d'accueil, pour les visiteurs. Un compte connecté n'y arrive jamais : le proxy l'envoie
// vers sa semaine (lib/routes.ts).
export default function HomePage() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <ForRealFamilies />
      <FinalCall />
    </main>
  );
}

function SignUpButton({ variant }: { variant?: "secondary" }) {
  return (
    <Button asChild size="lg" variant={variant}>
      <Link href="/connexion/inscription">Créer mon compte gratuit</Link>
    </Button>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-8 pb-16 sm:px-8 sm:pt-14 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pt-20 lg:pb-24">
      <div>
        <h1 className="max-w-[13ch] text-[2.75rem] leading-[1.02] sm:text-[3.75rem] lg:text-[4.25rem]">
          Les repas de la semaine, sans prise de tête.
        </h1>
        <p className="mt-6 max-w-[36ch] text-lg text-muted-foreground sm:text-xl">
          Dis qui mange à la maison. Popote propose les repas de la semaine, adaptés à chacun, et
          prépare la liste de courses.
        </p>
        <div className="mt-8">
          <SignUpButton />
        </div>
      </div>
      <HeroWeek />
    </section>
  );
}

const STEPS: { title: string; text: string; visual: ReactNode }[] = [
  {
    title: "Présente ta famille",
    text: "Qui mange à la maison, à quels repas, et les régimes de chacun.",
    visual: (
      <div className="flex flex-col items-center gap-3">
        <MemberAvatars members={LANDING_FAMILY} size="lg" decorative />
        <DietBadge diet="keto" />
      </div>
    ),
  },
  {
    title: "Popote propose la semaine",
    text: "Un plat par repas, qui convient à ceux qui sont à table. Tu échanges les cartes d’un glisser.",
    visual: <SwapCardDemo />,
  },
  {
    title: "La liste de courses se fait toute seule",
    text: "Les quantités suivent le nombre de convives, rangées par rayon : prête pour le drive.",
    visual: <BasketIllustration className="w-40" />,
  },
];

function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="bg-muted/70 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 id="how-title" className="text-[2.25rem] leading-tight sm:text-[2.75rem]">
          Comment ça marche
        </h2>
        <ol className="mt-10 grid gap-5 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft">
              {/* L'illustration d'abord, à hauteur égale pour les trois étapes. */}
              <div className="grid h-48 place-items-center bg-background px-6">{step.visual}</div>
              <div className="p-6">
                <span className="grid size-10 place-items-center rounded-full bg-tomato-soft font-heading text-lg text-tomato-deep">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-[1.5rem] leading-tight">{step.title}</h3>
                <p className="mt-2 text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Chaque point garde la couleur de son sujet dans l'appli : prune pour le céto, sauge pour
// « à l'avance », moutarde pour les repas à emporter, tomate pour les favoris.
const FAMILY_POINTS: { title: string; text: string; icon: LucideIcon; tint: string; ink: string }[] = [
  {
    title: "Un régime par personne",
    text: "Camille mange céto ? Popote choisit d’abord des plats qui conviennent à tous : pas besoin de cuisiner pour chacun.",
    icon: Egg,
    tint: "bg-plum-soft/70",
    ink: "text-plum-deep",
  },
  {
    title: "Le batch cooking du dimanche",
    text: "Les recettes qui se préparent à l’avance sont repérées : tu cuisines le dimanche, tu réchauffes en semaine.",
    icon: CookingPot,
    tint: "bg-sage-soft/70",
    ink: "text-sage-deep",
  },
  {
    title: "Midis à emporter et pique-niques",
    text: "Une boîte pour le bureau, un pique-nique le mercredi : des recettes rapides, faciles à emporter.",
    icon: Sandwich,
    tint: "bg-mustard-soft/70",
    ink: "text-mustard-deep",
  },
  {
    title: "Les recettes favorites de la famille",
    text: "Un cœur sur vos plats préférés, et ils reviennent plus souvent dans la semaine.",
    icon: Heart,
    tint: "bg-tomato-soft/70",
    ink: "text-tomato-deep",
  },
];

function ForRealFamilies() {
  return (
    <section aria-labelledby="families-title" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <h2 id="families-title" className="text-[2.25rem] leading-tight sm:text-[2.75rem]">
        Pensé pour les vraies familles
      </h2>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {FAMILY_POINTS.map((point) => (
          <li key={point.title} className={cn("flex flex-col gap-4 rounded-3xl p-6 sm:p-7", point.tint)}>
            <span className={cn("grid size-12 place-items-center rounded-2xl bg-card shadow-soft", point.ink)}>
              <point.icon aria-hidden="true" className="size-6" strokeWidth={2.2} />
            </span>
            <div>
              <h3 className="text-[1.375rem] leading-tight">{point.title}</h3>
              <p className="mt-2 max-w-[44ch] text-foreground/80">{point.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Le bandeau final reprend le motif de la page de connexion (voir /design).
function FinalCall() {
  return (
    <section aria-labelledby="final-title" className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 sm:pb-24">
      <div className="relative overflow-hidden rounded-[2rem] bg-tomato text-[#fdeee7] shadow-soft dark:bg-[#5b2617]">
        <KitchenPattern className="opacity-25" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_55%,var(--color-tomato)_20%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_25%_55%,#5b2617_20%,transparent_70%)]"
        />
        <div className="relative flex flex-col items-start gap-8 px-7 py-14 sm:px-12 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="final-title" className="max-w-[18ch] text-[2.25rem] leading-[1.08] text-white sm:text-[3rem]">
              Prêt pour une semaine sans prise de tête ?
            </h2>
            <p className="mt-3 text-lg">C’est gratuit. Il suffit d’un email.</p>
          </div>
          <SignUpButton variant="secondary" />
        </div>
      </div>
    </section>
  );
}
