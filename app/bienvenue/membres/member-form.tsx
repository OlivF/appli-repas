"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { DIETS, type Appetite, type Diet } from "@/lib/members";
import { saveMember, type MemberFormState } from "./actions";

type EditedMember = {
  id: string;
  first_name: string;
  age: number;
  diets: Diet[];
  appetite: Appetite;
};

export function MemberForm({ member }: { member: EditedMember | null }) {
  const [state, formAction] = useActionState<MemberFormState, FormData>(saveMember, null);

  // Après une erreur, on réaffiche ce qui a été saisi.
  const firstName = state?.values.first_name ?? member?.first_name ?? "";
  const age = state?.values.age ?? (member ? String(member.age) : "");
  const diets: string[] = state?.values.diets ?? member?.diets ?? [];
  const appetite = state?.values.appetite ?? member?.appetite ?? "normal";
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="mt-4 space-y-6">
      {member && <input type="hidden" name="id" value={member.id} />}

      <div>
        <label htmlFor="first_name" className="field-label">
          Prénom
        </label>
        <input
          id="first_name"
          name="first_name"
          required
          maxLength={50}
          autoComplete="off"
          defaultValue={firstName}
          aria-invalid={errors.first_name ? true : undefined}
          aria-describedby={errors.first_name ? "first_name-error" : undefined}
          className="field-input"
        />
        {errors.first_name && (
          <p id="first_name-error" className="field-error">
            {errors.first_name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="age" className="field-label">
          Âge
        </label>
        <div className="flex items-center gap-3">
          <input
            id="age"
            name="age"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            maxLength={3}
            autoComplete="off"
            defaultValue={age}
            aria-invalid={errors.age ? true : undefined}
            aria-describedby={errors.age ? "age-error" : undefined}
            className="field-input w-24 text-center"
          />
          <span className="font-bold text-ink-soft">ans</span>
        </div>
        {errors.age && (
          <p id="age-error" className="field-error">
            {errors.age}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="field-label">Régimes</legend>
        <div className="flex flex-wrap gap-2">
          {DIETS.map((diet) => (
            <label key={diet.value} className="choice">
              <input
                type="checkbox"
                name="diets"
                value={diet.value}
                defaultChecked={diets.includes(diet.value)}
              />
              {diet.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="field-label">Appétit</legend>
        <div className="flex flex-wrap gap-2">
          <label className="choice">
            <input
              type="radio"
              name="appetite"
              value="normal"
              defaultChecked={appetite !== "grand"}
            />
            Normal
          </label>
          <label className="choice">
            <input
              type="radio"
              name="appetite"
              value="grand"
              defaultChecked={appetite === "grand"}
            />
            Grand appétit
          </label>
        </div>
      </fieldset>

      {errors.form && (
        <p role="alert" className="field-error">
          {errors.form}
        </p>
      )}

      {member ? (
        <div className="space-y-3">
          <SubmitButton>Enregistrer</SubmitButton>
          <p className="text-center">
            <Link href="/bienvenue/membres" className="text-link">
              Annuler
            </Link>
          </p>
        </div>
      ) : (
        <SubmitButton variant="secondary">Ajouter</SubmitButton>
      )}
    </form>
  );
}
