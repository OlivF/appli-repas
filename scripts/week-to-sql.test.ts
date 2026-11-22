import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { weekSql, type WeekFile } from "./week-to-sql";

const EMAIL = "test@example.com";

function week(repas: WeekFile["repas"], semaine = "2026-11-16"): WeekFile {
  return { semaine, repas };
}

const tuesday: WeekFile["repas"][number] = {
  jour: "mardi",
  repas: "soir",
  plats: [
    { recette: "Salade verte", pour: "tous" },
    { recette: "Tartiflette", pour: ["Olivier", "Timothé", "Anna-Lucia", "Otis"] },
    { recette: "Tartiflette de chou-fleur", pour: ["Marie-Laure"] },
  ],
};

// Les lignes de données du SQL : une par plat.
function dataRows(sql: string) {
  return sql
    .slice(sql.indexOf("insert into popote_week"), sql.indexOf("do $popote$"))
    .split("\n")
    .filter((line) => line.startsWith("  ("));
}

describe("weekSql", () => {
  it("écrit une transaction : la semaine, le foyer par l'email, un bloc do qui vérifie puis remplace", () => {
    const sql = weekSql(week([tuesday]), { email: EMAIL });
    const statements = sql.split("\n").filter((line) => /^(begin|commit);$/.test(line));
    expect(statements).toEqual(["begin;", "commit;"]);
    expect(sql.indexOf("do $popote$")).toBeGreaterThan(sql.indexOf("begin;"));
    expect(sql.indexOf("commit;")).toBeGreaterThan(sql.indexOf("end;\n$popote$;"));
    expect(sql).toContain("target_email constant text := 'test@example.com';");
    expect(sql).toContain("target_week constant date := '2026-11-16';");
    expect(sql).toContain("on conflict (household_id, week_start) do nothing");
  });

  it("une ligne par plat, dans l'ordre du fichier, avec le repas en clair pour les messages", () => {
    expect(dataRows(weekSql(week([tuesday]), { email: EMAIL }))).toEqual([
      "  (1, 1, 'soir', 'mardi soir', 1, 'Salade verte', null /* tous */),",
      "  (1, 1, 'soir', 'mardi soir', 2, 'Tartiflette', array['Olivier', 'Timothé', 'Anna-Lucia', 'Otis']),",
      "  (1, 1, 'soir', 'mardi soir', 3, 'Tartiflette de chou-fleur', array['Marie-Laure']);",
    ]);
  });

  it("« tous » : les membres du créneau, retrouvés par la base (majuscules et espaces acceptés)", () => {
    const rows = dataRows(
      weekSql(
        week([
          { jour: "Mercredi", repas: "pique_nique", plats: [{ recette: "Wraps houmous et crudités", pour: " Tous " }] },
        ]),
        { email: EMAIL },
      ),
    );
    expect(rows).toEqual(["  (1, 2, 'pique_nique', 'mercredi pique-nique', 1, 'Wraps houmous et crudités', null /* tous */);"]);
    expect(weekSql(week([tuesday]), { email: EMAIL })).toContain("and m.id = any (slot_members);");
  });

  it("échappe les apostrophes des titres, des prénoms et de l'email", () => {
    const sql = weekSql(
      week([{ jour: "jeudi", repas: "midi", plats: [{ recette: "Gratin d'endives", pour: ["D'Artagnan"] }] }]),
      { email: "o'neil@example.com" },
    );
    const [row] = dataRows(sql);
    expect(row).toBe("  (1, 3, 'midi', 'jeudi midi', 1, 'Gratin d''endives', array['D''Artagnan']);");
    // Chaque littéral est bien fermé : il ne reste aucune apostrophe hors des chaînes.
    expect(row.replace(/'(?:[^']|'')*'/g, "")).not.toContain("'");
    expect(sql).toContain("target_email constant text := 'o''neil@example.com';");
    expect(sql).toContain("where lower(u.email) = lower('o''neil@example.com')");
  });

  it("refuse un jour inconnu", () => {
    expect(() =>
      weekSql(week([{ jour: "lundy", repas: "soir", plats: [{ recette: "Tartiflette", pour: "tous" }] }]), { email: EMAIL }),
    ).toThrow("repas n° 1 : jour inconnu : « lundy » (lundi … dimanche)");
  });

  it("refuse un repas inconnu", () => {
    expect(() =>
      weekSql(week([{ jour: "lundi", repas: "diner", plats: [{ recette: "Tartiflette", pour: "tous" }] }]), { email: EMAIL }),
    ).toThrow("repas inconnu : « diner »");
  });

  it("refuse une semaine qui n'est pas un lundi, ou une date impossible", () => {
    expect(() => weekSql(week([tuesday], "2026-11-17"), { email: EMAIL })).toThrow(
      "semaine : « 2026-11-17 » n'est pas un lundi",
    );
    expect(() => weekSql(week([tuesday], "2026-02-30"), { email: EMAIL })).toThrow("n'est pas un lundi");
    expect(() => weekSql(week([tuesday], "16/11/2026"), { email: EMAIL })).toThrow("n'est pas un lundi");
  });

  it("membre servi deux plats au même repas : refusé par la base, seule à savoir ce qui est un plat", () => {
    // Salade verte (entrée) + Tartiflette pour Olivier, c'est permis ; deux plats, non. Le fichier ne
    // dit pas la sorte des recettes : le SQL la lit et compte les plats (course = 'main') de chacun.
    const sql = weekSql(
      week([
        {
          jour: "mardi",
          repas: "soir",
          plats: [
            { recette: "Tartiflette", pour: ["Olivier"] },
            { recette: "Pâtes à la bolognaise", pour: ["Olivier"] },
          ],
        },
      ]),
      { email: EMAIL },
    );
    const check = sql.slice(sql.indexOf("-- Un seul plat par personne"), sql.indexOf("-- La semaine, puis"));
    expect(check).toContain("where w.course = 'main'");
    expect(check).toContain("having count(*) > 1");
    expect(check).toContain("raise exception '% : % a deux plats, % : un seul plat par personne et par repas'");
    // La vérification précède toute écriture.
    expect(sql.indexOf("-- Un seul plat par personne")).toBeLessThan(sql.indexOf("insert into public.week_plans"));
  });

  it("refuse ce qui se voit dans le fichier : un repas ou une recette en double, un prénom deux fois", () => {
    expect(() => weekSql(week([tuesday, tuesday]), { email: EMAIL })).toThrow(
      "mardi soir : ce repas apparaît deux fois dans le fichier",
    );
    expect(() =>
      weekSql(
        week([{ jour: "mardi", repas: "soir", plats: [{ recette: "Tartiflette", pour: ["Otis"] }, { recette: "TARTIFLETTE", pour: ["Olivier"] }] }]),
        { email: EMAIL },
      ),
    ).toThrow("mardi soir : « TARTIFLETTE » apparaît deux fois");
    expect(() =>
      weekSql(week([{ jour: "mardi", repas: "soir", plats: [{ recette: "Tartiflette", pour: ["Timothé", "timothe"] }] }]), {
        email: EMAIL,
      }),
    ).toThrow("« Tartiflette » : timothe est nommé deux fois");
  });

  it("refuse un « pour » vide ou mal écrit, et un email manquant", () => {
    const dish = (pour: unknown) =>
      week([{ jour: "lundi", repas: "soir", plats: [{ recette: "Tartiflette", pour: pour as string[] }] }]);
    expect(() => weekSql(dish([]), { email: EMAIL })).toThrow('"pour" attend "tous" ou une liste de prénoms');
    expect(() => weekSql(dish("Olivier"), { email: EMAIL })).toThrow('"pour" attend "tous"');
    expect(() => weekSql(dish(["tous"]), { email: EMAIL })).toThrow("« tous » s'écrit seul");
    expect(() => weekSql(week([tuesday]), { email: "" })).toThrow("email invalide");
  });

  it("lit le fichier de la semaine du 16 novembre", () => {
    const doc = JSON.parse(readFileSync("semaines/2026-11-16.json", "utf8")) as WeekFile;
    const sql = weekSql(doc, { email: EMAIL, source: "semaines/2026-11-16.json", output: "semaines/2026-11-16.sql" });
    expect(sql.split("\n")[0]).toBe(
      "-- Semaine du lundi 16/11/2026 : 5 repas de semaines/2026-11-16.json, pour le foyer du compte test@example.com.",
    );
    const rows = dataRows(sql);
    expect(rows).toHaveLength(11);
    expect(rows.every((row) => row.includes("'soir'"))).toBe(true);
  });
});
