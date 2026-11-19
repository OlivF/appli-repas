import { cn } from "cn";

// Petites illustrations au trait pour les états vides. Le trait suit la couleur du texte,
// les aplats suivent les couleurs du thème : elles passent en mode sombre sans retouche.
const LINE = "fill-none stroke-foreground [stroke-linecap:round] [stroke-linejoin:round]";

function Frame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 200 150" aria-hidden="true" className={cn("h-auto w-44", className)}>
      {children}
    </svg>
  );
}

function Sparkles() {
  return (
    <g className="fill-mustard">
      <circle cx="28" cy="34" r="3.5" />
      <circle cx="176" cy="104" r="3" />
      <path d="M168 22v12M162 28h12" className="fill-none stroke-mustard [stroke-linecap:round]" strokeWidth="3" />
      <path d="M22 108v9M17.5 112.5h9" className="fill-none stroke-mustard [stroke-linecap:round]" strokeWidth="2.5" />
    </g>
  );
}

// Une assiette vide et ses couverts : « personne à table pour l'instant ».
export function PlateIllustration({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Sparkles />
      <circle cx="100" cy="78" r="50" className="fill-card stroke-foreground" strokeWidth="3" />
      <circle cx="100" cy="78" r="35" className="fill-tomato-soft stroke-foreground" strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" />
      <g className="fill-none stroke-sage-deep [stroke-linecap:round]" strokeWidth="2.5">
        <path d="M84 90c8-9 18-13 30-13" />
      </g>
      <g className="fill-sage">
        <ellipse cx="96" cy="80" rx="7" ry="3.6" transform="rotate(-35 96 80)" />
        <ellipse cx="106" cy="86" rx="7" ry="3.6" transform="rotate(25 106 86)" />
        <ellipse cx="110" cy="74" rx="6" ry="3.2" transform="rotate(-20 110 74)" />
      </g>
      <path className={LINE} strokeWidth="3" d="M34 30v18a6 6 0 0 0 12 0V30M40 30v20M40 54v64" />
      <path className={LINE} strokeWidth="3" d="M163 118V30c9 7 12 22 9 36l-9 3" />
    </Frame>
  );
}

// Une marmite qui mijote : « ça arrive bientôt ».
export function PotIllustration({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Sparkles />
      <g className="fill-none stroke-muted-foreground [stroke-linecap:round]" strokeWidth="2.5">
        <path d="M82 22c-6-5 5-9 0-15" />
        <path d="M100 18c-6-5 5-9 0-15" />
        <path d="M118 22c-6-5 5-9 0-15" />
      </g>
      <path d="M54 56c4-17 21-25 46-25s42 8 46 25Z" className="fill-card stroke-foreground" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="100" cy="28" r="5" className="fill-mustard stroke-foreground" strokeWidth="2.5" />
      <rect x="44" y="55" width="112" height="11" rx="5.5" className="fill-card stroke-foreground" strokeWidth="3" />
      <path d="M52 66h96v40c0 10-8 18-18 18H70c-10 0-18-8-18-18Z" className="fill-tomato stroke-foreground" strokeWidth="3" strokeLinejoin="round" />
      <path d="M64 78v20" className="fill-none stroke-white/45 [stroke-linecap:round]" strokeWidth="4" />
      <path className={LINE} strokeWidth="3" d="M52 78H41a6 6 0 0 0 0 12h11M148 78h11a6 6 0 0 1 0 12h-11" />
      <path d="M40 132h120" className="fill-none stroke-border [stroke-linecap:round]" strokeWidth="4" />
    </Frame>
  );
}

// Un panier du marché : pour la liste de courses.
export function BasketIllustration({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Sparkles />
      <path className={LINE} strokeWidth="3" d="M62 66c0-36 76-36 76 0" />
      <rect x="104" y="20" width="16" height="58" rx="8" transform="rotate(18 112 49)" className="fill-mustard-soft stroke-foreground" strokeWidth="2.5" />
      <path d="M108 34l8-2M106 44l8-2M104 54l8-2" transform="rotate(18 112 49)" className="fill-none stroke-mustard-deep [stroke-linecap:round]" strokeWidth="2" />
      <path d="M78 66 70 34" className="fill-none stroke-sage-deep [stroke-linecap:round]" strokeWidth="3" />
      <path d="M70 34c-8-4-10-12-6-18 6 2 9 9 6 18Zm0 0c2-9 9-13 16-11-1 7-8 12-16 11Z" className="fill-sage" />
      <path d="M84 66 92 40l8 26Z" className="fill-tomato stroke-foreground" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M40 66h120l-13 54a8 8 0 0 1-8 6H61a8 8 0 0 1-8-6Z" className="fill-mustard stroke-foreground" strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 86h100M54 104h92M80 66l4 60M120 66l-4 60M100 66v60" className="fill-none stroke-foreground/35 [stroke-linecap:round]" strokeWidth="2" />
      <rect x="34" y="60" width="132" height="12" rx="6" className="fill-card stroke-foreground" strokeWidth="3" />
    </Frame>
  );
}

// Un carnet de recettes ouvert, avec son signet.
export function BookIllustration({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Sparkles />
      <path d="M100 40c-14-10-34-12-56-8v84c22-4 42-2 56 8Z" className="fill-card stroke-foreground" strokeWidth="3" strokeLinejoin="round" />
      <path d="M100 40c14-10 34-12 56-8v84c-22-4-42-2-56 8Z" className="fill-card stroke-foreground" strokeWidth="3" strokeLinejoin="round" />
      <path d="M134 36v34l7-6 7 6V33" className="fill-tomato stroke-foreground" strokeWidth="2.5" strokeLinejoin="round" />
      <g className="fill-none stroke-foreground/35 [stroke-linecap:round]" strokeWidth="2.5">
        <path d="M56 56c12-2 24-1 32 3M56 70c12-2 24-1 32 3M56 84c12-2 24-1 32 3M56 98c8-1 16-1 22 1" />
        <path d="M112 84c12-4 24-5 32-4M112 98c12-4 24-5 32-4" />
      </g>
      <path d="M118 58c-4-6 4-12 9-6 5-6 13 0 9 6l-9 9Z" className="fill-tomato-soft stroke-tomato-deep" strokeWidth="2" strokeLinejoin="round" />
    </Frame>
  );
}

// Un frigo, une tomate aimantée et une note sur la porte : « rien au frigo pour l'instant ».
export function FridgeIllustration({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Sparkles />
      <path className={LINE} strokeWidth="3" d="M50 138h100" />
      <path d="M74 132v6M126 132v6" className="fill-none stroke-foreground [stroke-linecap:round]" strokeWidth="4" />
      <rect x="64" y="12" width="72" height="122" rx="12" className="fill-card stroke-foreground" strokeWidth="3" />
      <path d="M64 54h72" className="fill-none stroke-foreground" strokeWidth="3" />
      <path d="M76 26v16M76 66v28" className="fill-none stroke-foreground [stroke-linecap:round]" strokeWidth="4" />
      <circle cx="112" cy="33" r="9" className="fill-tomato stroke-foreground" strokeWidth="2.5" />
      <path d="M107 25c2.5-3.5 7.5-3.5 10 0" className="fill-none stroke-sage-deep [stroke-linecap:round]" strokeWidth="2.5" />
      <g transform="rotate(7 111 90)">
        <rect x="97" y="74" width="28" height="34" rx="3" className="fill-mustard-soft stroke-foreground" strokeWidth="2.5" />
        <path d="M103 86h16M103 94h11" className="fill-none stroke-mustard-deep [stroke-linecap:round]" strokeWidth="2.5" />
        <circle cx="111" cy="74" r="4" className="fill-sage stroke-foreground" strokeWidth="2" />
      </g>
    </Frame>
  );
}
