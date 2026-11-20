"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronRight, Share2, Trash2 } from "lucide-react";
import { cn } from "cn";
import { ChoiceChip } from "@/components/choice-chip";
import { FieldError } from "@/components/field";
import { MemberAvatar, type AvatarMember } from "@/components/member-avatar";
import { SwitchField } from "@/components/switch-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { accountInitial } from "@/lib/account";
import { formatInviteCode, inviteExpiryLabel } from "@/lib/household-accounts";

// Les personnes qui organisent les repas du foyer (les comptes), et les invitations. Un compte
// n'est pas un mangeur : son « C'est moi » sert seulement à afficher un prénom et une couleur.
// Composants d'affichage : /foyer y branche les actions, /design des données de démonstration.

export type Organizer = {
  userId: string;
  // Le prénom du « C'est moi », sinon l'email (accountLabel).
  label: string;
  email: string;
  member: AvatarMember | null;
  canInvite: boolean;
  isMe: boolean;
};

export type OrganizerInvite = { id: string; code: string; canInvite: boolean; expiresAt: string };

// L'avatar d'un compte : celui du mangeur « C'est moi », sinon l'initiale de l'email sur fond neutre.
export function OrganizerAvatar({ organizer }: { organizer: Pick<Organizer, "email" | "member"> }) {
  if (organizer.member) return <MemberAvatar member={organizer.member} />;
  return (
    <Avatar aria-hidden="true">
      <AvatarFallback className="text-lg">{accountInitial(organizer.email)}</AvatarFallback>
    </Avatar>
  );
}

const ROW = "flex min-h-16 w-full items-center gap-3 py-2.5 pr-1 pl-1 text-left";

// Une ligne de « Qui organise les repas » ; avec `onSelect`, toute la ligne ouvre un panneau.
export function OrganizerRow({ organizer, onSelect }: { organizer: Organizer; onSelect?: () => void }) {
  const body = (
    <>
      <OrganizerAvatar organizer={organizer} />
      <span className="min-w-0 flex-1">
        <span className="block text-[1.0625rem] leading-snug font-semibold wrap-anywhere">
          {organizer.label}
          {organizer.isMe && <span className="font-normal text-muted-foreground"> (toi)</span>}
        </span>
        {organizer.canInvite && <span className="block text-[0.875rem] text-muted-foreground">Peut inviter</span>}
      </span>
      {onSelect && <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />}
    </>
  );
  return (
    <li className="border-b border-border/70 last:border-b-0">
      {onSelect ? (
        <button type="button" onClick={onSelect} className={cn(ROW, "press rounded-2xl outline-offset-2")}>
          {body}
        </button>
      ) : (
        <div className={ROW}>{body}</div>
      )}
    </li>
  );
}

// Une invitation encore valide : la toucher rouvre son panneau ; « Annuler » la rend inutilisable.
export function PendingInviteRow({
  invite,
  today,
  onOpen,
  onCancel,
}: {
  invite: OrganizerInvite;
  today: string;
  onOpen: () => void;
  onCancel: () => void;
}) {
  return (
    <li className="flex items-center gap-2 border-b border-border/70 last:border-b-0">
      <button type="button" onClick={onOpen} className="press min-h-14 min-w-0 flex-1 rounded-2xl py-2 pl-1 text-left outline-offset-2">
        <span className="block leading-snug font-semibold">Invitation en attente</span>
        <span className="block text-[0.875rem] text-muted-foreground">{inviteExpiryLabel(invite.expiresAt, today)}</span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="px-3"
        onClick={onCancel}
        aria-label={`Annuler l’invitation ${formatInviteCode(invite.code)}`}
      >
        Annuler
      </Button>
    </li>
  );
}

// La liste « Qui organise les repas », en carte comme les autres listes du foyer.
export function OrganizerList({ children }: { children: ReactNode }) {
  return (
    <Card className="gap-0 px-3 py-1">
      <ul>{children}</ul>
    </Card>
  );
}

// Les invitations en attente, sous les personnes : une carte en retrait (ce ne sont pas encore
// des personnes du foyer).
export function PendingInviteList({ children }: { children: ReactNode }) {
  return (
    <Card className="gap-0 bg-muted px-3 py-1 shadow-none">
      <ul aria-label="Invitations en attente">{children}</ul>
    </Card>
  );
}

// ─── Panneau d'invitation ───────────────────────────────────────────────────

// Le contenu du panneau « Inviter quelqu'un » : partager le lien (gros bouton), le code à dicter,
// sa date limite, et « Pourra aussi inviter d'autres personnes ».
export function InvitePanel({
  invite,
  today,
  onShare,
  onCanInviteChange,
  pending = false,
  error,
}: {
  invite: OrganizerInvite;
  today: string;
  onShare: () => void;
  onCanInviteChange: (canInvite: boolean) => void;
  pending?: boolean;
  error?: string | null;
}) {
  const switchId = useId();
  const code = formatInviteCode(invite.code);
  return (
    <>
      <SheetHeader>
        <SheetTitle>Inviter quelqu’un</SheetTitle>
        <SheetDescription>
          Envoie ce lien à la personne qui prépare les repas avec toi. Il marche une seule fois, pendant 7 jours.
        </SheetDescription>
      </SheetHeader>

      <Button type="button" size="lg" block onClick={onShare}>
        <Share2 aria-hidden="true" />
        Partager le lien
      </Button>

      <div className="mt-6 rounded-2xl bg-muted px-4 py-4 text-center">
        <p className="text-[0.9375rem] text-muted-foreground">Ou dicte ce code</p>
        <p
          className="mt-1 text-[2rem] leading-tight font-bold tracking-[0.14em] tabular-nums"
          aria-label={`Code : ${invite.code.split("").join(" ")}`}
        >
          {code}
        </p>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">{inviteExpiryLabel(invite.expiresAt, today)}</p>
      </div>

      <div className="mt-6">
        <SwitchField
          id={switchId}
          label="Pourra aussi inviter d’autres personnes"
          description="Et retirer quelqu’un du foyer."
          checked={invite.canInvite}
          disabled={pending}
          onCheckedChange={onCanInviteChange}
        />
      </div>
      {error && (
        <div className="mt-4">
          <FieldError alert>{error}</FieldError>
        </div>
      )}
    </>
  );
}

// ─── « Qui es-tu à table ? » ────────────────────────────────────────────────

// Les mangeurs en puces, plus « Je ne mange pas ici » : un toucher suffit. `value` : le
// « C'est moi » actuel (null : ne mange pas ici ; undefined : pas encore répondu).
export function WhoAmIChoices({
  members,
  value,
  onChoose,
  disabled = false,
}: {
  members: readonly AvatarMember[];
  value: string | null | undefined;
  onChoose: (memberId: string | null) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="flex flex-wrap gap-2">
      <legend className="sr-only">Qui es-tu à table ?</legend>
      {members.map((member) => (
        <ChoiceChip
          key={member.id}
          type="radio"
          name={name}
          value={member.id}
          checked={value === member.id}
          onChange={() => onChoose(member.id)}
        >
          {member.first_name}
        </ChoiceChip>
      ))}
      <ChoiceChip type="radio" name={name} value="" checked={value === null} onChange={() => onChoose(null)}>
        Je ne mange pas ici
      </ChoiceChip>
    </fieldset>
  );
}

// La petite carte du haut de /foyer, tant que le compte n'a pas répondu.
export function WhoAmICard({
  members,
  onChoose,
  pending = false,
  error,
}: {
  members: readonly AvatarMember[];
  onChoose: (memberId: string | null) => void;
  pending?: boolean;
  error?: string | null;
}) {
  const titleId = useId();
  return (
    <Card role="region" aria-labelledby={titleId} className="gap-3 border-2 border-tomato-soft p-5">
      <div>
        <h2 id={titleId} className="text-[1.375rem] leading-tight">
          Qui es-tu à table ?
        </h2>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
          Pour afficher ton prénom plutôt que ton email. Ça ne change rien aux repas.
        </p>
      </div>
      <WhoAmIChoices members={members} value={undefined} onChoose={onChoose} disabled={pending} />
      {error && <FieldError alert>{error}</FieldError>}
    </Card>
  );
}

// Le panneau de sa propre ligne : changer sa réponse.
export function MyPanel({
  members,
  value,
  onChoose,
  pending = false,
  error,
}: {
  members: readonly AvatarMember[];
  value: string | null | undefined;
  onChoose: (memberId: string | null) => void;
  pending?: boolean;
  error?: string | null;
}) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>Qui es-tu à table ?</SheetTitle>
        <SheetDescription>Pour afficher ton prénom plutôt que ton email. Ça ne change rien aux repas.</SheetDescription>
      </SheetHeader>
      <WhoAmIChoices members={members} value={value} onChoose={onChoose} disabled={pending} />
      {error && (
        <div className="mt-4">
          <FieldError alert>{error}</FieldError>
        </div>
      )}
    </>
  );
}

// ─── Le panneau d'une autre personne (pour qui peut inviter) ────────────────

export function OrganizerPanel({
  organizer,
  onCanInviteChange,
  onRemove,
  pending = false,
  error,
}: {
  organizer: Organizer;
  onCanInviteChange: (canInvite: boolean) => void;
  onRemove: () => void;
  pending?: boolean;
  error?: string | null;
}) {
  const switchId = useId();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-3">
          <OrganizerAvatar organizer={organizer} />
          <div className="min-w-0">
            <SheetTitle className="wrap-anywhere">{organizer.label}</SheetTitle>
            <SheetDescription className={cn("wrap-anywhere", organizer.label === organizer.email && "sr-only")}>
              {organizer.email}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <SwitchField
        id={switchId}
        label="Peut inviter et retirer des personnes"
        checked={organizer.canInvite}
        disabled={pending}
        onCheckedChange={onCanInviteChange}
      />
      {error && (
        <div className="mt-4">
          <FieldError alert>{error}</FieldError>
        </div>
      )}

      <div className="mt-8">
        {confirming ? (
          <div className="space-y-3 rounded-2xl border-2 border-destructive/40 p-4 text-center">
            <p role="alert" className="font-semibold">
              {organizer.label} ne verra plus les menus ni la liste de ce foyer. Ses recettes restent au foyer.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button type="button" variant="destructive" disabled={pending} onClick={onRemove}>
                <Trash2 aria-hidden="true" />
                {pending ? "Un instant…" : "Oui, retirer"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                Non
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="destructive" block onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden="true" />
            Retirer du foyer
          </Button>
        )}
      </div>
    </>
  );
}
