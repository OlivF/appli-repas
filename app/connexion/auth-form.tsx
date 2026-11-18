"use client";

import { useActionState } from "react";
import { FormSubmit } from "@/components/form-submit";
import { signIn, signUp, type AuthFormState } from "./actions";

export function AuthForm({ mode }: { mode: "connexion" | "inscription" }) {
  const isSignUp = mode === "inscription";
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    isSignUp ? signUp : signIn,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email}
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor="password" className="field-label">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
          minLength={isSignUp ? 6 : undefined}
          aria-describedby={isSignUp ? "password-help" : undefined}
          className="field-input"
        />
        {isSignUp && (
          <p id="password-help" className="field-help">
            6 caractères minimum.
          </p>
        )}
      </div>

      {state?.error && (
        <p role="alert" className="field-error">
          {state.error}
        </p>
      )}

      <div className="pt-2">
        {/* Le bouton de la charte : libellé de 19 px en gras, assez contrasté sur la tomate. */}
        <FormSubmit block size="lg" pendingLabel={isSignUp ? "Création du compte…" : "Connexion…"}>
          {isSignUp ? "Créer mon compte" : "Se connecter"}
        </FormSubmit>
      </div>
    </form>
  );
}
