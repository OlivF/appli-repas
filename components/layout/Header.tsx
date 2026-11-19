import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { HeaderNav } from "@/components/app-nav";
import { Logo } from "@/components/brand/logo";
import { fridgeUrgentCount } from "@/lib/fridge-data";
import { createClient } from "@/lib/supabase/server";
import { AccountMenu } from "./account-menu";
import { GuestActions } from "./guest-actions";
import { HeaderFrame } from "./header-frame";

// Le header de toutes les pages, dans le layout racine. Le logo est là tout de suite ; la partie
// qui dépend de la session (boutons d'inscription, ou navigation et compte) arrive juste après,
// sans décaler la page : le header a sa hauteur fixe.
// Sur téléphone, un compte connecté n'a que le logo et son avatar : la navigation reste dans la
// barre du bas. Sur ordinateur (1024 px et plus), elle est ici, à côté du logo.
export function Header() {
  return (
    <HeaderFrame>
      <Link href="/" className="press -mx-1 shrink-0 rounded-full px-1 py-1.5">
        <Logo className="text-[1.375rem] lg:text-[1.5rem]" />
      </Link>
      <Suspense fallback={null}>
        <HeaderSession />
      </Suspense>
    </HeaderFrame>
  );
}

async function HeaderSession() {
  // Propre à chaque requête : la session se lit dans les cookies (voir lib/data.ts).
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return <GuestActions />;

  const email = typeof data.claims.email === "string" ? data.claims.email : undefined;
  const fridgeCount = await fridgeUrgentCount();
  return (
    <>
      <div className="hidden lg:block">
        <HeaderNav fridgeCount={fridgeCount} />
      </div>
      <div className="ml-auto">
        <AccountMenu email={email} />
      </div>
    </>
  );
}
