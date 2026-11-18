import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

// Trois pistes de logo pour Popote, dessinées à la main sur une grille de 32 unités
// (16 px = 2 unités par pixel : aucun détail sous 2 unités, sinon il disparaît à 16 px).
// Deux couleurs au plus : tomate et brun ; en mode sombre, le brun devient crème (foreground).
// Les creux (assiette, jours du calendrier) sont percés (evenodd) : le fond passe au travers,
// quel qu'il soit.

const n = (value: number) => +value.toFixed(2);

function circle(cx: number, cy: number, r: number) {
  return `M${n(cx - r)} ${cy}a${r} ${r} 0 1 0 ${n(2 * r)} 0a${r} ${r} 0 1 0 ${n(-2 * r)} 0Z`;
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  const sx = n(w - 2 * r);
  const sy = n(h - 2 * r);
  return (
    `M${n(x + r)} ${y}h${sx}a${r} ${r} 0 0 1 ${r} ${r}v${sy}a${r} ${r} 0 0 1 ${-r} ${r}` +
    `h${-sx}a${r} ${r} 0 0 1 ${-r} ${-r}v${-sy}a${r} ${r} 0 0 1 ${r} ${-r}Z`
  );
}

type Part = { d: string; color: "tomato" | "brown" };

// Corps de cocotte : bord droit en haut (coins de 1), fond bien rond.
function potBody(top: number) {
  return `M7 ${top}H25a1 1 0 0 1 1 1V22.5C26 26.6 22.6 30 18.5 30H13.5C9.4 30 6 26.6 6 22.5V${top + 1}a1 1 0 0 1 1-1Z`;
}

function potHandles(y: number): Part[] {
  return [
    { d: roundRect(2.5, y, 4.5, 3, 1.5), color: "tomato" },
    { d: roundRect(25, y, 4.5, 3, 1.5), color: "tomato" },
  ];
}

// A : la cocotte ronde, vue de face ; la vapeur dessine un cœur.
const COCOTTE: Part[] = [
  {
    d: "M16 9C13.3 7.1 11 5.5 11 3.6C11 2.1 12.2 1 13.6 1C14.7 1 15.6 1.9 16 3.1C16.4 1.9 17.3 1 18.4 1C19.8 1 21 2.1 21 3.6C21 5.5 18.7 7.1 16 9Z",
    color: "tomato",
  },
  { d: "M7.5 13.6C8.6 12 11.8 11.2 16 11.2S23.4 12 24.5 13.6Z", color: "brown" },
  { d: roundRect(4, 13, 24, 3.5, 1.75), color: "brown" },
  { d: potBody(18.5), color: "tomato" },
  ...potHandles(19.5),
];

// B : un « P » arrondi ; la boucle est une assiette (large fond, fin sillon, bord), le jambage
// une fourchette.
const ASSIETTE: Part[] = [
  { d: [circle(20.25, 12, 10.25), circle(20.25, 12, 8.3), circle(20.25, 12, 6.9)].join(""), color: "tomato" },
  { d: roundRect(1, 2, 1.9, 7, 0.95), color: "brown" },
  { d: roundRect(3.8, 2, 1.9, 7, 0.95), color: "brown" },
  { d: roundRect(6.6, 2, 1.9, 7, 0.95), color: "brown" },
  { d: "M1 7.5H8.5V8.6C8.5 10.8 7 12.3 4.75 12.3S1 10.8 1 8.6Z", color: "brown" },
  { d: roundRect(3.1, 10, 3.3, 20, 1.65), color: "brown" },
];

// C : la cocotte dont le couvercle est un calendrier (anneaux, bandeau), les jours percés dans le corps.
const DAYS = [0, 1, 2].flatMap((col) => [0, 1].map((row) => roundRect(9.3 + col * 5, 16.8 + row * 5, 3.4, 3.4, 1)));
const CALENDRIER: Part[] = [
  { d: roundRect(9.5, 2, 3, 7, 1.5), color: "brown" },
  { d: roundRect(19.5, 2, 3, 7, 1.5), color: "brown" },
  { d: roundRect(4, 6.5, 24, 6, 2.5), color: "brown" },
  { d: potBody(14.5) + DAYS.join(""), color: "tomato" },
  ...potHandles(16),
];

type Tone = "color" | "mono";

function Mark({ parts, tone, className }: { parts: Part[]; tone: Tone; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("shrink-0", className)}>
      {parts.map((part, index) => (
        <path
          key={index}
          d={part.d}
          fillRule="evenodd"
          className={tone === "mono" ? "fill-current" : part.color === "tomato" ? "fill-primary" : "fill-foreground"}
        />
      ))}
    </svg>
  );
}

export const LOGO_OPTIONS = [
  {
    id: "cocotte",
    letter: "A",
    name: "La cocotte au cœur",
    idea: "Une cocotte ronde vue de face ; la vapeur qui s’en échappe dessine un cœur.",
    parts: COCOTTE,
  },
  {
    id: "assiette",
    letter: "B",
    name: "Le P assiette",
    idea: "Un P arrondi : la boucle est une assiette, le jambage une fourchette.",
    parts: ASSIETTE,
  },
  {
    id: "calendrier",
    letter: "C",
    name: "La cocotte calendrier",
    idea: "Une cocotte dont le couvercle est un calendrier, avec ses anneaux : clin d’œil au planning.",
    parts: CALENDRIER,
  },
] as const;

function Wordmark({ parts, tone, className }: { parts: Part[]; tone: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark parts={parts} tone={tone} className="size-10" />
      <span className="font-heading text-[1.875rem] leading-none">Popote</span>
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2.5">
      <p className="text-[0.875rem] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

// Une carte par piste : l'icône en grand, puis ses déclinaisons. Sur ordinateur, les rangées
// des trois cartes s'alignent (sous-grille).
export function LogoOptions() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {LOGO_OPTIONS.map((option) => (
        <article
          key={option.id}
          aria-labelledby={`logo-${option.id}`}
          className="grid gap-6 rounded-2xl border border-border/70 bg-card p-5 shadow-soft lg:row-span-7 lg:grid-rows-subgrid"
        >
          <div className="grid place-items-center rounded-xl bg-muted py-8">
            <Mark parts={option.parts} tone="color" className="size-28" />
          </div>
          <div>
            <Badge variant="tomato">Piste {option.letter}</Badge>
            <h3 id={`logo-${option.id}`} className="mt-2 text-[1.375rem] leading-tight">
              {option.name}
            </h3>
            <p className="mt-1 text-[0.9375rem] text-muted-foreground">{option.idea}</p>
          </div>

          <Row label="Icône seule : 16, 32 et 64 px">
            <div className="flex items-end gap-5">
              <Mark parts={option.parts} tone="color" className="size-4" />
              <Mark parts={option.parts} tone="color" className="size-8" />
              <Mark parts={option.parts} tone="color" className="size-16" />
            </div>
          </Row>

          <Row label="Dans un onglet du navigateur">
            <div className="flex max-w-56 items-center gap-2 rounded-t-xl bg-muted px-3 py-2 text-[0.8125rem]">
              <Mark parts={option.parts} tone="color" className="size-4" />
              <span className="truncate">La semaine · Popote</span>
            </div>
          </Row>

          <Row label="Logo horizontal">
            <Wordmark parts={option.parts} tone="color" />
          </Row>

          <Row label="Monochrome">
            <div className="grid gap-2">
              <div className="rounded-xl bg-[#fbf7f0] px-4 py-3.5 text-[#2b2118] ring-1 ring-border/60">
                <Wordmark parts={option.parts} tone="mono" />
              </div>
              <div className="rounded-xl bg-[#1e1611] px-4 py-3.5 text-[#f6eee3]">
                <Wordmark parts={option.parts} tone="mono" />
              </div>
            </div>
          </Row>

          <Row label="Sur l’écran d’accueil du téléphone">
            <div className="flex items-end gap-4">
              <span className="grid size-16 place-items-center rounded-[1.125rem] bg-tomato text-[#fffdf9] shadow-soft">
                <Mark parts={option.parts} tone="mono" className="size-11" />
              </span>
              <span className="grid size-10 place-items-center rounded-[0.7rem] bg-tomato text-[#fffdf9] shadow-soft">
                <Mark parts={option.parts} tone="mono" className="size-7" />
              </span>
            </div>
          </Row>
        </article>
      ))}
    </div>
  );
}
