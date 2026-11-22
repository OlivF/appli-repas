import { DndContext } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrashZone } from "./board-pieces";

describe("TrashZone", () => {
  it("au repos : « Retirer du menu »", () => {
    render(
      <DndContext>
        <TrashZone over={false} demo />
      </DndContext>,
    );
    const zone = screen.getByTestId("trash-zone");
    expect(zone).toHaveTextContent("Retirer du menu");
    expect(zone).toHaveAttribute("data-over", "false");
  });

  it("un plat au-dessus : « Lâche pour retirer »", () => {
    render(
      <DndContext>
        <TrashZone over demo />
      </DndContext>,
    );
    const zone = screen.getByTestId("trash-zone");
    expect(zone).toHaveTextContent("Lâche pour retirer");
    expect(zone).not.toHaveTextContent("Retirer du menu");
    expect(zone).toHaveAttribute("data-over", "true");
  });

  it("hors démo, fixée en bas de l'écran au-dessus de la barre d'onglets", () => {
    render(
      <DndContext>
        <TrashZone over={false} />
      </DndContext>,
    );
    expect(screen.getByTestId("trash-zone")).toHaveClass("fixed");
  });
});
