import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav, TopNav } from "./app-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/frigo" }));

describe("navigation", () => {
  it("cinq onglets, le Frigo entre les Courses et le Foyer", () => {
    render(<BottomNav />);
    const tabs = within(screen.getByRole("navigation")).getAllByRole("link");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Semaine", "Recettes", "Courses", "Frigo", "Foyer"]);
    expect(screen.getByRole("link", { name: "Frigo" })).toHaveAttribute("aria-current", "page");
  });

  it("la pastille du Frigo dit combien d'articles finir vite", () => {
    render(<BottomNav fridgeCount={2} />);
    const fridge = screen.getByRole("link", { name: /Frigo/ });
    expect(fridge).toHaveAccessibleName("Frigo, 2 articles à finir vite");
    expect(within(fridge).getByText("2")).toBeInTheDocument();
  });

  it("pas de pastille à 0, ni dans le header", () => {
    render(<TopNav fridgeCount={0} />);
    expect(screen.getByRole("link", { name: "Frigo" })).toBeInTheDocument();
  });
});
