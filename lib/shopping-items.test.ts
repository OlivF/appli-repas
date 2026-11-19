import { describe, expect, it } from "vitest";
import { defaultShoppingWeek, parseManualItem } from "./shopping-items";

describe("parseManualItem", () => {
  it("garde le nom rogné et une quantité libre facultative", () => {
    expect(parseManualItem("  Papier   toilette ", " 2 paquets ")).toEqual({
      ok: true,
      label: "Papier toilette",
      quantityText: "2 paquets",
    });
    expect(parseManualItem("Café", "   ")).toEqual({ ok: true, label: "Café", quantityText: null });
  });

  it("refuse un nom vide", () => {
    expect(parseManualItem("   ", "2")).toEqual({ ok: false, error: "Écris le nom de l'article." });
  });

  it("refuse un nom ou une quantité trop longs", () => {
    expect(parseManualItem("a".repeat(81), "")).toEqual({
      ok: false,
      error: "Ce nom est trop long (80 caractères au plus).",
    });
    expect(parseManualItem("Café", "1".repeat(41))).toEqual({
      ok: false,
      error: "Cette quantité est trop longue (40 caractères au plus).",
    });
  });
});

describe("defaultShoppingWeek", () => {
  // Jeudi 19 novembre 2026 : semaine en cours du 16, semaine prochaine du 23.
  const today = "2026-11-19";

  it("la semaine prochaine si elle a un menu", async () => {
    expect(await defaultShoppingWeek(today, async (week) => week === "2026-11-23")).toBe("2026-11-23");
  });

  it("sinon la semaine en cours", async () => {
    expect(await defaultShoppingWeek(today, async () => false)).toBe("2026-11-16");
  });
});
