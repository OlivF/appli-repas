import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, ToFill } from "../legal";

export const metadata: Metadata = { title: "Confidentialité" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Confidentialité" updated={"[à compléter]"}>
      <LegalSection title="Qui est responsable de tes données">
        <p>
          <ToFill>nom du responsable du traitement et moyen de le contacter</ToFill>.
        </p>
      </LegalSection>

      <LegalSection title="Ce que Popote garde">
        <ul>
          <li>Ton email et ton mot de passe (chiffré), pour te connecter.</li>
          <li>Ton foyer : son nom, le prénom et l’année de naissance de chaque membre, ses régimes et son appétit.</li>
          <li>Qui mange à quel repas, tes recettes, tes favoris et tes plannings de la semaine.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Pourquoi">
        <p>
          Pour faire fonctionner l’appli : proposer les repas de la semaine qui conviennent à chacun et calculer
          les quantités. <ToFill>à confirmer : aucune publicité, aucune revente de données</ToFill>.
        </p>
      </LegalSection>

      <LegalSection title="Où et combien de temps">
        <p>
          Les données sont stockées chez Supabase, <ToFill>région des serveurs</ToFill>. Elles sont gardées{" "}
          <ToFill>durée de conservation, par exemple tant que le compte existe</ToFill>.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Popote n’utilise qu’un cookie : celui de ta session, pour que tu restes connecté. Aucun cookie de
          mesure d’audience ni de publicité.
        </p>
      </LegalSection>

      <LegalSection title="Tes droits">
        <p>
          Tu peux consulter, corriger ou supprimer tes données, et demander la suppression de ton compte :{" "}
          <ToFill>comment faire la demande</ToFill>. Tu peux aussi adresser une réclamation à la CNIL.
        </p>
        <p>
          Voir aussi les <Link href="/mentions-legales" className="text-link">mentions légales</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
