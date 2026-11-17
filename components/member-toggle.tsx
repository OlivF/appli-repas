"use client";

import { cn } from "cn";
import { MemberAvatar, type AvatarMember } from "@/components/member-avatar";

// Avatar cliquable : « Léa n'en mange pas ». Touché, il se barre.
// `disabled` + `reason` : son régime l'écarte d'office (« Céto »), on ne peut pas le réintégrer.
// Avec `name`, la case part avec le formulaire (valeur : l'id du membre) quand elle est barrée.
export function MemberToggle({
  member,
  pressed,
  onPressedChange,
  disabled = false,
  reason,
  name,
}: {
  member: AvatarMember;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  disabled?: boolean;
  reason?: string;
  name?: string;
}) {
  return (
    <>
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={`${member.first_name} n’en mange pas`}
        disabled={disabled}
        onClick={() => onPressedChange(!pressed)}
        className={cn(
          "press group flex w-[4.5rem] flex-col items-center gap-1.5 rounded-2xl px-0.5 pt-1 pb-1.5 text-center outline-offset-2 disabled:cursor-not-allowed",
          !disabled && "hover:bg-muted",
        )}
      >
        <MemberAvatar
          member={member}
          size="lg"
          crossed={pressed}
          className={cn("ring-[3px] ring-transparent transition-shadow", !pressed && "group-hover:ring-border")}
        />
        <span
          className={cn(
            // Les prénoms composés passent à la ligne après le trait d'union.
            "max-w-full text-[0.9375rem] leading-tight font-semibold break-words",
            pressed && "text-muted-foreground line-through decoration-2",
          )}
        >
          {member.first_name}
        </span>
        {reason && <span className="-mt-1 text-[0.8125rem] leading-tight text-muted-foreground">{reason}</span>}
      </button>
      {name && pressed && !disabled && <input type="hidden" name={name} value={member.id} />}
    </>
  );
}
