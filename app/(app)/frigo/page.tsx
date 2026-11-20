import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
import { Loading } from "@/components/screen";
import { loadFridge } from "@/lib/fridge-data";
import { FridgeBoard } from "./fridge-board";

export const metadata: Metadata = { title: "Frigo" };

export default function FridgePage() {
  return (
    <AppPage narrow>
      <PageHeader title="Frigo" lead="Ce qu’il y a à la maison. La liste de courses en tient compte." />
      <Suspense fallback={<Loading />}>
        <Fridge />
      </Suspense>
    </AppPage>
  );
}

async function Fridge() {
  // La date du jour et le frigo changent d'une requête à l'autre : rien n'est pré-rendu.
  await connection();
  const fridge = await loadFridge();
  return <FridgeBoard {...fridge} />;
}
