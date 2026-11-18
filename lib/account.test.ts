import { describe, expect, it } from "vitest";
import { accountInitial } from "./account";

describe("accountInitial", () => {
  it("prend la première lettre de l'email, en majuscule", () => {
    expect(accountInitial("olivier@example.com")).toBe("O");
  });

  it("garde les accents", () => {
    expect(accountInitial("élise@example.com")).toBe("É");
  });

  it("saute ce qui n'est ni une lettre ni un chiffre", () => {
    expect(accountInitial("_marie.laure@example.com")).toBe("M");
    expect(accountInitial("2cv@example.com")).toBe("2");
  });

  it("met un point d'interrogation sans email", () => {
    expect(accountInitial(undefined)).toBe("?");
    expect(accountInitial("")).toBe("?");
  });
});
