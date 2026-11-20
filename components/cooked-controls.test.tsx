import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CookedControls } from "./cooked-controls";

describe("CookedControls", () => {
  it("« Pas cuisiné » se bascule", async () => {
    const onSkippedChange = vi.fn();
    render(<CookedControls skipped={false} onSkippedChange={onSkippedChange} onLeftover={vi.fn()} />);
    await userEvent.click(screen.getByRole("switch", { name: "Pas cuisiné" }));
    expect(onSkippedChange).toHaveBeenCalledWith(true);
  });

  it("« Il en reste » : 1 part par défaut, − / +, puis « Ranger au frigo »", async () => {
    const onLeftover = vi.fn(async () => null);
    render(<CookedControls skipped={false} onSkippedChange={vi.fn()} onLeftover={onLeftover} />);
    await userEvent.click(screen.getByRole("button", { name: "Il en reste" }));
    expect(screen.getByText("1 part")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Une part de moins" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Une part de plus" }));
    expect(screen.getByText("2 parts")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ranger au frigo" }));
    expect(onLeftover).toHaveBeenCalledWith(2);
  });
});
