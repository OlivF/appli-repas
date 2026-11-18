"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { Field, FieldError } from "@/components/field";
import { FormSubmit } from "@/components/form-submit";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { changePassword, type PasswordState } from "./actions";

// Changer de mot de passe : un seul champ (le navigateur propose d'en générer un), le minimum
// rappelé dessous, et une confirmation qui s'annonce aux lecteurs d'écran.
export function PasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(changePassword, null);
  const error = state && !state.ok ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-5">
      <Field id="new-password" label="Nouveau mot de passe" help={`${PASSWORD_MIN_LENGTH} caractères minimum.`}>
        {({ describedBy }) => (
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            aria-describedby={error ? "new-password-error" : describedBy}
            aria-invalid={error ? true : undefined}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <FormSubmit pending={pending} pendingLabel="Enregistrement…">
          Changer le mot de passe
        </FormSubmit>
        <p role="status" className="inline-flex items-center gap-2 font-semibold text-sage-deep">
          {state?.ok && !pending && (
            <>
              <Check aria-hidden="true" className="size-5" />
              C’est fait : ton mot de passe est changé.
            </>
          )}
        </p>
      </div>
      {/* Annoncée dès qu'elle apparaît (le minimum, lui, est vérifié par le navigateur). */}
      {error && (
        <FieldError id="new-password-error" alert>
          {error}
        </FieldError>
      )}
    </form>
  );
}
