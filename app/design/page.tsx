import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ChoiceChip } from "@/components/choice-chip";
import { DayCard } from "@/components/day-card";
import { EmptySlot } from "@/components/empty-slot";
import { AppetiteBadge, DietBadge, KidBadge } from "@/components/diet-badge";
import { ChoiceGroup, Field } from "@/components/field";
import {
  BasketIllustration,
  BookIllustration,
  FridgeIllustration,
  PlateIllustration,
  PotIllustration,
  TableForTwoIllustration,
} from "@/components/illustrations";
import { JoinInvite } from "@/components/join-invite";
import { EmptyState } from "@/components/empty-state";
import { KitchenPattern } from "@/components/kitchen-pattern";
import { MealPill } from "@/components/meal-label";
import { MemberAvatar, MemberAvatars } from "@/components/member-avatar";
import { MemberCard } from "@/components/member-card";
import { PageHeader } from "@/components/page-header";
import { BatchBadge, RecipeCard } from "@/components/recipe-card";
import { RecipeChip, RecipeChipRow } from "@/components/recipe-chip";
import { RecipeSteps } from "@/components/recipe-steps";
import { ServingsIngredients } from "@/components/servings-ingredients";
import { ShoppingProgress } from "@/components/shopping-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WeekPicker } from "@/components/week-picker";
import { DIETS } from "@/lib/members";
import { MEAL_TYPES } from "@/lib/meal-slots";
import { dayLabel } from "@/lib/week";
import { ANNA_LUCIA, FAMILY, MARIE_LAURE, OLIVIER, OTIS, PALETTE } from "./demo-data";
import {
  DayStripDemo,
  DuoDemo,
  ExtrasDemo,
  FavoriteDemo,
  FridgeDemo,
  FridgeLinksDemo,
  GridCardsDemo,
  IngredientRowDemo,
  LibraryDemo,
  TrashDemo,
  MemberToggleDemo,
  NavDemo,
  OrganizersDemo,
  PlannedCardsDemo,
  SearchDemo,
  SheetDemo,
  ShoppingDemo,
  StepDemo,
  SwitchDemo,
  WhoAmIDemo,
} from "./interactive-demos";
import { LogoShowcase } from "./logo-showcase";
import { ThemeToggle } from "./theme-toggle";

export const metadata: Metadata = { title: { absolute: "Le style de Popote" } };

// Référence visuelle de l'appli : chaque nouvel écran pioche ici. Accessible sans compte.
export default function DesignPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-6 pb-24 sm:px-8">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      <PageHeader
        className="mt-6"
        title="Le style de Popote"
        lead="Tout ce qui compose l’appli, au même endroit. Chaque nouvel écran réutilise ces pièces, sans style fait à la main."
      />

      <div className="mt-14 space-y-20">
        <Section
          title="Logo"
          lead="Une cocotte ronde dont la vapeur dessine un cœur. Tomate et brun ; le brun devient crème sur fond sombre. Lisible dès 16 px."
        >
          <LogoShowcase />
        </Section>

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
            <SwitchDemo />
            <Field id="demo-steps" label="Étapes" help="Une étape par ligne.">
              {({ describedBy }) => (
                <Textarea
                  id="demo-steps"
                  aria-describedby={describedBy}
                  defaultValue={"Fais revenir l’oignon dans l’huile.\nAjoute la viande et laisse dorer."}
                />
              )}
            </Field>
          </Card>
          <h3 className="mt-10 text-xl">Une ligne d’ingrédient</h3>
          <p className="mt-1 text-muted-foreground">
            Le nom se complète avec les ingrédients déjà connus, qui apportent leur rayon. Les listes de
            choix ouvrent le sélecteur du téléphone.
          </p>
          <Card className="mt-5 p-6 sm:p-8">
            <IngredientRowDemo />
          </Card>
          <h3 className="mt-10 text-xl">Recherche</h3>
          <p className="mt-1 text-muted-foreground">Arrondie, la loupe à gauche, une croix pour tout effacer.</p>
          <div className="mt-5">
            <SearchDemo />
          </div>
        </Section>

        <Section title="Curseur" lead="Pour régler un nombre au pouce. Ici, les quantités suivent le nombre de personnes.">
          <Card className="max-w-md p-6">
            <ServingsIngredients
              servings={6}
              initialPersons={5}
              ingredients={[
                { name: "Pâtes à lasagne", quantity: 300, unit: "g" },
                { name: "Bœuf haché", quantity: 500, unit: "g" },
                { name: "Lait", quantity: 750, unit: "ml" },
                { name: "Œufs", quantity: 2, unit: "piece" },
                { name: "Huile d’olive", quantity: 2, unit: "cas" },
                { name: "Sel", quantity: null, unit: null },
              ]}
            />
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
            <MemberAvatars members={FAMILY} crossedIds={[MARIE_LAURE.id]} />
          </div>
          <h3 className="mt-10 text-xl">Qui n’en mange pas ?</h3>
          <p className="mt-1 max-w-[56ch] text-muted-foreground">
            Touche un avatar pour le barrer. Un membre que son régime écarte est barré d’office, avec la raison.
          </p>
          <div className="mt-5">
            <MemberToggleDemo members={FAMILY} />
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {FAMILY.map((member) => (
              <li key={member.id}>
                <MemberCard member={member} href="#membres" />
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Recettes"
          lead="Une photo quand il y en a une, sinon l’emoji du repas sur sa couleur. Ceux qui n’en mangent pas sont barrés."
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <RecipeCard
              href="#recettes"
              title="Potiron et brocolis rôtis"
              image={{ src: "/images/potiron-brocolis.jpg", alt: "Potiron, brocolis et carottes dans un plat à four" }}
              mealTypes={["soir"]}
              minutes={45}
              batch
              favorite
              diets={["vegetarian", "gluten_free", "lactose_free"]}
              members={FAMILY.map((member) => ({ ...member, out: member.id === MARIE_LAURE.id }))}
            />
            <RecipeCard
              href="#recettes"
              title="Quiche sans pâte aux épinards et feta"
              mealTypes={["midi", "soir"]}
              minutes={40}
              batch
              diets={["keto", "vegetarian", "gluten_free"]}
              members={FAMILY.map((member) => ({ ...member, out: member.id === OTIS.id }))}
            />
            <RecipeCard
              href="#recettes"
              title="Wraps houmous et crudités"
              mealTypes={["pique_nique"]}
              minutes={10}
              diets={["vegetarian", "lactose_free"]}
              members={FAMILY.map((member) => ({ ...member, out: member.id !== ANNA_LUCIA.id && member.id !== OTIS.id }))}
            />
          </div>
          <div className="mt-6 flex items-center gap-3">
            <FavoriteDemo />
            <span className="text-muted-foreground">Le cœur des favoris : touche-le.</span>
          </div>
          <h3 className="mt-10 text-xl">Les recettes qui se marient</h3>
          <p className="mt-1 max-w-[60ch] text-muted-foreground">
            Même élément principal, accompagnement différent : une seule cuisson. Sur la fiche, chaque recette
            associée est une puce qui mène à la sienne ; la pastille Céto les distingue.
          </p>
          <RecipeChipRow id="design-partners" label="Se marie avec" className="mt-4">
            <li>
              <RecipeChip label="Steak haché et haricots verts" keto href="#recettes" />
            </li>
            <li>
              <RecipeChip label="Steak haché et brocolis" keto href="#recettes" />
            </li>
            <li>
              <RecipeChip label="Steak haché et purée" href="#recettes" />
            </li>
          </RecipeChipRow>
          <h3 className="mt-10 text-xl">Les étapes</h3>
          <div className="mt-4 max-w-xl">
            <RecipeSteps
              steps={[
                "Fais revenir l’oignon, la carotte et l’ail hachés dans l’huile.",
                "Verse les tomates, sale, poivre et laisse mijoter 20 minutes.",
                "Fais cuire 45 minutes au four à 180 °C.",
              ]}
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
            <KidBadge />
            <Badge variant="tomato">Aujourd’hui</Badge>
          </div>
          <h3 className="mt-8 text-xl">Les repas</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {MEAL_TYPES.map((meal) => (
              <li key={meal.value}>
                <MealPill type={meal.value} />
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

        <Section
          title="Le planning"
          lead="Les plats de la semaine. On touche un plat pour le changer, on le glisse pour l’échanger, le cadenas le garde quand on relance."
        >
          <h3 className="text-xl">Choisir la semaine</h3>
          <div className="mt-3 max-w-md">
            <WeekPicker label="Semaine du 23 au 29 novembre" relation="next" prevHref="#le-planning" nextHref="#le-planning" />
          </div>

          <h3 className="mt-10 text-xl">Sur téléphone, un jour à la fois</h3>
          <p className="mt-1 text-muted-foreground">On balaie d’un jour à l’autre, ou on touche un jour.</p>
          <div className="mt-4 space-y-4">
            <DayStripDemo days={[0, 1, 2, 3, 4, 5, 6].map((day) => dayLabel("2026-11-23", day))} />
            <PlannedCardsDemo family={FAMILY} keto={MARIE_LAURE} />
            <div className="max-w-md">
              <EmptySlot label="Choisir le midi de mardi" />
            </div>
          </div>

          <h3 className="mt-10 text-xl">Plusieurs plats sur un repas</h3>
          <p className="mt-1 max-w-[60ch] text-muted-foreground">
            Chacun mange un seul plat par repas. Deux plats de même base se cuisinent ensemble : la mention
            les relie. « + Ajouter un plat » (on peut aussi y lâcher une recette) demande « Pour qui ? » ; les
            avatars d’une carte disent qui la mange. Un coché que la recette ne respecte pas est signalé.
          </p>
          <div className="mt-4">
            <DuoDemo family={FAMILY} keto={MARIE_LAURE} />
          </div>

          <h3 className="mt-10 text-xl">Dans la grille, sur ordinateur</h3>
          <p className="mt-1 text-muted-foreground">Une colonne par jour : la carte se fait étroite.</p>
          <div className="mt-4 grid max-w-md grid-cols-3 gap-3">
            <GridCardsDemo family={FAMILY} />
            <EmptySlot compact label="Choisir le dîner de mercredi" />
          </div>

          <h3 className="mt-10 text-xl">La corbeille</h3>
          <p className="mt-1 max-w-[60ch] text-muted-foreground">
            Elle n’apparaît que pendant qu’on fait glisser un plat ou une puce (appui long au doigt), en bas
            au centre de l’écran, au-dessus de la barre d’onglets. Un plat au-dessus : elle grossit et passe en
            tomate. Lâché, il est retiré du menu ; « Annuler » le fait revenir pendant quelques secondes. Un plat
            verrouillé s’y jette aussi, mais ne s’échange pas.
          </p>
          <div className="mt-4">
            <TrashDemo />
          </div>

          <h3 className="mt-10 text-xl">La Bibliothèque</h3>
          <p className="mt-1 text-muted-foreground">
            Chercher, filtrer, et toucher la recette à poser. En tête, « Les basiques » : une ligne par élément
            principal, ses accompagnements en puces. Ce qui ne convient pas à quelqu’un est signalé et rangé en
            dernier ; une puce que personne à table ne peut manger est cachée.
          </p>
          <div className="mt-4">
            <LibraryDemo eaters={[OLIVIER, MARIE_LAURE]} />
          </div>
        </Section>

        <Section
          title="Desserts et compagnie"
          lead="Entrées, desserts, fruits, fromages, laitages : autant qu’on veut par repas, chacun pour qui en mange. Ils ne nourrissent pas un repas : sans plat, il reste à remplir."
        >
          <ExtrasDemo keto={MARIE_LAURE} />
        </Section>

        <Section
          title="Liste de courses"
          lead="On la suit au drive, d’une main. Toute la ligne coche ; l’article coché se barre et glisse en bas de son rayon. « … » dit pour quoi on l’achète."
        >
          <p className="max-w-[60ch] text-muted-foreground">
            Les rayons dans l’ordre du drive ; un rayon tout pris se replie. « quantité modifiée » : la quantité a
            augmenté à la mise à jour, la case a été décochée. Le placard, replié, se vérifie avant de commander.
            La barre d’ajout est fixée au-dessus du menu du bas ; ses suggestions s’ouvrent vers le haut.
          </p>
          <div className="mt-5">
            <ShoppingDemo />
          </div>
        </Section>

        <Section
          title="Frigo"
          lead="On l’ouvre porte ouverte, d’une main : ce qu’il faut finir vite en haut, « Fini » en une touche."
        >
          <p className="max-w-[60ch] text-muted-foreground">
            Une ligne : le nom, la quantité à droite, la date en petit (en tomate : périmé ; en moutarde :
            aujourd’hui, demain, après-demain). Toute la ligne ouvre le panneau ; « Fini » sort l’article et
            « Annuler » le remet. Pour ranger : le nom, puis la quantité et la date limite en puces (la date
            proposée suit la conservation du produit).
          </p>
          <div className="mt-5">
            <FridgeDemo />
          </div>

          <h3 className="mt-10 text-xl">Dans la semaine et les courses</h3>
          <p className="mt-1 max-w-[60ch] text-muted-foreground">
            En haut de la semaine, ce qu’il faut finir. Dans la liste, ce que le frigo donne déjà ; les
            courses faites, on les range. Sur un plat du jour : « Pas cuisiné » (la carte grisée) et
            « Il en reste ».
          </p>
          <div className="mt-4">
            <FridgeLinksDemo family={FAMILY} />
          </div>
        </Section>

        <Section
          title="Foyer partagé"
          lead="Plusieurs personnes organisent les repas du même foyer. Une personne qui organise n’est pas un mangeur : elle peut dire qui elle est à table, seulement pour afficher son prénom."
        >
          <h3 className="text-xl">Qui organise les repas</h3>
          <p className="mt-1 max-w-[60ch] text-muted-foreground">
            Sur /foyer, sous « À table ». « Peut inviter » sous le nom de qui peut inviter et retirer quelqu’un. Les
            invitations en attente, dans une carte en retrait, se rouvrent ou s’annulent. Touche une ligne, ou
            « Inviter quelqu’un » : le code n’est créé qu’à ce moment-là.
          </p>
          <div className="mt-4">
            <OrganizersDemo olivier={OLIVIER} marieLaure={MARIE_LAURE} family={FAMILY} />
          </div>

          <h3 className="mt-10 text-xl">Qui es-tu à table ?</h3>
          <p className="mt-1 max-w-[60ch] text-muted-foreground">
            En haut de /foyer, tant qu’on n’a pas répondu. Seuls les mangeurs que personne n’a encore choisis ; un
            toucher suffit. On change sa réponse en touchant sa propre ligne.
          </p>
          <div className="mt-4">
            <WhoAmIDemo members={FAMILY.filter((member) => member.id !== OLIVIER.id)} />
          </div>

          <h3 className="mt-10 text-xl">La liste de courses en direct</h3>
          <p className="mt-1 max-w-[60ch] text-muted-foreground">
            Au drive, l’un coche, l’autre le voit aussitôt, avec la même petite animation. À droite du compteur, quand
            le foyer a plusieurs comptes : « En direct », ou « Hors ligne » si la connexion tombe ; la liste se
            rattrape toute seule au retour. Jamais de message quand l’autre coche.
          </p>
          <div className="mt-4 grid max-w-3xl gap-5 sm:grid-cols-2">
            <Card className="p-5">
              <ShoppingProgress done={12} total={30} live="live" />
            </Card>
            <Card className="p-5">
              <ShoppingProgress done={12} total={30} live="offline" />
            </Card>
          </div>

          <h3 className="mt-10 text-xl">Le lien d’invitation</h3>
          <p className="mt-1 max-w-[60ch] text-muted-foreground">
            /rejoindre/7KQM3FXP, ouvert à tous : on crée son compte ou on se connecte, puis on rejoint. Avec un autre
            foyer, on le dit sans détour. Un lien expiré, déjà utilisé ou annulé ne dit rien d’autre.
          </p>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Card className="p-6">
              <JoinInvite demo state={{ kind: "visitor", householdName: "Famille F", inviterName: "Olivier" }} />
            </Card>
            <Card className="p-6">
              <JoinInvite
                demo
                state={{
                  kind: "switch",
                  householdName: "Famille F",
                  inviterName: "Olivier",
                  currentName: "Chez moi",
                  deletesCurrent: true,
                }}
              />
            </Card>
            <Card className="p-6">
              <JoinInvite demo state={{ kind: "invalid" }} />
            </Card>
          </div>
        </Section>

        <Section title="Parcours de bienvenue" lead="Une question par écran, et la barre qui avance.">
          <Card className="max-w-md gap-6 p-6">
            <StepDemo />
            <p className="font-heading text-[1.75rem] leading-tight">Qui vit à la maison ?</p>
          </Card>
        </Section>

        <Section title="Navigation" lead="Un header collant en haut ; les onglets en bas sur téléphone, dans le header à partir de 1024 px. Touche un onglet.">
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
            <EmptyState illustration={<FridgeIllustration />} title="Rien au frigo pour l’instant">
              Après le drive, range tes courses ici : l’appli s’en servira pour ta prochaine liste.
            </EmptyState>
            <EmptyState illustration={<TableForTwoIllustration />} title="Une table pour deux">
              Pour l’invitation à rejoindre un foyer : on prépare les menus à deux.
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
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4">
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
