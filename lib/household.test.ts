import { describe, expect, it } from "vitest";
import { formData } from "@/test/helpers";
import { nextOnboardingStep, parseHouseholdName } from "./household";

describe("parseHouseholdName", () => {
  it("garde le nom saisi sans les espaces autour", () => {
    expect(parseHouseholdName(formData({ name: "  Famille Durand " }))).toEqual({
      ok: true,
      name: "Famille Durand",
    });
  });

  it.each([
    ["vide", "   "],
    ["trop long", "x".repeat(81)],
  ])("refuse un nom %s", (_, name) => {
    expect(parseHouseholdName(formData({ name })).ok).toBe(false);
  });
});

describe("nextOnboardingStep", () => {
  it.each([
    [{ hasHousehold: false, memberCount: 0, slotCount: 0 }, "/bienvenue"],
    [{ hasHousehold: true, memberCount: 0, slotCount: 0 }, "/bienvenue/membres"],
    [{ hasHousehold: true, memberCount: 2, slotCount: 0 }, "/bienvenue/repas"],
    [{ hasHousehold: true, memberCount: 2, slotCount: 5 }, null],
  ])("pour %j, renvoie vers %s", (state, expected) => {
    expect(nextOnboardingStep(state)).toBe(expected);
  });
});
