"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeInviteCode } from "@/lib/household-accounts";

// Sous le nom du foyer : « On t'a invité·e ? Entre ton code ». Le code tapé (tirets, espaces,
// minuscules tolérés) mène à la page d'invitation.
export function InviteCodeField() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" variant="link" aria-expanded={false} onClick={() => setOpen(true)}>
        On t’a invité·e ? Entre ton code
      </Button>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const code = normalizeInviteCode(value);
    if (!code) {
      setError("Un code a 8 caractères, par exemple 7KQM-3FXP.");
      return;
    }
    router.push(`/rejoindre/${code}`);
  }

  return (
    <form onSubmit={submit} className="w-full space-y-4 text-left">
      <Field id="invite-code" label="Code d’invitation" error={error}>
        {({ describedBy, invalid }) => (
          <Input
            id="invite-code"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            placeholder="7KQM-3FXP"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className="tracking-[0.12em] uppercase"
          />
        )}
      </Field>
      <Button type="submit" variant="secondary" block>
        Rejoindre avec ce code
      </Button>
    </form>
  );
}
