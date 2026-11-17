import Link from "next/link";
import { Pencil } from "lucide-react";
import { cn } from "cn";
import { MemberBadges } from "@/components/diet-badge";
import { MemberAvatar, memberColorStyle, type AvatarMember } from "@/components/member-avatar";
import type { Appetite, Diet } from "@/lib/members";

export type CardMember = AvatarMember & { age: number; diets: Diet[]; appetite: Appetite };

export function ageLabel(age: number) {
  return age < 1 ? "Moins d’un an" : age === 1 ? "1 an" : `${age} ans`;
}

// Carte d'un membre : un bandeau à sa couleur, son avatar, son prénom, son âge et ses régimes.
// Avec `href`, toute la carte ouvre la modification.
export function MemberCard({ member, href }: { member: CardMember; href?: string }) {
  const body = (
    <>
      <div aria-hidden="true" className="h-12 opacity-70" style={{ backgroundColor: memberColorStyle(member.color).backgroundColor }} />
      <div className="-mt-8 flex flex-1 flex-col px-4 pb-4">
        <MemberAvatar member={member} size="lg" className="ring-4 ring-card" />
        <p className="mt-3 font-heading text-[1.375rem] leading-tight break-words">{member.first_name}</p>
        <p className="mt-0.5 text-[0.9375rem] text-muted-foreground">{ageLabel(member.age)}</p>
        <div className="mt-3 empty:hidden">
          <MemberBadges diets={member.diets} appetite={member.appetite} />
        </div>
      </div>
      {href && (
        <span
          aria-hidden="true"
          className="absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full bg-card/85 text-muted-foreground shadow-soft transition-colors group-hover:text-link"
        >
          <Pencil className="size-4" />
        </span>
      )}
    </>
  );

  const frame = "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft";

  return href ? (
    <Link
      href={href}
      scroll={false}
      aria-label={`Modifier ${member.first_name}`}
      className={cn(frame, "lift press active:scale-[0.98]")}
    >
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}
