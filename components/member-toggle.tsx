"use client";

import { Check } from "lucide-react";
import { cn } from "cn";
import { MemberAvatar, type AvatarMember } from "@/components/member-avatar";

// Avatar cliquable : « Léa n'en mange pas ». Touché, il se barre.
// `disabled` + `reason` : son régime l'écarte d'office (« Céto »), on ne peut pas le réintégrer.
// Avec `name`, la case part avec le formulaire (valeur : l'id du membre) quand elle est barrée.
// `mode="pick"` : « Léa mange ce plat » ; coché, l'avatar prend un cercle tomate et une coche
// (le barré reste réservé à « n'en mange pas »). `reason` dit alors son régime.
export function MemberToggle({
  member,
  pressed,
  onPressedChange,
  disabled = false,
  reason,
  name,
  mode = "exclude",
}: {
  member: AvatarMember;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  disabled?: boolean;
  reason?: string;
  name?: string;
  mode?: "exclude" | "pick";
}) {
  if (mode === "pick") {
    return (
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={`${member.first_name} mange ce plat`}
        onClick={() => onPressedChange(!pressed)}
        className="press group flex w-[4.5rem] flex-col items-center gap-1.5 rounded-2xl px-0.5 pt-1 pb-1.5 text-center outline-offset-2 hover:bg-muted"
      >
        <span className="relative">
          <MemberAvatar
            member={member}
            size="lg"
            className={cn(
              "ring-[3px] transition-shadow",
              pressed ? "ring-primary" : "ring-transparent group-hover:ring-border",
            )}
          />
          {pressed && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -bottom-1 grid size-5.5 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground"
            >
              <Check className="size-3" strokeWidth={4} />
            </span>
          )}
        </span>
        <span
          className={cn(
            "max-w-full text-[0.9375rem] leading-tight font-semibold break-words",
            !pressed && "text-muted-foreground",
          )}
        >
          {member.first_name}
        </span>
        {reason && <span className="-mt-1 text-[0.8125rem] leading-tight text-muted-foreground">{reason}</span>}
      </button>
    );
  }

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
