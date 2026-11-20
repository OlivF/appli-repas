"use client";

import { useState, useTransition } from "react";
import { WhoAmICard } from "@/components/household-organizers";
import type { AvatarMember } from "@/components/member-avatar";
import { setMyMemberAction } from "./actions";

// La carte « Qui es-tu à table ? », tant que le compte n'a pas répondu : un toucher enregistre,
// la page se rafraîchit et la carte s'en va.
export function WhoAmIPrompt({ members }: { members: AvatarMember[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(memberId: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await setMyMemberAction(memberId);
      if ("error" in result) setError(result.error);
    });
  }

  return <WhoAmICard members={members} onChoose={choose} pending={pending} error={error} />;
}
