"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { JoinInvite, type JoinState } from "@/components/join-invite";
import { acceptInviteAction, declineInviteAction, forgetInviteAction, startAccountAction } from "../actions";

// L'écran d'invitation branché sur ses actions. Rejoindre mène à la semaine, avec un mot de
// bienvenue qui propose de dire qui on est à table.
export function JoinScreen({ code, state, forget }: { code: string; state: JoinState; forget: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Lien qui ne marche plus, ou déjà dans le foyer : on oublie l'invitation en attente (un
  // composant serveur ne peut pas effacer de cookie).
  useEffect(() => {
    if (forget) void forgetInviteAction();
  }, [forget]);

  function join() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInviteAction(code, state.kind === "switch");
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast(`Bienvenue dans « ${result.householdName} » !`, {
        duration: 10_000,
        action: { label: "Qui es-tu ?", onClick: () => router.push("/foyer") },
      });
      router.push("/semaine");
    });
  }

  return (
    <JoinInvite
      state={state}
      pending={pending}
      error={error}
      onSignUp={() => startTransition(() => startAccountAction(code, "signup"))}
      onSignIn={() => startTransition(() => startAccountAction(code, "signin"))}
      onJoin={join}
      onKeep={() => startTransition(() => declineInviteAction())}
    />
  );
}
