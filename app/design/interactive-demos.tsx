"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { BottomNav, SideNav } from "@/components/app-nav";
import { Autocomplete } from "@/components/autocomplete";
import { ChoiceChip } from "@/components/choice-chip";
import { FavoriteButton } from "@/components/favorite-button";
import { ChoiceGroup, Field } from "@/components/field";
import { MemberAvatar } from "@/components/member-avatar";
import type { CardMember } from "@/components/member-card";
import { MemberToggle } from "@/components/member-toggle";
import { SearchField } from "@/components/search-field";
import { SwitchField } from "@/components/switch-field";
import { StepProgress } from "@/components/step-progress";
import { Button } from "@/components/ui/button";
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

// Les deux barres de navigation, qu'on peut toucher pour voir la pastille glisser.
export function NavDemo() {
  const [current, setCurrent] = useState("/");
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[16rem_1fr]">
      <figure className="hidden space-y-3 lg:block">
        <SideNav demo current={current} onSelect={setCurrent} />
        <figcaption className="text-[0.875rem] text-muted-foreground">Ordinateur</figcaption>
      </figure>
      <figure className="max-w-sm space-y-3">
        <BottomNav demo current={current} onSelect={setCurrent} />
        <figcaption className="text-[0.875rem] text-muted-foreground">Téléphone</figcaption>
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
