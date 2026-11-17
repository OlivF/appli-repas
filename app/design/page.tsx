import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ChoiceChip } from "@/components/choice-chip";
import { DayCard } from "@/components/day-card";
import { AppetiteBadge, DietBadge } from "@/components/diet-badge";
import { ChoiceGroup, Field } from "@/components/field";
import { BasketIllustration, BookIllustration, PlateIllustration, PotIllustration } from "@/components/illustrations";
import { EmptyState } from "@/components/empty-state";
import { KitchenPattern } from "@/components/kitchen-pattern";
import { Logo } from "@/components/logo";
import { MealLabel } from "@/components/meal-label";
import { MemberAvatar, MemberAvatars } from "@/components/member-avatar";
import { MemberCard } from "@/components/member-card";
import { PageHeader } from "@/components/page-header";
import { BatchBadge, RecipeCard } from "@/components/recipe-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DIETS } from "@/lib/members";
import { MEAL_TYPES } from "@/lib/meal-slots";
import { ANNA_LUCIA, FAMILY, MARIE_LAURE, OLIVIER, OTIS, PALETTE, TIMOTHE } from "./demo-data";
import { NavDemo, SheetDemo, StepDemo } from "./interactive-demos";
import { ThemeToggle } from "./theme-toggle";

export const metadata: Metadata = { title: "Le style de Nos repas" };

// Référence visuelle de l'appli : chaque nouvel écran pioche ici. Accessible sans compte.
export default function DesignPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-6 pb-24 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <ThemeToggle />
      </div>

      <PageHeader
        className="mt-10"
        title="Le style de Nos repas"
        lead="Tout ce qui compose l’appli, au même endroit. Chaque nouvel écran réutilise ces pièces, sans style fait à la main."
      />

      <div className="mt-14 space-y-20">
        <Section title="Couleurs" lead="Une cuisine de famille : fond crème, texte brun, la tomate pour agir.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Swatch name="Crème" hex="#FBF7F0" role="Fond des pages" className="bg-[#fbf7f0] text-[#2b2118]" />
            <Swatch name="Brun" hex="#2B2118" role="Texte" className="bg-[#2b2118] text-[#fbf7f0]" />
            <Swatch name="Tomate" hex="#E4572E" role="Boutons, onglet actif" className="bg-[#e4572e] text-white" />
            <Swatch name="Tomate foncée" hex="#B6431F" role="Liens, texte en tomate" className="bg-[#b6431f] text-white" />
            <Swatch name="Sauge" hex="#7C9A6D" role="Végétarien, feuillages" className="bg-[#7c9a6d] text-[#1e1611]" />
            <Swatch name="Moutarde" hex="#E9B44C" role="Petit-déj, éclats" className="bg-[#e9b44c] text-[#2b2118]" />
            <Swatch name="Prune" hex="#6D3B47" role="Céto, accents" className="bg-[#6d3b47] text-white" />
            <Swatch name="Chocolat" hex="#1E1611" role="Fond en mode sombre" className="bg-[#1e1611] text-[#f6eee3]" />
          </div>
          <h3 className="mt-10 text-xl">Une couleur par membre</h3>
          <p className="mt-1 text-muted-foreground">
            Attribuée à l’ajout (la première libre), elle ne change plus. Elle a sa version sombre.
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-4">
            {PALETTE.map((color) => (
              <li key={color.id} className="flex flex-col items-center gap-1.5">
                <MemberAvatar member={color} size="lg" />
                <span className="text-[0.875rem] text-muted-foreground">{color.first_name}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Typographie" lead="Fraunces adoucie pour les titres, Inter pour tout le reste. De l’air autour.">
          <Card className="gap-6 p-6 sm:p-8">
            <Specimen note="Titre de page : Fraunces 600, 36 à 44 px">
              <p className="font-heading text-[2.25rem] leading-[1.08] sm:text-[2.75rem]">Le menu de la semaine</p>
            </Specimen>
            <Specimen note="Titre de section : Fraunces 600, 26 px">
              <p className="font-heading text-[1.625rem] leading-tight">Qui vit à la maison ?</p>
            </Specimen>
            <Specimen note="Titre de carte : Fraunces 600, 22 px">
              <p className="font-heading text-[1.375rem] leading-tight">Potiron et brocolis rôtis</p>
            </Specimen>
            <Specimen note="Texte : Inter 17 px, interligne 1,55">
              <p className="max-w-[60ch]">
                Ajoute chaque personne qui mange à la maison, même de temps en temps. On s’en sert pour
                proposer des recettes qui conviennent à tout le monde et calculer les quantités.
              </p>
            </Specimen>
            <Specimen note="Texte secondaire : Inter 15 px">
              <p className="text-[0.9375rem] text-muted-foreground">40 ans, cétogène</p>
            </Specimen>
          </Card>
        </Section>

        <Section title="Boutons" lead="Ronds, au moins 44 px de haut. Touche-les : ils rebondissent.">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">Continuer</Button>
            <Button>Enregistrer</Button>
            <Button variant="secondary">
              <Plus aria-hidden="true" />
              Ajouter une personne
            </Button>
            <Button variant="outline">Modifier les repas</Button>
            <Button variant="ghost">Annuler</Button>
            <Button variant="destructive">
              <Trash2 aria-hidden="true" />
              Retirer
            </Button>
            <Button variant="link">Renommer le foyer</Button>
            <Button variant="secondary" size="icon" aria-label="Modifier">
              <Pencil aria-hidden="true" />
            </Button>
            <Button disabled>Enregistrement…</Button>
          </div>
          <div className="mt-6 max-w-sm">
            <Button block size="lg">
              Bouton principal, pleine largeur
            </Button>
          </div>
        </Section>

        <Section title="Champs" lead="Grands, bien contrastés, avec une aide ou une erreur juste en dessous.">
          <Card className="gap-6 p-6 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field id="demo-name" label="Prénom">
                {({ describedBy }) => <Input id="demo-name" placeholder="Léa" aria-describedby={describedBy} />}
              </Field>
              <Field id="demo-password" label="Mot de passe" help="6 caractères minimum.">
                {({ describedBy }) => <Input id="demo-password" type="password" aria-describedby={describedBy} />}
              </Field>
              <Field id="demo-age" label="Âge" error="Indique un âge en années, par exemple 9.">
                {({ describedBy, invalid }) => (
                  <div className="flex items-center gap-3">
                    <Input
                      id="demo-age"
                      defaultValue="neuf"
                      aria-invalid={invalid}
                      aria-describedby={describedBy}
                      className="w-24 text-center"
                    />
                    <span className="font-semibold text-muted-foreground">ans</span>
                  </div>
                )}
              </Field>
              <Field id="demo-household" label="Nom du foyer">
                {() => <Input id="demo-household" defaultValue="Famille Martin" />}
              </Field>
            </div>
            <ChoiceGroup legend="Régimes">
              {DIETS.map((diet) => (
                <ChoiceChip key={diet.value} type="checkbox" name="demo-diets" value={diet.value} defaultChecked={diet.value === "keto"}>
                  {diet.label}
                </ChoiceChip>
              ))}
            </ChoiceGroup>
            <ChoiceGroup legend="Appétit">
              <ChoiceChip type="radio" name="demo-appetite" value="normal" defaultChecked>
                Normal
              </ChoiceChip>
              <ChoiceChip type="radio" name="demo-appetite" value="grand">
                Grand appétit
              </ChoiceChip>
            </ChoiceGroup>
          </Card>
        </Section>

        <Section title="Membres" lead="Chacun a son avatar à sa couleur, avec son initiale (deux lettres si besoin).">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex gap-3">
              {FAMILY.map((member) => (
                <MemberAvatar key={member.id} member={member} size="lg" labelled />
              ))}
            </div>
            <MemberAvatars members={FAMILY} />
            <MemberAvatars members={[ANNA_LUCIA, OTIS]} />
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {FAMILY.map((member) => (
              <li key={member.id}>
                <MemberCard member={member} href="#membres" />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Recettes" lead="Une photo quand il y en a une, sinon l’emoji du repas sur sa couleur.">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <RecipeCard
              title="Potiron et brocolis rôtis"
              image={{ src: "/images/potiron-brocolis.jpg", alt: "Potiron, brocolis et carottes dans un plat à four" }}
              mealType="soir"
              minutes={45}
              batch
              diets={["vegetarian", "gluten_free", "lactose_free"]}
              members={[OLIVIER, TIMOTHE, ANNA_LUCIA, OTIS]}
            />
            <RecipeCard
              title="Salade de poulet, avocat et œuf"
              mealType="midi"
              minutes={15}
              diets={["keto", "gluten_free"]}
              members={[MARIE_LAURE]}
            />
            <RecipeCard
              title="Wraps houmous et crudités"
              mealType="pique_nique"
              minutes={10}
              diets={["vegetarian"]}
              members={[ANNA_LUCIA, OTIS]}
            />
          </div>
        </Section>

        <Section title="Pastilles" lead="Les régimes gardent toujours la même couleur et la même icône.">
          <div className="flex flex-wrap gap-2">
            {DIETS.map((diet) => (
              <DietBadge key={diet.value} diet={diet.value} />
            ))}
            <AppetiteBadge appetite="grand" />
            <BatchBadge />
            <Badge variant="tomato">Aujourd’hui</Badge>
          </div>
          <h3 className="mt-8 text-xl">Les repas</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {MEAL_TYPES.map((meal) => (
              <li key={meal.value} className="inline-flex h-10 items-center rounded-full border border-border bg-card px-4 font-semibold shadow-soft">
                <MealLabel type={meal.value} />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="La semaine" lead="Une carte par jour : les repas, et qui est à table.">
          <div className="grid gap-4 sm:grid-cols-2">
            <DayCard
              day="mercredi"
              today
              meals={[
                { type: "petit_dej", members: FAMILY },
                { type: "pique_nique", members: [ANNA_LUCIA, OTIS] },
                { type: "soir", members: FAMILY },
              ]}
            />
            <DayCard
              day="jeudi"
              meals={[
                { type: "petit_dej", members: FAMILY },
                { type: "midi", members: [MARIE_LAURE] },
                { type: "soir", members: FAMILY },
              ]}
            />
          </div>
        </Section>

        <Section title="Parcours de bienvenue" lead="Une question par écran, et la barre qui avance.">
          <Card className="max-w-md gap-6 p-6">
            <StepDemo />
            <p className="font-heading text-[1.75rem] leading-tight">Qui vit à la maison ?</p>
          </Card>
        </Section>

        <Section title="Navigation" lead="En bas sur téléphone, sur le côté à partir de 1024 px. Touche un onglet.">
          <NavDemo />
        </Section>

        <Section title="Panneau du bas" lead="Pour modifier sans quitter l’écran. Le bouton retour du téléphone le ferme.">
          <SheetDemo member={OTIS} />
        </Section>

        <Section title="États vides" lead="Jamais une page blanche : ce qui manque, et le geste pour commencer.">
          <div className="grid gap-5 lg:grid-cols-2">
            <EmptyState
              illustration={<PlateIllustration />}
              title="Ajoute ton premier membre"
              action={
                <Button block>
                  <Plus aria-hidden="true" />
                  Ajouter une personne
                </Button>
              }
            >
              Qui s’assoit à table ? Commence par toi, on ajoute les autres juste après.
            </EmptyState>
            <EmptyState illustration={<BookIllustration />} title="Tes recettes arrivent bientôt">
              Ici, tu rangeras les plats de la famille, et on t’en proposera chaque semaine.
            </EmptyState>
            <EmptyState illustration={<BasketIllustration />} title="La liste de courses arrive bientôt">
              Elle se remplira toute seule avec le menu de la semaine, rayon par rayon.
            </EmptyState>
            <EmptyState illustration={<PotIllustration />} title="Le menu de la semaine mijote">
              Bientôt, l’appli te proposera les repas de la semaine en un geste.
            </EmptyState>
          </div>
        </Section>

        <Section title="Motif de la connexion" lead="Ustensiles et ingrédients au trait, sur la tomate.">
          <div className="relative overflow-hidden rounded-3xl bg-tomato text-[#fdeee7] shadow-soft dark:bg-[#5b2617]">
            <KitchenPattern className="opacity-25" />
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_55%,var(--color-tomato)_20%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_25%_55%,#5b2617_20%,transparent_70%)]" />
            <div className="relative px-8 py-16 sm:px-12 sm:py-20">
              <p className="max-w-[16ch] font-heading text-[2.25rem] leading-[1.08] text-white sm:text-[3rem]">
                Le menu de la semaine, pour toute la famille.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Cartes" lead="Fond un peu plus clair que la page, ombre chaude, coins de 24 px.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Famille Martin</CardTitle>
                <CardDescription>5 personnes, 19 repas par semaine</CardDescription>
              </CardHeader>
              <MemberAvatars members={FAMILY} />
            </Card>
            <Card className="bg-muted shadow-none">
              <CardHeader>
                <CardTitle>Carte en retrait</CardTitle>
                <CardDescription>Pour un contenu secondaire, sans ombre.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  const id = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "-");
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8">
      <h2 id={`${id}-title`} className="text-[1.875rem] leading-tight">
        {title}
      </h2>
      <p className="mt-2 max-w-[56ch] text-muted-foreground">{lead}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Swatch({ name, hex, role, className }: { name: string; hex: string; role: string; className: string }) {
  return (
    <div className={`flex aspect-[4/3] flex-col justify-end rounded-2xl p-4 shadow-soft ring-1 ring-border/60 ${className}`}>
      <p className="font-heading text-lg leading-tight">{name}</p>
      <p className="text-[0.875rem] opacity-85">{hex}</p>
      <p className="text-[0.875rem] opacity-85">{role}</p>
    </div>
  );
}

function Specimen({ note, children }: { note: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 border-b border-border/70 pb-6 last:border-0 last:pb-0">
      <p className="text-[0.875rem] text-muted-foreground">{note}</p>
      {children}
    </div>
  );
}
