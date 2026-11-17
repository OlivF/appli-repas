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
  className,
}: {
  member: AvatarMember;
  size?: Size;
  // true : l'avatar est seul et doit dire de qui il s'agit.
  labelled?: boolean;
  className?: string;
}) {
  return (
    <Avatar
      size={size}
      className={className}
      {...(labelled
        ? { role: "img", "aria-label": member.first_name, title: member.first_name }
        : { "aria-hidden": true })}
    >
      <AvatarFallback
        className={TEXT_SIZE[size][member.initials.length > 1 ? 1 : 0]}
        style={memberColorStyle(member.color)}
      >
        {member.initials}
      </AvatarFallback>
    </Avatar>
  );
}

// Les présents d'un repas, en avatars qui se chevauchent. Le nom complet est lu par les lecteurs d'écran.
export function MemberAvatars({
  members,
  size = "sm",
  max = 5,
  className,
}: {
  members: AvatarMember[];
  size?: Size;
  max?: number;
  className?: string;
}) {
  const shown = members.length > max ? members.slice(0, max - 1) : members;
  const hidden = members.length - shown.length;
  const names = new Intl.ListFormat("fr", { type: "conjunction" }).format(
    members.map((member) => member.first_name),
  );

  return (
    <AvatarGroup className={className} role="img" aria-label={names} title={names}>
      {shown.map((member) => (
        <MemberAvatar key={member.id} member={member} size={size} />
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
