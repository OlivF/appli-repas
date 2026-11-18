import type { Metadata } from "next";
import { LegalPage, LegalSection, ToFill } from "../legal";

export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalNoticePage() {
  return (
    <LegalPage title="Mentions légales" updated={"[à compléter]"}>
      <LegalSection title="Éditeur du site">
        <p>
          Popote est édité par <ToFill>nom ou raison sociale</ToFill>, <ToFill>adresse</ToFill>.
        </p>
        <p>
          Contact : <ToFill>adresse email</ToFill>.
        </p>
      </LegalSection>

      <LegalSection title="Directeur de la publication">
        <p>
          <ToFill>prénom et nom</ToFill>.
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Le site est hébergé par Vercel Inc., <ToFill>adresse de l’hébergeur</ToFill>.
        </p>
        <p>
          Les données (comptes, foyers, recettes, plannings) sont hébergées par Supabase,{" "}
          <ToFill>société, adresse et région des serveurs</ToFill>.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          <ToFill>conditions de reproduction des textes, du logo et des recettes du catalogue</ToFill>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
