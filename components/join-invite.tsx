"use client";

import Link from "next/link";
import { FieldError } from "@/components/field";
import { PlateIllustration, TableForTwoIllustration } from "@/components/illustrations";
import { Button } from "@/components/ui/button";

// Ce que montre /rejoindre/<code>, selon le code et la personne qui l'ouvre.
export type JoinState =
  // Le code a expiré, a déjà servi, a été annulé, ou n'existe pas.
  | { kind: "invalid" }
  // Pas encore de compte (ou pas connecté·e).
  | { kind: "visitor"; householdName: string; inviterName: string | null }
  // Connecté·e, sans foyer.
  | { kind: "join"; householdName: string; inviterName: string | null }
  // Connecté·e, déjà dans ce foyer.
  | { kind: "member"; householdName: string; inviterName: string | null }
  // Connecté·e, avec un autre foyer : le rejoindre, c'est quitter celui-là.
  | {
      kind: "switch";
      householdName: string;
      inviterName: string | null;
      currentName: string;
      // Le compte est le seul de son foyer actuel : il sera supprimé.
      deletesCurrent: boolean;
    };

// « Famille F », avec des espaces insécables : le guillemet ne part jamais seul à la ligne.
function quoted(name: string) {
  return `«\u00a0${name}\u00a0»`;
}

// L'écran d'invitation, façon /bienvenue : une illustration, une phrase, un ou deux gros boutons.
export function JoinInvite({
  state,
  pending = false,
  error,
  onSignUp,
  onSignIn,
  onJoin,
  onKeep,
  demo = false,
}: {
  state: JoinState;
  pending?: boolean;
  error?: string | null;
  onSignUp?: () => void;
  onSignIn?: () => void;
  onJoin?: () => void;
  onKeep?: () => void;
  // Sur /design : le titre n'est pas celui de la page.
  demo?: boolean;
}) {
  const Title = demo ? "p" : "h1";

  if (state.kind === "invalid") {
    return (
      <div className="flex flex-col items-center text-center">
        <PlateIllustration className="w-48" />
        <Title className="mt-6 font-heading text-[2.25rem] leading-[1.08]">Ce lien ne marche plus.</Title>
        <p className="mt-3 max-w-[32ch] text-lg text-muted-foreground">
          Demande un nouveau lien à la personne qui t’a invité·e.
        </p>
      </div>
    );
  }

  const name = quoted(state.householdName);

  if (state.kind === "member") {
    return (
      <div className="flex flex-col items-center text-center">
        <TableForTwoIllustration className="w-52" />
        <Title className="mt-6 font-heading text-[2.25rem] leading-[1.08]">Tu fais déjà partie de ce foyer</Title>
        <p className="mt-3 max-w-[32ch] text-lg text-muted-foreground">{name} t’attend.</p>
        <Button asChild size="lg" block className="mt-8">
          <Link href="/semaine">Voir la semaine</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <TableForTwoIllustration className="w-52" />
      <Title className="mt-6 font-heading text-[2.25rem] leading-[1.08] text-balance">
        Tu es invité·e à rejoindre {name}
        {state.inviterName && ` par ${state.inviterName}`}
      </Title>
      <p className="mt-3 max-w-[32ch] text-lg text-muted-foreground">
        Vous préparerez les menus et la liste de courses à deux.
      </p>

      {state.kind === "switch" && (
        <div className="mt-6 w-full rounded-2xl border-2 border-tomato-soft bg-card p-4 text-left">
          <p className="font-semibold">
            Tu as déjà le foyer {quoted(state.currentName)}. En rejoignant {name}, tu le quittes.
          </p>
          {state.deletesCurrent && (
            <p className="mt-1 font-semibold text-tomato-deep">Il sera supprimé avec ses recettes et ses menus.</p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-6">
          <FieldError alert>{error}</FieldError>
        </div>
      )}

      <div className="mt-8 flex w-full flex-col gap-3">
        {state.kind === "visitor" && (
          <>
            <Button type="button" size="lg" block disabled={pending} onClick={onSignUp}>
              Créer mon compte
            </Button>
            <Button type="button" variant="secondary" block disabled={pending} onClick={onSignIn}>
              J’ai déjà un compte
            </Button>
          </>
        )}
        {state.kind === "join" && (
          <>
            <Button type="button" size="lg" block disabled={pending} onClick={onJoin}>
              {pending ? "Un instant…" : "Rejoindre le foyer"}
            </Button>
            {/* Sinon /bienvenue ramènerait ici tant que l'invitation est en attente. */}
            <Button type="button" variant="ghost" block disabled={pending} onClick={onKeep}>
              Non merci, créer mon propre foyer
            </Button>
          </>
        )}
        {state.kind === "switch" && (
          <>
            <Button type="button" size="lg" block disabled={pending} onClick={onJoin} className="whitespace-normal">
              {pending ? "Un instant…" : `Quitter ${quoted(state.currentName)} et rejoindre`}
            </Button>
            <Button type="button" variant="ghost" block disabled={pending} onClick={onKeep}>
              Non, garder mon foyer
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
