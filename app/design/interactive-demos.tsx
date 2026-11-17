"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { BottomNav, SideNav } from "@/components/app-nav";
import { ChoiceChip } from "@/components/choice-chip";
import { ChoiceGroup, Field } from "@/components/field";
import { MemberAvatar } from "@/components/member-avatar";
import type { CardMember } from "@/components/member-card";
import { StepProgress } from "@/components/step-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DIETS } from "@/lib/members";

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
