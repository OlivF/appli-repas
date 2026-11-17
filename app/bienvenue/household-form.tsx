"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { saveHousehold, type HouseholdFormState } from "./actions";

export function HouseholdForm({ name, submitLabel }: { name: string; submitLabel: string }) {
  const [state, formAction] = useActionState<HouseholdFormState, FormData>(saveHousehold, null);

  return (
    <form action={formAction} className="mt-8 space-y-6">
      <div>
        <label htmlFor="name" className="field-label">
          Nom du foyer
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          autoComplete="off"
          placeholder="Famille Martin"
          defaultValue={state?.name ?? name}
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? "name-error" : undefined}
          className="field-input"
        />
        {state?.error && (
          <p id="name-error" role="alert" className="field-error">
            {state.error}
          </p>
        )}
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
