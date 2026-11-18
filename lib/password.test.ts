import { describe, expect, it } from "vitest";
import { parseNewPassword } from "./password";

const form = (password?: string) => {
  const data = new FormData();
  if (password !== undefined) data.set("password", password);
  return data;
};

describe("parseNewPassword", () => {
  it("refuse un champ vide", () => {
    expect(parseNewPassword(form())).toEqual({ ok: false, error: "Choisis un nouveau mot de passe." });
    expect(parseNewPassword(form(""))).toMatchObject({ ok: false });
  });

  it("refuse moins de 6 caractères", () => {
    expect(parseNewPassword(form("12345"))).toEqual({
      ok: false,
      error: "Choisis un mot de passe d'au moins 6 caractères.",
    });
  });

  it("accepte 6 caractères, espaces compris", () => {
    expect(parseNewPassword(form("123456"))).toEqual({ ok: true, password: "123456" });
    expect(parseNewPassword(form(" a b c "))).toEqual({ ok: true, password: " a b c " });
  });
});
