import { describe, expect, it } from "vitest";
import {
  accountErrorKind,
  accountLabel,
  canManageAccounts,
  formatInviteCode,
  inviteExpiryLabel,
  inviteShareText,
  inviteUrl,
  leaveConsequence,
  normalizeInviteCode,
} from "./household-accounts";

describe("normalizeInviteCode", () => {
  it("met en majuscules et retire espaces et tirets", () => {
    expect(normalizeInviteCode(" 7kqm-3fxp ")).toBe("7KQM3FXP");
    expect(normalizeInviteCode("7KQM 3FXP")).toBe("7KQM3FXP");
    expect(normalizeInviteCode("7KQM3FXP")).toBe("7KQM3FXP");
  });

  it("accepte le tiret long que glisse le clavier du téléphone", () => {
    expect(normalizeInviteCode("7KQM – 3FXP")).toBe("7KQM3FXP");
    expect(normalizeInviteCode("7KQM—3FXP")).toBe("7KQM3FXP");
  });

  it("refuse ce qui n'est pas 8 caractères de l'alphabet", () => {
    expect(normalizeInviteCode("7KQM3FX")).toBeNull();
    expect(normalizeInviteCode("7KQM3FXPA")).toBeNull();
    // 0, O, 1, I et L ne sont jamais dans un code.
    expect(normalizeInviteCode("7KQM3FX0")).toBeNull();
    expect(normalizeInviteCode("7KQM3FXO")).toBeNull();
    expect(normalizeInviteCode("7KQM3FX1")).toBeNull();
    expect(normalizeInviteCode("7KQM3FXI")).toBeNull();
    expect(normalizeInviteCode("7kqm3fxl")).toBeNull();
    expect(normalizeInviteCode("")).toBeNull();
    expect(normalizeInviteCode("7KQM_3FXP")).toBeNull();
  });
});

describe("formatInviteCode", () => {
  it("coupe le code en deux pour le dicter", () => {
    expect(formatInviteCode("7KQM3FXP")).toBe("7KQM-3FXP");
  });
});

describe("inviteUrl", () => {
  it("mène à /rejoindre/<code>", () => {
    expect(inviteUrl("https://popote.app", "7KQM3FXP")).toBe("https://popote.app/rejoindre/7KQM3FXP");
  });
});

describe("inviteShareText", () => {
  it("dit quel foyer et donne le lien", () => {
    expect(inviteShareText("Famille F", "https://popote.app/rejoindre/7KQM3FXP")).toBe(
      "Rejoins le foyer « Famille F » sur Popote pour qu’on prépare les menus à deux : https://popote.app/rejoindre/7KQM3FXP",
    );
  });
});

describe("accountLabel", () => {
  const members = [
    { id: "m1", first_name: "Olivier" },
    { id: "m2", first_name: "Marie-Laure" },
  ];

  it("prend le prénom du mangeur « C'est moi »", () => {
    expect(accountLabel({ email: "ml@example.com", member_id: "m2" }, members)).toBe("Marie-Laure");
  });

  it("prend l'email sans « C'est moi »", () => {
    expect(accountLabel({ email: "ml@example.com", member_id: null }, members)).toBe("ml@example.com");
  });

  it("prend l'email si le mangeur n'est plus là", () => {
    expect(accountLabel({ email: "ml@example.com", member_id: "m9" }, members)).toBe("ml@example.com");
  });
});

describe("inviteExpiryLabel", () => {
  it("donne le jour et le mois", () => {
    expect(inviteExpiryLabel("2026-11-26T20:15:00Z", "2026-11-19")).toBe("Valable jusqu’au jeu. 26 nov.");
    expect(inviteExpiryLabel("2026-12-01T09:00:00Z", "2026-11-24")).toBe("Valable jusqu’au mar. 1er déc.");
  });

  it("compte en heure de Paris", () => {
    // 23 h 30 UTC le 26 = 0 h 30 le 27 à Paris.
    expect(inviteExpiryLabel("2026-11-26T23:30:00Z", "2026-11-20")).toBe("Valable jusqu’au ven. 27 nov.");
  });

  it("dit « demain » et « aujourd'hui »", () => {
    expect(inviteExpiryLabel("2026-11-21T18:00:00Z", "2026-11-20")).toBe("Valable jusqu’à demain");
    expect(inviteExpiryLabel("2026-11-20T18:00:00Z", "2026-11-20")).toBe("Valable encore aujourd’hui");
  });
});

describe("canManageAccounts", () => {
  it("seul un admin gère les comptes", () => {
    expect(canManageAccounts("admin")).toBe(true);
    expect(canManageAccounts("member")).toBe(false);
    expect(canManageAccounts(null)).toBe(false);
    expect(canManageAccounts(undefined)).toBe(false);
  });
});

describe("leaveConsequence", () => {
  it("seul compte : le foyer est supprimé", () => {
    expect(leaveConsequence({ accountCount: 1, isLastAdmin: true })).toBe("delete_household");
  });

  it("dernier à pouvoir inviter : le plus ancien des autres le pourra", () => {
    expect(leaveConsequence({ accountCount: 3, isLastAdmin: true })).toBe("promote_oldest");
  });

  it("sinon on part, simplement", () => {
    expect(leaveConsequence({ accountCount: 2, isLastAdmin: false })).toBe("leave");
  });
});

describe("accountErrorKind", () => {
  it("reconnaît les codes des fonctions du foyer", () => {
    expect(accountErrorKind("HA001")).toBe("already_in_household");
    expect(accountErrorKind("HA002")).toBe("invalid_invite");
    expect(accountErrorKind("HA003")).toBe("last_admin");
    expect(accountErrorKind("HA004")).toBe("too_many_invites");
    expect(accountErrorKind("HA005")).toBe("cannot_remove_self");
    expect(accountErrorKind("42501")).toBe("not_allowed");
    expect(accountErrorKind("P0002")).toBe("not_found");
    expect(accountErrorKind("23505")).toBe("member_taken");
  });

  it("le reste est inconnu", () => {
    expect(accountErrorKind("08006")).toBe("unknown");
    expect(accountErrorKind(undefined)).toBe("unknown");
  });
});
