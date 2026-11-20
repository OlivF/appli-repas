"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { FieldError } from "@/components/field";
import {
  InvitePanel,
  MyPanel,
  OrganizerList,
  OrganizerPanel,
  OrganizerRow,
  PendingInviteList,
  PendingInviteRow,
  type Organizer,
  type OrganizerInvite,
} from "@/components/household-organizers";
import type { AvatarMember } from "@/components/member-avatar";
import { SectionHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { inviteShareText, inviteUrl } from "@/lib/household-accounts";
import {
  createInviteAction,
  removeAccountAction,
  revokeInviteAction,
  setAccountRoleAction,
  setInviteRoleAction,
  setMyMemberAction,
} from "./actions";

type Panel = { kind: "invite"; id: string } | { kind: "me" } | { kind: "organizer"; userId: string };

// « Qui organise les repas » : les comptes du foyer, les invitations en attente et « Inviter
// quelqu'un » (pour qui peut inviter). Chaque geste s'enregistre aussitôt ; la page se
// rafraîchit ensuite avec ce que dit la base.
export function OrganizersSection({
  householdName,
  organizers,
  invites,
  canManage,
  choices,
  myMemberId,
  today,
}: {
  householdName: string;
  organizers: Organizer[];
  invites: OrganizerInvite[];
  canManage: boolean;
  // Les mangeurs que le compte peut choisir comme « C'est moi ».
  choices: AvatarMember[];
  // Le « C'est moi » actuel (null : ne mange pas ici ; undefined : pas encore répondu).
  myMemberId: string | null | undefined;
  today: string;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // L'invitation juste créée (avant que la page rafraîchie la liste) et les gestes en cours.
  const [created, setCreated] = useState<OrganizerInvite | null>(null);
  const [inviteRoles, setInviteRoles] = useState<Record<string, boolean>>({});
  const [accountRoles, setAccountRoles] = useState<Record<string, boolean>>({});
  const [cancelled, setCancelled] = useState<string[]>([]);

  // De nouvelles données du serveur (après un geste, ou la page gardée par Next.js puis
  // rafraîchie) font foi : les corrections optimistes s'effacent, le panneau ouvert reste.
  const [seen, setSeen] = useState({ organizers, invites });
  if (seen.organizers !== organizers || seen.invites !== invites) {
    setSeen({ organizers, invites });
    setInviteRoles({});
    setAccountRoles({});
    setCancelled([]);
  }

  const shownInvites = invites
    .filter((invite) => !cancelled.includes(invite.id))
    .map((invite) => ({ ...invite, canInvite: inviteRoles[invite.id] ?? invite.canInvite }));
  const shownOrganizers = organizers.map((organizer) => ({
    ...organizer,
    canInvite: accountRoles[organizer.userId] ?? organizer.canInvite,
  }));

  const currentInvite =
    panel?.kind === "invite"
      ? (shownInvites.find((invite) => invite.id === panel.id) ??
        (created?.id === panel.id ? { ...created, canInvite: inviteRoles[created.id] ?? created.canInvite } : null))
      : null;
  const currentOrganizer =
    panel?.kind === "organizer" ? shownOrganizers.find((organizer) => organizer.userId === panel.userId) ?? null : null;

  function show(next: Panel) {
    setError(null);
    setPanel(next);
    setOpen(true);
  }

  function invite() {
    setError(null);
    startTransition(async () => {
      const result = await createInviteAction();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const fresh = {
        id: result.invite.id,
        code: result.invite.code,
        canInvite: result.invite.role === "admin",
        expiresAt: result.invite.expires_at,
      };
      setCreated(fresh);
      show({ kind: "invite", id: fresh.id });
    });
  }

  async function share(target: OrganizerInvite) {
    const text = inviteShareText(householdName, inviteUrl(window.location.origin, target.code));
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (shareError) {
        // Fermé sans partager : rien à faire.
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Lien copié");
    } catch {
      setError("La copie n’a pas marché : dicte plutôt le code.");
    }
  }

  function setInviteRole(target: OrganizerInvite, canInvite: boolean) {
    setError(null);
    setInviteRoles((roles) => ({ ...roles, [target.id]: canInvite }));
    startTransition(async () => {
      const result = await setInviteRoleAction(target.id, canInvite);
      if ("error" in result) {
        setInviteRoles((roles) => ({ ...roles, [target.id]: !canInvite }));
        setError(result.error);
      }
    });
  }

  function cancelInvite(target: OrganizerInvite) {
    setError(null);
    setCancelled((ids) => [...ids, target.id]);
    startTransition(async () => {
      const result = await revokeInviteAction(target.id);
      if ("error" in result) {
        setCancelled((ids) => ids.filter((id) => id !== target.id));
        setError(result.error);
      }
    });
  }

  function setAccountRole(target: Organizer, canInvite: boolean) {
    setError(null);
    setAccountRoles((roles) => ({ ...roles, [target.userId]: canInvite }));
    startTransition(async () => {
      const result = await setAccountRoleAction(target.userId, canInvite);
      if ("error" in result) {
        setAccountRoles((roles) => ({ ...roles, [target.userId]: !canInvite }));
        setError(result.error);
      }
    });
  }

  function remove(target: Organizer) {
    setError(null);
    startTransition(async () => {
      const result = await removeAccountAction(target.userId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast(`${target.label} ne fait plus partie du foyer`);
    });
  }

  function chooseMember(memberId: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await setMyMemberAction(memberId);
      if ("error" in result) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <section aria-labelledby="organizers-title" className="mt-10">
      <SectionHeader id="organizers-title" title="Qui organise les repas" />
      <div className="mt-4">
        <OrganizerList>
          {shownOrganizers.map((organizer) => (
            <OrganizerRow
              key={organizer.userId}
              organizer={organizer}
              onSelect={
                organizer.isMe
                  ? () => show({ kind: "me" })
                  : canManage
                    ? () => show({ kind: "organizer", userId: organizer.userId })
                    : undefined
              }
            />
          ))}
        </OrganizerList>
      </div>
      {canManage && shownInvites.length > 0 && (
        <div className="mt-3">
          <PendingInviteList>
            {shownInvites.map((pendingInvite) => (
              <PendingInviteRow
                key={pendingInvite.id}
                invite={pendingInvite}
                today={today}
                onOpen={() => show({ kind: "invite", id: pendingInvite.id })}
                onCancel={() => cancelInvite(pendingInvite)}
              />
            ))}
          </PendingInviteList>
        </div>
      )}
      <p className="mt-3 text-[0.9375rem] text-muted-foreground">
        Les personnes ici voient et modifient tout : recettes, semaine, courses et frigo.
      </p>

      {canManage && (
        <Button type="button" variant="secondary" block className="mt-5" disabled={pending && !open} onClick={invite}>
          <UserPlus aria-hidden="true" />
          {pending && !open ? "Un instant…" : "Inviter quelqu’un"}
        </Button>
      )}
      {error && !open && (
        <div className="mt-3">
          <FieldError alert>{error}</FieldError>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          {currentInvite && (
            <InvitePanel
              invite={currentInvite}
              today={today}
              onShare={() => share(currentInvite)}
              onCanInviteChange={(canInvite) => setInviteRole(currentInvite, canInvite)}
              pending={pending}
              error={error}
            />
          )}
          {panel?.kind === "me" && (
            <MyPanel members={choices} value={myMemberId} onChoose={chooseMember} pending={pending} error={error} />
          )}
          {currentOrganizer && (
            <OrganizerPanel
              key={currentOrganizer.userId}
              organizer={currentOrganizer}
              onCanInviteChange={(canInvite) => setAccountRole(currentOrganizer, canInvite)}
              onRemove={() => remove(currentOrganizer)}
              pending={pending}
              error={error}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
