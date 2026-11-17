import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LEA, PAUL } from "@/test/helpers";
import { MealGrid } from "./meal-grid";

const members = [
  { id: PAUL, first_name: "Paul" },
  { id: LEA, first_name: "Léa" },
];

describe("MealGrid", () => {
  it("affiche un tableau par repas, jours en lignes et membres en colonnes", () => {
    render(<MealGrid members={members} selected={[]} />);

    const tables = screen.getAllByRole("table");
    expect(tables.map((table) => within(table).getByRole("caption").textContent)).toEqual([
      "Petit-déj",
      "Midi",
      "Pique-nique",
      "Dîner",
    ]);

    const lunch = screen.getByRole("table", { name: "Midi" });
    expect(within(lunch).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual([
      "Lun",
      "Mar",
      "Mer",
      "Jeu",
      "Ven",
      "Sam",
      "Dim",
    ]);
    expect(within(lunch).getAllByRole("checkbox")).toHaveLength(14);
  });

  it("coche les cases déjà sélectionnées", () => {
    render(<MealGrid members={members} selected={[`0:soir:${PAUL}`]} />);

    expect(screen.getByRole("checkbox", { name: "Dîner lundi : Paul" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Dîner lundi : Léa" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Midi lundi : Paul" })).not.toBeChecked();
  });

  it("envoie les cases cochées avec le formulaire", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="repas">
        <MealGrid members={members} selected={[`0:soir:${PAUL}`]} />
      </form>,
    );

    await user.click(screen.getByRole("checkbox", { name: "Midi mercredi : Léa" }));
    await user.click(screen.getByRole("checkbox", { name: "Dîner lundi : Paul" }));

    const form = screen.getByRole("form", { name: "repas" }) as HTMLFormElement;
    expect(new FormData(form).getAll("cells")).toEqual([`2:midi:${LEA}`]);
  });
});
