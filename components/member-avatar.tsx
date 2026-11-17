import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";

export type AvatarMember = {
  id: string;
  first_name: string;
  // Couleur pastel attribuée à l'ajout, de 0 à 7 (variables --member-N-*).
  color: number;
  // Calculées par avatarInitials sur tout le foyer.
  initials: string;
};

type Size = "sm" | "default" | "lg" | "xl";

// Taille de l'initiale selon l'avatar ; un peu plus petite quand il y a deux lettres.
const TEXT_SIZE: Record<Size, [string, string]> = {
  sm: ["text-[0.9375rem]", "text-[0.75rem] tracking-tight"],
  default: ["text-lg", "text-[0.9375rem] tracking-tight"],
  lg: ["text-2xl", "text-[1.25rem] tracking-tight"],
  xl: ["text-3xl", "text-[1.625rem] tracking-tight"],
};

export function memberColorStyle(color: number) {
  const index = ((color % 8) + 8) % 8;
  return {
    backgroundColor: `var(--member-${index}-bg)`,
    color: `var(--member-${index}-fg)`,
  };
}

// Avatar d'un membre : son initiale sur sa couleur. Décoratif quand le prénom est écrit à côté.
export function MemberAvatar({
  member,
  size = "default",
  labelled = false,
  crossed = false,
  className,
}: {
  member: AvatarMember;
  size?: Size;
  // true : l'avatar est seul et doit dire de qui il s'agit.
  labelled?: boolean;
  // Barré : ce membre ne mange pas la recette.
  crossed?: boolean;
  className?: string;
}) {
  return (
    <Avatar
      size={size}
      data-crossed={crossed || undefined}
      className={className}
      {...(labelled
        ? { role: "img", "aria-label": member.first_name, title: member.first_name }
        : { "aria-hidden": true })}
    >
      <AvatarFallback
        className={cn(TEXT_SIZE[size][member.initials.length > 1 ? 1 : 0], crossed && "opacity-45")}
        style={memberColorStyle(member.color)}
      >
        {member.initials}
      </AvatarFallback>
      {crossed && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 h-[3px] w-[130%] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-foreground/75"
        />
      )}
    </Avatar>
  );
}

// Les présents d'un repas, en avatars qui se chevauchent. Le nom complet est lu par les lecteurs d'écran.
export function MemberAvatars({
  members,
  size = "sm",
  max = 5,
  crossedIds = [],
  decorative = false,
  className,
}: {
  members: AvatarMember[];
  size?: Size;
  max?: number;
  // Les membres à barrer (ceux qui ne mangent pas la recette).
  crossedIds?: readonly string[];
  // true : un texte à côté dit déjà qui est là ; les avatars ne sont pas lus.
  decorative?: boolean;
  className?: string;
}) {
  const shown = members.length > max ? members.slice(0, max - 1) : members;
  const hidden = members.length - shown.length;
  const names = new Intl.ListFormat("fr", { type: "conjunction" }).format(
    members.map((member) => member.first_name),
  );

  return (
    <AvatarGroup
      className={className}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": names, title: names })}
    >
      {shown.map((member) => (
        <MemberAvatar key={member.id} member={member} size={size} crossed={crossedIds.includes(member.id)} />
      ))}
      {hidden > 0 && (
        <Avatar size={size} aria-hidden="true">
          <AvatarFallback className="bg-muted font-sans text-[0.8125rem] font-semibold text-muted-foreground">
            +{hidden}
          </AvatarFallback>
        </Avatar>
      )}
    </AvatarGroup>
  );
}
