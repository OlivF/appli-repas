import { describe, expect, it } from "vitest";
import { formData } from "@/test/helpers";
import { avatarInitials, describeMember, parseMemberForm, shortNames } from "./members";

describe("parseMemberForm", () => {
  it("transforme l'âge saisi en année de naissance", () => {
    const result = parseMemberForm(
      formData({ first_name: "  Marie-Laure ", age: "40", diets: "keto", appetite: "normal" }),
      2026,
    );
    expect(result).toEqual({
      ok: true,
      member: { first_name: "Marie-Laure", birth_year: 1986, diets: ["keto"], appetite: "normal" },
    });
  });

  it("garde le grand appétit et accepte un bébé de 0 an", () => {
    const result = parseMemberForm(formData({ first_name: "Otis", age: "0", appetite: "grand" }), 2026);
    expect(result).toEqual({
      ok: true,
      member: { first_name: "Otis", birth_year: 2026, diets: [], appetite: "grand" },
    });
  });

  it("ignore les régimes inconnus, les doublons et un appétit invalide", () => {
    const result = parseMemberForm(
      formData({
        first_name: "Timothé",
        age: "16",
        diets: ["vegetarian", "carnivore", "vegetarian"],
        appetite: "énorme",
      }),
      2026,
    );
    expect(result).toEqual({
      ok: true,
      member: { first_name: "Timothé", birth_year: 2010, diets: ["vegetarian"], appetite: "normal" },
    });
  });

  it.each([
    ["un prénom vide", { first_name: "   ", age: "40" }, "first_name"],
    ["un prénom trop long", { first_name: "x".repeat(51), age: "40" }, "first_name"],
    ["un âge manquant", { first_name: "Anna", age: "" }, "age"],
    ["un âge en lettres", { first_name: "Anna", age: "neuf" }, "age"],
    ["un âge négatif", { first_name: "Anna", age: "-1" }, "age"],
    ["un âge à virgule", { first_name: "Anna", age: "8.5" }, "age"],
    ["un âge improbable", { first_name: "Anna", age: "121" }, "age"],
  ])("refuse %s", (_, fields, field) => {
    const result = parseMemberForm(formData(fields), 2026);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveProperty(field);
  });
});

describe("shortNames", () => {
  it("abrège les prénoms pour les colonnes de la grille", () => {
    expect(shortNames(["Olivier", "Marie-Laure", "Timothé", "Anna-Lucia", "Otis"])).toEqual([
      "Oli",
      "M-L",
      "Tim",
      "A-L",
      "Oti",
    ]);
  });

  it("garde les prénoms courts tels quels", () => {
    expect(shortNames(["Al", "Léo"])).toEqual(["Al", "Léo"]);
  });

  it("revient au prénom entier quand deux abréviations se confondent", () => {
    expect(shortNames(["Anna", "Annabelle", "Paul"])).toEqual(["Anna", "Annabelle", "Pau"]);
  });

  it("numérote deux prénoms identiques", () => {
    expect(shortNames(["Léo", "Léo"])).toEqual(["Léo", "Léo 2"]);
  });
});

describe("describeMember", () => {
  it.each([
    [{ birth_year: 1986, diets: [], appetite: "normal" }, "40 ans"],
    [{ birth_year: 1986, diets: ["keto"], appetite: "normal" }, "40 ans, cétogène"],
    [{ birth_year: 2010, diets: ["vegetarian", "gluten_free"], appetite: "grand" }, "16 ans, végétarien, sans gluten, grand appétit"],
    [{ birth_year: 2025, diets: [], appetite: "normal" }, "1 an"],
    [{ birth_year: 2026, diets: [], appetite: "normal" }, "moins d'un an"],
  ] as const)("décrit %j comme « %s »", (member, expected) => {
    expect(describeMember({ ...member, diets: [...member.diets] }, 2026)).toBe(expected);
  });
});

describe("avatarInitials", () => {
  it("garde une seule lettre quand elle suffit à distinguer chacun", () => {
    expect(avatarInitials(["Marie-Laure", "Timothé", "Anna-Lucia"])).toEqual(["M", "T", "A"]);
  });

  it("passe à deux lettres pour les prénoms qui commencent pareil", () => {
    expect(avatarInitials(["Olivier", "Marie-Laure", "Timothé", "Anna-Lucia", "Otis"])).toEqual([
      "Ol",
      "M",
      "T",
      "A",
      "Ot",
    ]);
  });

  it("prend l'initiale de chaque partie d'un prénom composé", () => {
    expect(avatarInitials(["Marie-Laure", "Marc"])).toEqual(["ML", "Ma"]);
  });

  it("met la première lettre en majuscule, accents compris", () => {
    expect(avatarInitials(["élodie", "éric"])).toEqual(["Él", "Ér"]);
  });
});
