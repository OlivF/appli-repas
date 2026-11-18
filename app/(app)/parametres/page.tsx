import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
import { Loading } from "@/components/screen";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Paramètres" };

// Les réglages du compte : son email, le mot de passe, et les pages légales.
export default function SettingsPage() {
  return (
    <AppPage narrow>
      <PageHeader title="Paramètres" />
      <Suspense fallback={<Loading />}>
        <Account />
      </Suspense>
    </AppPage>
  );
}

async function Account() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims.email === "string" ? data.claims.email : null;

  return (
    <div className="mt-10 space-y-10">
      <section aria-labelledby="account-title">
        <h2 id="account-title" className="text-[1.625rem] leading-tight">
          Ton compte
        </h2>
        <Card className="mt-4 gap-1 p-5">
          <p className="text-[0.9375rem] text-muted-foreground">Email de connexion</p>
          <p className="text-lg font-semibold break-all">{email ?? "—"}</p>
        </Card>
      </section>

      <section aria-labelledby="password-title">
        <h2 id="password-title" className="text-[1.625rem] leading-tight">
          Mot de passe
        </h2>
        <Card className="mt-4 p-5 sm:p-6">
          <PasswordForm />
        </Card>
      </section>

      <section aria-labelledby="legal-title">
        <h2 id="legal-title" className="text-[1.625rem] leading-tight">
          Informations
        </h2>
        <ul className="mt-3 space-y-1">
          <li>
            <Link href="/mentions-legales" className="text-link">
              Mentions légales
            </Link>
          </li>
          <li>
            <Link href="/confidentialite" className="text-link">
              Confidentialité
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
