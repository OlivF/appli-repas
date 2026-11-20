"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlarmClock, CookingPot, Refrigerator, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { BottomNav, TopNav } from "@/components/app-nav";
import { Autocomplete } from "@/components/autocomplete";
import { Logo } from "@/components/brand/logo";
import { ChoiceChip } from "@/components/choice-chip";
import { FavoriteButton } from "@/components/favorite-button";
import { DayStrip } from "@/components/day-strip";
import { EatersPicker } from "@/components/eaters-picker";
import { EmptySlot } from "@/components/empty-slot";
import { ChoiceGroup, Field } from "@/components/field";
import { BestBeforeChips, type BestBeforeValue } from "@/components/best-before-chips";
import { FridgeAddField } from "@/components/fridge-add-field";
import { FridgeItemRow, type FridgeRowItem } from "@/components/fridge-item-row";
import { FridgeItemSheet, type FridgeSheetTarget } from "@/components/fridge-item-sheet";
import { FridgeGroup, FridgeSection } from "@/components/fridge-section";
import { CookedControls } from "@/components/cooked-controls";
import { FridgeStrip } from "@/components/fridge-strip";
import {
  InvitePanel,
  MyPanel,
  OrganizerList,
  OrganizerPanel,
  OrganizerRow,
  PendingInviteList,
  PendingInviteRow,
  WhoAmICard,
  type Organizer,
  type OrganizerInvite,
} from "@/components/household-organizers";
import { StoreGroceriesCard } from "@/components/store-groceries";
import { AccountAvatar } from "@/components/layout/account-menu";
import { MemberAvatar } from "@/components/member-avatar";
import type { CardMember } from "@/components/member-card";
import { MemberToggle } from "@/components/member-toggle";
import { PlannedMealCard } from "@/components/planned-meal-card";
import { RecipeLibrary } from "@/components/recipe-library";
import { SameBaseNote } from "@/components/same-base-note";
import { SearchField } from "@/components/search-field";
import { AisleIcon } from "@/components/aisle-icon";
import { ShoppingAddBar } from "@/components/shopping-add-bar";
import { ShoppingAisle, ShoppingFold } from "@/components/shopping-aisle";
import { ShoppingItemSheet } from "@/components/shopping-item-sheet";
import { PantryItemRow, ShoppingItemRow, type RowItem } from "@/components/shopping-item-row";
import { SwitchField } from "@/components/switch-field";
import { StepProgress } from "@/components/step-progress";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DIETS } from "@/lib/members";
import { AISLES, UNITS, aisleLabel, incompatibleDiets, type GroceryAisle } from "@/lib/recipes";
import type { ShoppingSource } from "@/lib/shopping";
import { DEMO_BASICS, DEMO_RECIPES } from "./demo-data";

// Le header (crème translucide, ombre fine une fois la page défilée), en exemple.
function HeaderDemo({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-8 rounded-3xl border border-border/60 bg-background/80 px-5 shadow-bar ${className ?? ""}`}>
      {children}
    </div>
  );
}

const DEMO_EMAIL = "camille@example.com";

// Le header et la barre du bas, qu'on peut toucher pour voir la pastille glisser.
export function NavDemo() {
  const [current, setCurrent] = useState("/semaine");
  return (
    <div className="grid gap-8">
      <figure className="hidden space-y-3 lg:block">
        <HeaderDemo className="h-16">
          <Logo />
          <TopNav demo current={current} onSelect={setCurrent} fridgeCount={2} />
          <AccountAvatar email={DEMO_EMAIL} className="ml-auto" />
        </HeaderDemo>
        <figcaption className="text-[0.875rem] text-muted-foreground">
          Ordinateur : la navigation est dans le header, l’avatar ouvre le menu du compte.
        </figcaption>
      </figure>
      <figure className="max-w-xl space-y-3">
        <HeaderDemo className="h-16 justify-between gap-2">
          <Logo className="text-[1.375rem]" />
          <span className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-foreground">
              Se connecter
            </Button>
            <Button size="sm" className="max-sm:hidden">
              Créer mon compte
            </Button>
          </span>
        </HeaderDemo>
        <figcaption className="text-[0.875rem] text-muted-foreground">
          Visiteur : se connecter, ou créer son compte. Sur téléphone, « Se connecter » seul.
        </figcaption>
      </figure>
      <figure className="max-w-sm space-y-3">
        <HeaderDemo className="h-14 justify-between">
          <Logo className="text-[1.375rem]" />
          <AccountAvatar email={DEMO_EMAIL} />
        </HeaderDemo>
        <BottomNav demo current={current} onSelect={setCurrent} fridgeCount={2} />
        <figcaption className="text-[0.875rem] text-muted-foreground">
          Téléphone, connecté : le logo et l’avatar en haut, les onglets en bas.
        </figcaption>
      </figure>
    </div>
  );
}

// Le parcours /bienvenue : on avance d'une étape à l'autre.
export function StepDemo() {
  const [step, setStep] = useState(2);
  return (
    <div className="space-y-4">
      <StepProgress key={step} step={step} />
      <div className="flex gap-2">
        {[1, 2, 3].map((value) => (
          <Button
            key={value}
            size="sm"
            variant={value === step ? "outline" : "ghost"}
            onClick={() => setStep(value)}
          >
            Étape {value}
          </Button>
        ))}
      </div>
    </div>
  );
}

// Le panneau qui monte du bas, ici pour modifier un membre.
export function SheetDemo({ member }: { member: CardMember }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary">Ouvrir le panneau</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center gap-3">
            <MemberAvatar member={member} size="lg" />
            <div>
              <SheetTitle>Modifier {member.first_name}</SheetTitle>
              <SheetDescription>Les changements comptent dès la semaine suivante.</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
          <Field id="sheet-first-name" label="Prénom">
            {() => <Input id="sheet-first-name" defaultValue={member.first_name} autoComplete="off" />}
          </Field>
          <Field id="sheet-age" label="Âge">
            {() => (
              <div className="flex items-center gap-3">
                <Input id="sheet-age" defaultValue={member.age} inputMode="numeric" className="w-24 text-center" />
                <span className="font-semibold text-muted-foreground">ans</span>
              </div>
            )}
          </Field>
          <ChoiceGroup legend="Régimes">
            {DIETS.map((diet) => (
              <ChoiceChip key={diet.value} type="checkbox" name="diets" value={diet.value}>
                {diet.label}
              </ChoiceChip>
            ))}
          </ChoiceGroup>
          <div className="space-y-2 pt-2">
            <Button block size="lg" type="submit">
              Enregistrer
            </Button>
            <Button block variant="destructive" type="button">
              <Trash2 aria-hidden="true" />
              Retirer {member.first_name}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// La recherche de /recettes : la croix apparaît dès qu'il y a du texte.
export function SearchDemo() {
  const [query, setQuery] = useState("courgette");
  return (
    <SearchField
      id="demo-search"
      label="Chercher une recette"
      placeholder="Une recette, un ingrédient…"
      value={query}
      onValueChange={setQuery}
      className="max-w-md"
    />
  );
}

const KNOWN_INGREDIENTS: { value: string; aisle: GroceryAisle }[] = [
  { value: "Courgettes", aisle: "fruits_legumes" },
  { value: "Concombre", aisle: "fruits_legumes" },
  { value: "Crème fraîche épaisse", aisle: "cremerie" },
  { value: "Coquillettes", aisle: "epicerie" },
  { value: "Œufs", aisle: "cremerie" },
  { value: "Bœuf haché", aisle: "boucherie" },
];

// Une ligne d'ingrédient du formulaire : choisir un ingrédient connu remplit son rayon.
export function IngredientRowDemo() {
  const [name, setName] = useState("");
  const [aisle, setAisle] = useState<GroceryAisle>("autre");
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_6rem_8rem_11rem]">
      <Field id="demo-ingredient" label="Ingrédient" help="Tape « co » : les ingrédients connus arrivent.">
        {({ describedBy }) => (
          <Autocomplete
            id="demo-ingredient"
            aria-describedby={describedBy}
            value={name}
            onValueChange={setName}
            options={KNOWN_INGREDIENTS.map((item) => ({ value: item.value, hint: aisleLabel(item.aisle) }))}
            onPick={(option) => setAisle(KNOWN_INGREDIENTS.find((item) => item.value === option.value)?.aisle ?? "autre")}
            placeholder="Courgettes"
          />
        )}
      </Field>
      <Field id="demo-quantity" label="Quantité">
        {() => <Input id="demo-quantity" inputMode="decimal" defaultValue="2" />}
      </Field>
      <Field id="demo-unit" label="Unité">
        {() => (
          <NativeSelect id="demo-unit" defaultValue="piece">
            {UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Field id="demo-aisle" label="Rayon">
        {() => (
          <NativeSelect id="demo-aisle" value={aisle} onChange={(event) => setAisle(event.target.value as GroceryAisle)}>
            {AISLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
    </div>
  );
}

// « Qui n'en mange pas ? » : touche un avatar pour le barrer. Marie-Laure, cétogène,
// est barrée d'office sur un plat qui ne l'est pas.
export function MemberToggleDemo({ members }: { members: CardMember[] }) {
  const [excluded, setExcluded] = useState<string[]>(["otis"]);
  return (
    <div className="flex flex-wrap">
      {members.map((member) => {
        const blocked = incompatibleDiets(["vegetarian"], member.diets);
        return (
          <MemberToggle
            key={member.id}
            member={member}
            pressed={blocked.length > 0 || excluded.includes(member.id)}
            disabled={blocked.length > 0}
            reason={blocked.length > 0 ? DIETS.find((diet) => diet.value === blocked[0])?.short : undefined}
            onPressedChange={(pressed) =>
              setExcluded((current) => (pressed ? [...current, member.id] : current.filter((id) => id !== member.id)))
            }
          />
        );
      })}
    </div>
  );
}

export function FavoriteDemo() {
  const [on, setOn] = useState(true);
  return <FavoriteButton on={on} onToggle={setOn} />;
}

export function SwitchDemo() {
  const [batch, setBatch] = useState(true);
  return (
    <SwitchField
      id="demo-switch"
      label="Se prépare à l’avance"
      description="Pour le batch cooking du dimanche."
      checked={batch}
      onCheckedChange={setBatch}
    />
  );
}

// La barre des jours du téléphone : la pastille glisse vers le jour touché.
export function DayStripDemo({ days }: { days: { short: string; long: string; date: string }[] }) {
  const [active, setActive] = useState(0);
  return <DayStrip days={days} active={active} onSelect={setActive} layoutId="day-strip-demo" className="max-w-md" />;
}

// Trois cartes du dîner : le plat de la famille, celui de Marie-Laure (verrouillé), et un plat
// qui ne lui convient pas. Touche le cadenas, ou « Autre idée » pour passer à la recette suivante.
export function PlannedCardsDemo({ family, keto }: { family: CardMember[]; keto: CardMember }) {
  const [locked, setLocked] = useState([false, true, false]);
  const [ideas, setIdeas] = useState([3, 1, 2]);
  const eaters = [
    family.filter((member) => member.id !== keto.id),
    [keto],
    family.map((member) => ({ ...member, out: member.id === keto.id })),
  ];
  return (
    <ul className="max-w-md space-y-3">
      {eaters.map((cardEaters, index) => {
        const dish = DEMO_RECIPES[ideas[index] % DEMO_RECIPES.length];
        return (
          <li key={index}>
            <PlannedMealCard
              recipe={{ title: dish.title, minutes: dish.minutes, photo_url: null, mealType: "soir" }}
              eaters={cardEaters}
              household={family}
              locked={locked[index]}
              onToggleLock={() => setLocked((current) => current.map((on, i) => (i === index ? !on : on)))}
              onAnotherIdea={() => setIdeas((current) => current.map((idea, i) => (i === index ? idea + 1 : idea)))}
            />
          </li>
        );
      })}
    </ul>
  );
}

// Un dîner à deux plats de même base : steak-frites pour la famille, steak-haricots verts pour
// qui mange céto. Toucher les avatars d'une carte ouvre « Qui mange ce plat ? » (ici, en dessous).
export function DuoDemo({ family, keto }: { family: CardMember[]; keto: CardMember }) {
  const [picked, setPicked] = useState([keto.id]);
  const [asked, setAsked] = useState("Pour qui ?");
  const theirs = family.filter((member) => member.id !== keto.id);
  return (
    <div className="max-w-md space-y-3">
      <ul className="space-y-3">
        <li>
          <PlannedMealCard
            recipe={{ title: "Steak haché et frites", minutes: 28, photo_url: null, mealType: "soir" }}
            eaters={theirs}
            household={family}
            locked={false}
            onEaters={() => {
              setPicked(theirs.map((member) => member.id));
              setAsked("Qui mange ce plat ?");
            }}
          />
        </li>
        <li>
          <PlannedMealCard
            recipe={{ title: "Steak haché et haricots verts", minutes: 18, photo_url: null, mealType: "soir" }}
            eaters={[keto]}
            household={family}
            locked
            onEaters={() => {
              setPicked([keto.id]);
              setAsked("Qui mange ce plat ?");
            }}
          />
        </li>
      </ul>
      <SameBaseNote base="Steak haché" />
      <EmptySlot
        variant="add"
        label="Ajouter un plat au dîner de lundi"
        onClick={() => {
          setPicked(family.filter((member) => member.diets.length > 0).map((member) => member.id));
          setAsked("Pour qui ?");
        }}
      />
      <EatersPicker
        className="pt-4"
        label={asked}
        members={family}
        selected={picked}
        onChange={setPicked}
        recipe={{ diets: ["lactose_free"], excludedIds: [] }}
      />
    </div>
  );
}

// Les mêmes cartes, étroites, comme dans la grille de l'ordinateur ; la seconde est verrouillée.
export function GridCardsDemo({ family }: { family: CardMember[] }) {
  const [locked, setLocked] = useState([false, true]);
  const dishes = [
    { title: DEMO_RECIPES[0].title, minutes: 30, photo_url: null, mealType: "soir" as const },
    { title: "Pancakes moelleux", minutes: 30, photo_url: null, mealType: "petit_dej" as const },
  ];
  return (
    <>
      {dishes.map((dish, index) => (
        <PlannedMealCard
          key={dish.title}
          layout="column"
          recipe={dish}
          eaters={family}
          locked={locked[index]}
          onToggleLock={() => setLocked((current) => current.map((on, i) => (i === index ? !on : on)))}
          onAnotherIdea={() => {}}
        />
      ))}
    </>
  );
}

// La Bibliothèque, filtrée sur le dîner, pour Marie-Laure et Olivier.
export function LibraryDemo({ eaters }: { eaters: CardMember[] }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="max-w-md rounded-3xl border border-border/70 bg-card p-4 shadow-soft">
      <RecipeLibrary
        recipes={[...DEMO_RECIPES, ...DEMO_BASICS]}
        mealType="soir"
        eaters={eaters}
        onPick={(recipe) => setPicked(recipe.title)}
      />
      <p role="status" className="mt-4 text-[0.9375rem] text-muted-foreground">
        {picked ? `Choisie : ${picked}` : "Touche une recette, ou une puce des basiques, pour la choisir."}
      </p>
    </div>
  );
}

const SHOPPING_SOURCES: Record<string, ShoppingSource[]> = {
  lait: [{ recipeId: "porridge", recipeTitle: "Porridge aux pommes et à la cannelle", day: 1, mealType: "petit_dej", eaters: 5 }],
  creme: [
    { recipeId: "poulet", recipeTitle: "Poulet à la crème et aux champignons", day: 1, mealType: "soir", eaters: 5 },
    { recipeId: "saumon", recipeTitle: "Salade de saumon à la crème", day: 0, mealType: "midi", eaters: 1 },
  ],
  oeufs: [{ recipeId: "omelette", recipeTitle: "Omelette aux fines herbes", day: 3, mealType: "soir", eaters: 4 }],
};

// La liste de courses : la progression, un rayon qu'on coche (l'article coché glisse en bas),
// « … » qui ouvre « Pour quoi ? », un rayon tout pris replié, le placard, la barre d'ajout.
export function ShoppingDemo() {
  const [items, setItems] = useState<RowItem[]>([
    { id: "lait", label: "Lait", quantity: "1,8 l", checked: false, quantityChanged: false },
    { id: "creme", label: "Crème fraîche épaisse", quantity: "200 g + 2 c. à soupe", checked: false, quantityChanged: true },
    { id: "oeufs", label: "Œufs", quantity: "12", checked: true, quantityChanged: false },
  ]);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((item) => item.id === openId) ?? null;
  const done = items.filter((item) => item.checked).length + 2;
  const sorted = [...items].sort((a, b) => Number(a.checked) - Number(b.checked));
  const toggle = (id: string) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, checked: !item.checked, quantityChanged: false } : item)),
    );

  return (
    <div className="max-w-md space-y-4">
      <div>
        <p className="font-heading text-[1.625rem] leading-tight tabular-nums">{`${done} sur 34`}</p>
        <Progress value={(done / 34) * 100} aria-label="Articles pris" className="mt-2 h-1.5" />
      </div>

      <ShoppingAisle aisle="cremerie" label="Crèmerie" remaining={items.filter((item) => !item.checked).length}>
        {sorted.map((item) => (
          <ShoppingItemRow key={item.id} item={item} onToggle={() => toggle(item.id)} onMore={() => setOpenId(item.id)} />
        ))}
      </ShoppingAisle>

      <ShoppingAisle aisle="boucherie" label="Boucherie" remaining={0}>
        <ShoppingItemRow item={{ id: "steaks", label: "Steaks hachés pur bœuf", quantity: "5", checked: true, quantityChanged: false }} onToggle={() => {}} onMore={() => {}} />
        <ShoppingItemRow item={{ id: "lardons", label: "Lardons", quantity: "200 g", checked: true, quantityChanged: false }} onToggle={() => {}} onMore={() => {}} />
      </ShoppingAisle>

      <ShoppingFold icon={<AisleIcon aisle="placard" className="size-5" />} title="Placard" hint="À vérifier avant de commander">
        <PantryItemRow label="Huile d’olive" note="pour 5 recettes" onNeeded={() => {}} />
        <PantryItemRow label="Sel" note="pour 9 recettes" onNeeded={() => {}} />
      </ShoppingFold>

      <ShoppingAddBar
        fixed={false}
        options={[
          { value: "Œufs", hint: "Crèmerie" },
          { value: "Papier toilette", hint: "Autre" },
          { value: "Pain", hint: "Boulangerie" },
        ]}
        onAdd={async () => null}
      />

      <ShoppingItemSheet
        item={
          open && {
            label: open.label,
            quantity: open.quantity,
            manual: false,
            pantry: false,
            needed: false,
            quantityText: null,
            sources: SHOPPING_SOURCES[open.id] ?? [],
          }
        }
        open={open !== null}
        onOpenChange={(value) => !value && setOpenId(null)}
        onHaveIt={() => setOpenId(null)}
        onBackToPantry={() => setOpenId(null)}
        onEdit={async () => null}
        onDelete={() => setOpenId(null)}
      />
    </div>
  );
}

// Le frigo : à finir vite (périmé en tomate, bientôt en moutarde), les restes par rayon,
// « Fini » qui sort la ligne avec « Annuler », le panneau pour ranger avec ses puces de date.
const FRIDGE_TODAY = "2026-11-19";
const FRIDGE_URGENT: FridgeRowItem[] = [
  { id: "poulet", label: "Blancs de poulet", quantity: "300 g", date: { text: "Périmé hier ?", tone: "expired" } },
  { id: "courgettes", label: "Courgettes", quantity: "3", date: { text: "Aujourd’hui", tone: "soon" } },
  { id: "creme", label: "Crème fraîche épaisse", quantity: "200 g", date: { text: "Demain", tone: "soon" } },
];

export function FridgeDemo() {
  const [urgent, setUrgent] = useState(FRIDGE_URGENT);
  const [text, setText] = useState("");
  const [target, setTarget] = useState<FridgeSheetTarget | null>(null);
  const [date, setDate] = useState<BestBeforeValue>({ preset: "week", custom: "" });

  function finish(item: FridgeRowItem) {
    setUrgent((current) => current.filter((entry) => entry.id !== item.id));
    toast(`Fini : ${item.label}`, {
      action: {
        label: "Annuler",
        onClick: () => setUrgent((current) => FRIDGE_URGENT.filter((entry) => entry.id === item.id || current.includes(entry))),
      },
    });
  }

  function open(item: FridgeRowItem) {
    setTarget({ title: item.label, unit: "g", parts: false, quantity: 200, bestBefore: "2026-11-20", existing: true, reservedFor: null });
  }

  return (
    <div className="max-w-md space-y-4">
      <FridgeAddField
        sticky={false}
        value={text}
        onValueChange={setText}
        options={[
          { value: "Crème fraîche épaisse", hint: "Crèmerie" },
          { value: "Courgettes", hint: "Fruits et légumes" },
          { value: "Steaks hachés pur bœuf", hint: "Boucherie" },
        ]}
        onChoose={(label) =>
          setTarget({ title: label, unit: "g", parts: false, quantity: null, bestBefore: "2026-11-26", existing: false, reservedFor: null })
        }
      />

      <FridgeSection title="À finir vite" hint="À manger en premier" icon={<AlarmClock />} urgent>
        <ul className="border-t border-border/70">
          <AnimatePresence initial={false}>
            {urgent.map((item) => (
              <FridgeItemRow key={item.id} item={item} onOpen={() => open(item)} onFinish={() => finish(item)} />
            ))}
          </AnimatePresence>
        </ul>
      </FridgeSection>

      <FridgeSection title="Restes" icon={<Refrigerator />}>
        <div className="space-y-1">
          <FridgeGroup label="Plats" icon={<CookingPot />}>
            <FridgeItemRow
              item={{ id: "lasagnes", label: "Reste : Lasagnes", quantity: "2 parts", date: { text: "jusqu’au dim. 22", tone: "ok" } }}
              onOpen={() => {}}
              onFinish={() => {}}
            />
          </FridgeGroup>
          <FridgeGroup label="Crèmerie" icon={<AisleIcon aisle="cremerie" />}>
            <FridgeItemRow
              item={{ id: "beurre", label: "Beurre", quantity: "250 g", date: { text: "jusqu’au sam. 19 déc.", tone: "ok" } }}
              onOpen={() => {}}
              onFinish={() => {}}
            />
            <FridgeItemRow item={{ id: "lait", label: "Lait", quantity: "1 l", date: null }} onOpen={() => {}} onFinish={() => {}} />
          </FridgeGroup>
        </div>
      </FridgeSection>

      <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-soft">
        <BestBeforeChips value={date} onChange={setDate} today={FRIDGE_TODAY} />
      </div>

      <FridgeItemSheet
        target={target}
        open={target !== null}
        onOpenChange={(value) => !value && setTarget(null)}
        today={FRIDGE_TODAY}
        onSubmit={async () => {
          setTarget(null);
          return null;
        }}
        onFinish={() => setTarget(null)}
      />
    </div>
  );
}

// Le frigo ailleurs : la bande de /semaine, la carte « Range-les au frigo » des courses, une ligne
// en partie au frigo, et, dans le panneau d'un plat du jour, « Pas cuisiné » et « Il en reste ».
export function FridgeLinksDemo({ family }: { family: CardMember[] }) {
  const [checked, setChecked] = useState(false);
  const [skipped, setSkipped] = useState(true);
  const [stored, setStored] = useState(false);
  return (
    <div className="max-w-md space-y-4">
      <FridgeStrip text="À finir : blancs de poulet, crème fraîche épaisse, courgettes" />
      {!stored && <StoreGroceriesCard onStore={() => setStored(true)} onLater={() => setStored(true)} />}
      <ShoppingAisle aisle="cremerie" label="Crèmerie" remaining={checked ? 1 : 2}>
        <ShoppingItemRow
          item={{
            id: "creme",
            label: "Crème fraîche épaisse",
            quantity: "150 g",
            checked,
            quantityChanged: false,
            note: "+ 200 g au frigo",
          }}
          onToggle={() => setChecked((value) => !value)}
          onMore={() => {}}
        />
        <ShoppingItemRow
          item={{ id: "lait", label: "Lait", quantity: "1,8 l", checked: false, quantityChanged: false, note: "Tu en as peut-être au frigo" }}
          onToggle={() => {}}
          onMore={() => {}}
        />
      </ShoppingAisle>
      <PlannedMealCard
        recipe={{ title: "Lasagnes à la bolognaise", minutes: 75, photo_url: null, mealType: "soir" }}
        eaters={family}
        household={family}
        locked={false}
        skipped={skipped}
      />
      <CookedControls
        skipped={skipped}
        onSkippedChange={setSkipped}
        onLeftover={async () => {
          toast("Rangé au frigo");
          return null;
        }}
      />
    </div>
  );
}

// « Qui organise les repas » : Olivier (toi) et Marie-Laure, une invitation en attente. Touche une
// ligne : sa propre ligne ouvre « Qui es-tu à table ? », une autre le panneau de la personne ;
// « Inviter quelqu'un » ouvre le panneau d'invitation. Rien n'est enregistré.
const DEMO_TODAY = "2026-11-19";

export function OrganizersDemo({ olivier, marieLaure, family }: { olivier: CardMember; marieLaure: CardMember; family: CardMember[] }) {
  const [organizers, setOrganizers] = useState<Organizer[]>([
    { userId: "o", label: olivier.first_name, email: "olivier@example.com", member: olivier, canInvite: true, isMe: true },
    { userId: "ml", label: marieLaure.first_name, email: "marie-laure@example.com", member: marieLaure, canInvite: true, isMe: false },
  ]);
  const [invites, setInvites] = useState<OrganizerInvite[]>([
    { id: "i1", code: "7KQM3FXP", canInvite: true, expiresAt: "2026-11-26T20:15:00Z" },
  ]);
  const [panel, setPanel] = useState<{ kind: "invite"; id: string } | { kind: "me" } | { kind: "organizer"; id: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<string | null>(olivier.id);

  const invite = panel?.kind === "invite" ? invites.find((item) => item.id === panel.id) : undefined;
  const organizer = panel?.kind === "organizer" ? organizers.find((item) => item.userId === panel.id) : undefined;
  const show = (next: NonNullable<typeof panel>) => {
    setPanel(next);
    setOpen(true);
  };

  return (
    <div className="max-w-md">
      <OrganizerList>
        {organizers.map((item) => (
          <OrganizerRow
            key={item.userId}
            organizer={item}
            onSelect={() => show(item.isMe ? { kind: "me" } : { kind: "organizer", id: item.userId })}
          />
        ))}
      </OrganizerList>
      {invites.length > 0 && (
        <div className="mt-3">
          <PendingInviteList>
            {invites.map((item) => (
              <PendingInviteRow
                key={item.id}
                invite={item}
                today={DEMO_TODAY}
                onOpen={() => show({ kind: "invite", id: item.id })}
                onCancel={() => setInvites((list) => list.filter((other) => other.id !== item.id))}
              />
            ))}
          </PendingInviteList>
        </div>
      )}
      <p className="mt-3 text-[0.9375rem] text-muted-foreground">
        Les personnes ici voient et modifient tout : recettes, semaine, courses et frigo.
      </p>
      <Button
        type="button"
        variant="secondary"
        block
        className="mt-5"
        onClick={() => {
          const fresh = { id: `i${Date.now()}`, code: "GKJ6XZ63", canInvite: true, expiresAt: "2026-11-26T20:15:00Z" };
          setInvites((list) => [...list, fresh]);
          show({ kind: "invite", id: fresh.id });
        }}
      >
        <UserPlus aria-hidden="true" />
        Inviter quelqu’un
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          {invite && (
            <InvitePanel
              invite={invite}
              today={DEMO_TODAY}
              onShare={() => toast("Lien copié")}
              onCanInviteChange={(canInvite) =>
                setInvites((list) => list.map((item) => (item.id === invite.id ? { ...item, canInvite } : item)))
              }
            />
          )}
          {panel?.kind === "me" && (
            <MyPanel
              members={family.filter((member) => member.id !== marieLaure.id)}
              value={me}
              onChoose={(memberId) => {
                setMe(memberId);
                setOpen(false);
              }}
            />
          )}
          {organizer && (
            <OrganizerPanel
              key={organizer.userId}
              organizer={organizer}
              onCanInviteChange={(canInvite) =>
                setOrganizers((list) => list.map((item) => (item.userId === organizer.userId ? { ...item, canInvite } : item)))
              }
              onRemove={() => {
                setOpen(false);
                toast(`${organizer.label} ne fait plus partie du foyer`);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// La carte du haut de /foyer pour un compte qui vient d'arriver : un toucher, et elle s'en va.
export function WhoAmIDemo({ members }: { members: CardMember[] }) {
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  if (chosen !== undefined) {
    return (
      <div className="max-w-md space-y-3">
        <p className="text-muted-foreground">
          Réponse : {chosen === null ? "« Je ne mange pas ici »" : members.find((member) => member.id === chosen)?.first_name}.
        </p>
        <Button type="button" variant="secondary" onClick={() => setChosen(undefined)}>
          Revoir la carte
        </Button>
      </div>
    );
  }
  return (
    <div className="max-w-md">
      <WhoAmICard members={members} onChoose={setChosen} />
    </div>
  );
}
