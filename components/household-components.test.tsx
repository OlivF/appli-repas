import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  InvitePanel,
  OrganizerPanel,
  OrganizerRow,
  PendingInviteRow,
  WhoAmICard,
  type Organizer,
} from "./household-organizers";
import { JoinInvite } from "./join-invite";
import { Sheet, SheetContent } from "./ui/sheet";

const MARIE_LAURE = { id: "ml", first_name: "Marie-Laure", color: 1, initials: "M" };
const OTIS = { id: "otis", first_name: "Otis", color: 4, initials: "O" };

const organizer: Organizer = {
  userId: "u-ml",
  label: "Marie-Laure",
  email: "ml@example.com",
  member: MARIE_LAURE,
  canInvite: true,
  isMe: false,
};

function inSheet(children: ReactNode) {
  return (
    <Sheet open>
      <SheetContent>{children}</SheetContent>
    </Sheet>
  );
}

describe("OrganizerRow", () => {
  it("dit « (toi) » et « Peut inviter »", () => {
    render(
      <ul>
        <OrganizerRow organizer={{ ...organizer, isMe: true }} onSelect={vi.fn()} />
      </ul>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Marie-Laure (toi)Peut inviter");
  });

  it("sans onSelect, la ligne ne se touche pas", () => {
    render(
      <ul>
        <OrganizerRow organizer={{ ...organizer, label: "ml@example.com", member: null, canInvite: false }} />
      </ul>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("ml@example.com");
    expect(screen.queryByText("Peut inviter")).not.toBeInTheDocument();
  });
});

describe("PendingInviteRow", () => {
  it("rouvre l'invitation ou l'annule", async () => {
    const onOpen = vi.fn();
    const onCancel = vi.fn();
    render(
      <ul>
        <PendingInviteRow
          invite={{ id: "i", code: "7KQM3FXP", canInvite: true, expiresAt: "2026-11-26T20:15:00Z" }}
          today="2026-11-19"
          onOpen={onOpen}
          onCancel={onCancel}
        />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Invitation en attente/ }));
    expect(onOpen).toHaveBeenCalled();
    expect(screen.getByText("Valable jusqu’au jeu. 26 nov.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Annuler l’invitation 7KQM-3FXP" }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("InvitePanel", () => {
  it("montre le code à dicter, partage, et change « Pourra aussi inviter »", async () => {
    const onShare = vi.fn();
    const onCanInviteChange = vi.fn();
    render(
      inSheet(
        <InvitePanel
          invite={{ id: "i", code: "7KQM3FXP", canInvite: true, expiresAt: "2026-11-26T20:15:00Z" }}
          today="2026-11-19"
          onShare={onShare}
          onCanInviteChange={onCanInviteChange}
        />,
      ),
    );
    expect(screen.getByText("7KQM-3FXP")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Partager le lien" }));
    expect(onShare).toHaveBeenCalled();
    const toggle = screen.getByRole("switch", { name: "Pourra aussi inviter d’autres personnes" });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(onCanInviteChange).toHaveBeenCalledWith(false);
  });
});

describe("WhoAmICard", () => {
  it("un toucher suffit, y compris « Je ne mange pas ici »", async () => {
    const onChoose = vi.fn();
    render(<WhoAmICard members={[MARIE_LAURE, OTIS]} onChoose={onChoose} />);
    await userEvent.click(screen.getByRole("radio", { name: "Otis" }));
    expect(onChoose).toHaveBeenLastCalledWith("otis");
    await userEvent.click(screen.getByRole("radio", { name: "Je ne mange pas ici" }));
    expect(onChoose).toHaveBeenLastCalledWith(null);
  });
});

describe("OrganizerPanel", () => {
  it("retirer demande confirmation, en disant ce qui se passe", async () => {
    const onRemove = vi.fn();
    render(inSheet(<OrganizerPanel organizer={organizer} onCanInviteChange={vi.fn()} onRemove={onRemove} />));
    await userEvent.click(screen.getByRole("button", { name: "Retirer du foyer" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Marie-Laure ne verra plus les menus ni la liste de ce foyer. Ses recettes restent au foyer.",
    );
    expect(onRemove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Oui, retirer" }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("JoinInvite", () => {
  const invite = { householdName: "Famille F", inviterName: "Olivier" };

  it("visiteur : créer son compte ou se connecter", () => {
    render(<JoinInvite state={{ kind: "visitor", ...invite }} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tu es invité·e à rejoindre « Famille F » par Olivier");
    expect(screen.getByRole("button", { name: "Créer mon compte" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "J’ai déjà un compte" })).toBeInTheDocument();
  });

  it("avec un autre foyer : le dit sans détour, et s'il sera supprimé", async () => {
    const onJoin = vi.fn();
    render(
      <JoinInvite
        state={{ kind: "switch", ...invite, currentName: "Chez moi", deletesCurrent: true }}
        onJoin={onJoin}
        onKeep={vi.fn()}
      />,
    );
    expect(screen.getByText(/Tu as déjà le foyer « Chez moi »\. En rejoignant « Famille F », tu le quittes\./)).toBeInTheDocument();
    expect(screen.getByText("Il sera supprimé avec ses recettes et ses menus.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Quitter «\s+Chez moi\s+» et rejoindre$/ }));
    expect(onJoin).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Non, garder mon foyer" })).toBeInTheDocument();
  });

  it("lien qui ne marche plus : rien d'autre", () => {
    render(<JoinInvite state={{ kind: "invalid" }} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ce lien ne marche plus.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
