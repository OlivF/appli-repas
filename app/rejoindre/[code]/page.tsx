import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import type { JoinState } from "@/components/join-invite";
import { Loading, Screen } from "@/components/screen";
import { normalizeInviteCode } from "@/lib/household-accounts";
import { createClient } from "@/lib/supabase/server";
import { JoinScreen } from "./join-screen";

export const metadata: Metadata = { title: "Rejoindre un foyer" };

// Le lien d'invitation (/rejoindre/7KQM3FXP), ouvert à tous : le visiteur crée son compte ou se
// connecte, un compte connecté rejoint le foyer (en quittant le sien s'il en a un).
export default function JoinPage({ params }: PageProps<"/rejoindre/[code]">) {
  return (
    <Screen>
      <Suspense fallback={<Loading />}>
        <Join params={params} />
      </Suspense>
    </Screen>
  );
}

async function Join({ params }: { params: PageProps<"/rejoindre/[code]">["params"] }) {
  await connection();
  const code = normalizeInviteCode(decodeURIComponent((await params).code));
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  // L'aperçu ne dit rien d'autre que le nom du foyer, le prénom de l'invitant et le statut.
  const { data: rows } = code ? await supabase.rpc("household_invite_preview", { invite_code: code }) : { data: null };
  const preview = rows?.[0];

  let state: JoinState;
  if (!code || !preview || preview.status !== "valid" || !preview.household_name) {
    state = { kind: "invalid" };
  } else {
    const invite = { householdName: preview.household_name, inviterName: preview.inviter_name };
    if (!auth?.claims) {
      state = { kind: "visitor", ...invite };
    } else if (preview.is_member) {
      state = { kind: "member", ...invite };
    } else {
      const { data: current } = await supabase
        .from("households")
        .select("name")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (!current) {
        state = { kind: "join", ...invite };
      } else {
        const { data: accounts } = await supabase.rpc("household_accounts");
        state = {
          kind: "switch",
          ...invite,
          currentName: current.name,
          deletesCurrent: (accounts?.length ?? 0) <= 1,
        };
      }
    }
  }

  return (
    <JoinScreen code={code ?? ""} state={state} forget={state.kind === "invalid" || state.kind === "member"} />
  );
}
