import { describe, expect, it } from "vitest";
import { UNSCALED_COURSES, courseFactor, dishFactor, memberCoefficient, portionsFor, type PortionMember } from "./portions";

// Le foyer de test, pour la semaine du lundi 23 novembre 2026.
const WEEK = "2026-11-23";
const olivier: PortionMember = { id: "olivier", birth_year: 1986, appetite: "normal" };
const marieLaure: PortionMember = { id: "marie-laure", birth_year: 1986, appetite: "normal" };
const timothe: PortionMember = { id: "timothe", birth_year: 2010, appetite: "grand" };
const annaLucia: PortionMember = { id: "anna-lucia", birth_year: 2017, appetite: "normal" };
const otis: PortionMember = { id: "otis", birth_year: 2020, appetite: "normal" };
const family = [olivier, marieLaure, timothe, annaLucia, otis];

describe("memberCoefficient", () => {
  it("1 pour un adulte, 1,5 pour un grand appétit, 0,7 pour un enfant de moins de 12 ans", () => {
    expect(memberCoefficient(olivier, WEEK)).toBe(1);
    expect(memberCoefficient(marieLaure, WEEK)).toBe(1);
    expect(memberCoefficient(timothe, WEEK)).toBe(1.5);
    expect(memberCoefficient(annaLucia, WEEK)).toBe(0.7);
    expect(memberCoefficient(otis, WEEK)).toBe(0.7);
  });

  it("compte l'âge à l'année du lundi : 12 ans, ce n'est plus un enfant", () => {
    expect(memberCoefficient({ id: "lea", birth_year: 2014, appetite: "normal" }, WEEK)).toBe(1);
    expect(memberCoefficient({ id: "lea", birth_year: 2014, appetite: "normal" }, "2025-12-29")).toBe(0.7);
  });

  it("un enfant au grand appétit compte 1,5", () => {
    expect(memberCoefficient({ id: "paul", birth_year: 2018, appetite: "grand" }, WEEK)).toBe(1.5);
  });
});

describe("portionsFor", () => {
  it("additionne les coefficients des mangeurs", () => {
    expect(portionsFor(["olivier", "timothe", "anna-lucia", "otis"], family, WEEK)).toBeCloseTo(3.9);
  });

  it("compte pour 1 un mangeur qui n'est plus dans le foyer", () => {
    expect(portionsFor(["olivier", "parti"], family, WEEK)).toBe(2);
  });
});

describe("dishFactor", () => {
  it("duo du lundi soir : la famille mange 3,9 portions d'une recette pour 4, Marie-Laure 1", () => {
    expect(dishFactor(["olivier", "timothe", "anna-lucia", "otis"], family, 4, WEEK)).toBeCloseTo(3.9 / 4);
    expect(dishFactor(["marie-laure"], family, 4, WEEK)).toBe(0.25);
  });
});

describe("courseFactor", () => {
  const all = family.map((member) => member.id);

  it("un dessert, un fruit, un fromage ou un laitage : une portion par mangeur, sans coefficient", () => {
    expect(UNSCALED_COURSES).toEqual(["dessert", "fruit", "cheese", "dairy"]);
    // Un yaourt, c'est un yaourt, même pour Timothé : 5 mangeurs, 5 yaourts.
    expect(courseFactor("dairy", all, family, 1, WEEK)).toBe(5);
    // Une mousse pour 6 mangée par les 5 : 5/6 de la recette.
    expect(courseFactor("dessert", all, family, 6, WEEK)).toBeCloseTo(5 / 6);
  });

  it("un plat ou une entrée garde les coefficients", () => {
    expect(courseFactor("main", all, family, 1, WEEK)).toBeCloseTo(4.9);
    expect(courseFactor("starter", all, family, 4, WEEK)).toBeCloseTo(4.9 / 4);
    expect(courseFactor(undefined, all, family, 4, WEEK)).toBeCloseTo(4.9 / 4);
  });
});
