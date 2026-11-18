# Popote : nom, logo, header, page d'accueil — design

Validé le 2026-11-18 (« go »). Complète CLAUDE.md et la charte de `/design`.

## Intention

L'appli prend un vrai nom, **Popote**, avec un slogan : « Les repas de la semaine, sans prise de
tête. » Elle doit pouvoir se présenter à quelqu'un qui ne la connaît pas : une page d'accueil
publique, un logo, un header commun. Les visiteurs comprennent en une minute ce que fait l'appli et
créent leur compte ; les comptes connectés vont droit à leur semaine.

## Objectifs

1. Renommage partout (metadata, package.json, README, interface, CLAUDE.md), sauf les tables et le
   dossier du projet.
2. Logo SVG fait main : 3 pistes sur `/design` (section « Logo »), l'utilisateur choisit, puis
   composant `<Logo variant="icon" | "full" />` dans `components/brand/`, `app/icon.svg`,
   `app/apple-icon.png` (180 px), icônes PWA 192 et 512 px dans `public/`,
   `app/opengraph-image.tsx` (1200×630).
3. Header commun (`components/layout/Header.tsx`).
4. Page d'accueil publique sur `/`, pages Mentions légales et Confidentialité, page Paramètres.
5. Vérification : captures Playwright, Lighthouse, `npm run build`, commit, PR.

## Hors champ

- Lier un compte à un membre du foyer.
- Personnaliser les emails d'auth : ils utilisent les modèles Supabase par défaut, rien à renommer.
- Manifeste PWA complet et installation (étape 4 de la feuille de route) : seules les icônes sont
  produites ici.

## À éviter absolument

- Faux témoignages, faux chiffres, logos de presse.
- Les prénoms de la vraie famille (foyer de test) sur la page publique : prénoms inventés.
- Une image lourde sur l'accueil : tout en SVG et composants.
- Un style fait à la main : tout passe par les composants et variables de `/design`.

## Décisions de l'utilisateur

| Sujet | Choix |
| --- | --- |
| Navigation sur ordinateur | Le header la porte ; la barre latérale disparaît. Téléphone : barre du bas inchangée |
| « Paramètres » | Page simple `/parametres` : email du compte, changer de mot de passe, liens légaux |
| Avatar du compte | Initiale de l'email, sur un rond tomate pâle |
| Lighthouse | Lancé une fois (`npx lighthouse` dans le conteneur e2e) sur un build de production, sans l'ajouter au projet |
| Pistes de logo | Les trois du message : cocotte et vapeur en cœur ; « P » assiette et fourchette ; cocotte au couvercle calendrier |
| Le reste | Proposé par Claude (ci-dessous) et validé tel quel (« go ») |

## Approches envisagées

1. **Un header unique dans le layout racine, qui lit la session côté serveur** (retenue) : une
   seule source, présent partout (accueil, connexion, pages légales, appli, `/bienvenue`,
   `/design`). La partie qui dépend de la session est dans un `Suspense` dont le repli (logo seul,
   même hauteur) évite tout saut de mise en page ; l'onglet actif se lit côté client
   (`usePathname`).
2. Un header par groupe de routes (public / appli), avec une prop « connecté » : deux endroits à
   tenir, et les pages légales vues par un compte connecté afficheraient le mauvais header.
3. Header entièrement client (session lue dans le navigateur) : un aller-retour réseau de plus et
   un clignotement entre les deux états.

## Choix de Claude, validés

- Branche `popote` depuis `main` à jour ; spec et plan dans `docs/superpowers/`.
- Metadata : `title: { default: "Popote · Les repas de la semaine, sans prise de tête.",
  template: "%s · Popote" }` ; chaque page ne donne que son titre court.
- Identifiants internes : `package.json` → `popote`, cookie `sb-popote-auth-token` (une
  reconnexion en local, aucun effet en prod), clé de stockage `popote:recettes`. Le `project_id`
  Supabase `appli-repas` reste (nom du dossier et des conteneurs).
- `/design`, section « Logo » en tête : pour chaque piste, icône à 16, 32 et 64 px, logo horizontal
  (icône + « Popote » en Fraunces 600), monochrome brun sur crème et crème sur chocolat, et l'icône
  en tuile d'appli (fond tomate arrondi). La tomate actuelle reste jusqu'au choix.
- Menu de l'avatar : `DropdownMenu` de shadcn (`radix-ui` est déjà une dépendance). Entrées : Mon
  foyer (`/foyer`), Paramètres (`/parametres`), Se déconnecter.
- `/bienvenue` : header avec logo et avatar, sans navigation (comme aujourd'hui, sans barre).
- La déconnexion ramène à `/`.
- Page de connexion : le grand titre « Nos repas » ferait doublon avec le logo ; il devient
  « Content de te revoir » (connexion) et « Crée ton compte » (inscription).
- `/` : visiteur → page d'accueil ; compte connecté → `/semaine`, ou l'étape du parcours
  `/bienvenue` si le foyer n'est pas configuré. Le proxy ouvre `/`, `/mentions-legales` et
  `/confidentialite` à tous.
- Hero : cartes sans photo (emoji du repas sur sa couleur ; la seule photo pèse 300 Ko), mini-grille
  de 3 jours × midi et soir, animation coupée si le téléphone demande moins de mouvement.
- Pages légales : titres de rubriques et `[à compléter]`.
- Mode sombre : l'accueil suit le réglage du téléphone, comme le reste de l'appli.

## Laissé au constructeur

- Le dessin exact des pistes, dans les contraintes : formes simples et pleines, lisibles à 16 px,
  2 couleurs au plus (tomate + brun foncé ; crème sur fond sombre), coins arrondis comme les cartes.
- Le détail des textes de l'accueil (chaleureux, tutoiement, phrases courtes).
