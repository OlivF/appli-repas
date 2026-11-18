import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRAND_COLORS, COCOTTE_PARTS, cocotteSvg, tileSvg } from "./cocotte";

describe("logo de Popote", () => {
  it("app/icon.svg suit le dessin de la cocotte (sinon : relancer scripts/brand-icons.mjs)", () => {
    const expected = cocotteSvg({ tomato: BRAND_COLORS.tomato, brown: BRAND_COLORS.brown, darkBrown: BRAND_COLORS.cream });
    expect(readFileSync("app/icon.svg", "utf8")).toBe(expected);
  });

  it("garde deux couleurs : tomate et brun", () => {
    expect(new Set(COCOTTE_PARTS.map((part) => part.color))).toEqual(new Set(["tomato", "brown"]));
  });

  it("dans un onglet sombre, le couvercle passe en crème", () => {
    const svg = cocotteSvg({ tomato: "#e4572e", brown: "#2b2118", darkBrown: "#f6eee3" });
    expect(svg).toContain("@media (prefers-color-scheme: dark){.brown{fill:#f6eee3}}");
  });

  it("centre la cocotte dans la tuile de l'appli", () => {
    const svg = tileSvg({ size: 100, radius: 0.2, scale: 0.6 });
    expect(svg).toContain('rx="20"');
    expect(svg).toContain("translate(20 20) scale(1.88)");
  });
});
