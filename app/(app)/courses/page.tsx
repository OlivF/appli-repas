import type { Metadata } from "next";
import { AppPage } from "@/components/app-page";
import { EmptyState } from "@/components/empty-state";
import { BasketIllustration } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Courses" };

// L'onglet existe déjà ; la liste de courses arrive à l'étape 3.
export default function CoursesPage() {
  return (
    <AppPage>
      <PageHeader title="Courses" />
      <EmptyState className="mt-8" illustration={<BasketIllustration />} title="La liste de courses arrive bientôt">
        Elle se remplira toute seule avec le menu de la semaine, rayon par rayon.
      </EmptyState>
    </AppPage>
  );
}
