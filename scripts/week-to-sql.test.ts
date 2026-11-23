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
    .slice(sql.indexOf("insert into popote_week"))
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line, i, lines) => line.startsWith("(") && lines.slice(0, i).every((before) => before.startsWith("(")));
}

// Le SQL sans ses commentaires ni ses lignes vides.
function code(sql: string) {
  return sql
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("--"))
    .join("\n");
}

describe("weekSql", () => {
  it("tient en une instruction : le SQL Editor de Supabase ne garde rien d'une instruction à l'autre", () => {
    // Le SQL Editor hébergé joue chaque instruction à part : une table temporaire créée par l'une
    // n'existe plus pour la suivante (erreur 42P01). Tout vit donc dans le bloc do, atomique à lui
    // seul ; après lui, seul le récapitulatif, qui ne dépend de rien.
    const sql = weekSql(week([tuesday]), { email: EMAIL });
    const body = code(sql);
    expect(body.startsWith("do $popote$\n")).toBe(true);
    const end = body.indexOf("\nend;\n$popote$;\n");
    expect(end).toBeGreaterThan(0);
    const after = body.slice(end + "\nend;\n$popote$;\n".length);
    expect(after.startsWith("select ")).toBe(true);
    expect(after.match(/;/g)).toEqual([";"]);
    expect(body).not.toMatch(/^(begin|commit);$/m);

    // La table et la fonction temporaires naissent et meurent dans le bloc.
    const block = body.slice(0, end);
    for (const fragment of [
      "create or replace function pg_temp.popote_key(raw text)",
      "create temp table popote_week (",
      "insert into popote_week (meal, day, meal_type, label, n, recipe, eaters) values",
      "drop table popote_week;",
      "drop function pg_temp.popote_key(text);",
    ]) {
      expect(block).toContain(fragment);
    }
    expect(block.indexOf("create temp table popote_week (")).toBeLessThan(block.indexOf("for dish in select"));
    expect(block.indexOf("drop table popote_week;")).toBeGreaterThan(block.indexOf("insert into public.planned_meals"));
  });

  it("le bloc retrouve la semaine et le foyer par l'email, vérifie puis remplace", () => {
    const sql = weekSql(week([tuesday]), { email: EMAIL });
    expect(sql).toContain("target_email constant text := 'test@example.com';");
    expect(sql).toContain("target_week constant date := '2026-11-16';");
    expect(sql).toContain("on conflict (household_id, week_start) do nothing");
  });

  it("une ligne par plat, dans l'ordre du fichier, avec le repas en clair pour les messages", () => {
    expect(dataRows(weekSql(week([tuesday]), { email: EMAIL }))).toEqual([
      "(1, 1, 'soir', 'mardi soir', 1, 'Salade verte', null /* tous */),",
      "(1, 1, 'soir', 'mardi soir', 2, 'Tartiflette', array['Olivier', 'Timothé', 'Anna-Lucia', 'Otis']),",
      "(1, 1, 'soir', 'mardi soir', 3, 'Tartiflette de chou-fleur', array['Marie-Laure']);",
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
    expect(rows).toEqual(["(1, 2, 'pique_nique', 'mercredi pique-nique', 1, 'Wraps houmous et crudités', null /* tous */);"]);
    expect(weekSql(week([tuesday]), { email: EMAIL })).toContain("and m.id = any (slot_members);");
  });

  it("les présents : ceux du repas cette semaine (changé pour la semaine), sinon ceux du foyer", () => {
    const sql = weekSql(week([tuesday]), { email: EMAIL });
    // La semaine est cherchée avant les plats : elle peut avoir des repas changés.
    expect(sql.indexOf("into plan_id")).toBeLessThan(sql.indexOf("for dish in select"));
    expect(sql).toContain("private.week_slot_members(plan_id, dish.day, dish.meal_type)");
    expect(sql).toContain("ce repas n''a pas lieu cette semaine");
    expect(sql).toContain("unnest(private.week_slot_members(plan_id, w.day, w.meal_type))");
    expect(sql).not.toContain("join public.meal_slots s on");
  });

  it("échappe les apostrophes des titres, des prénoms et de l'email", () => {
    const sql = weekSql(
      week([{ jour: "jeudi", repas: "midi", plats: [{ recette: "Gratin d'endives", pour: ["D'Artagnan"] }] }]),
      { email: "o'neil@example.com" },
    );
    const [row] = dataRows(sql);
    expect(row).toBe("(1, 3, 'midi', 'jeudi midi', 1, 'Gratin d''endives', array['D''Artagnan']);");
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

  describe("absents", () => {
    const mondayWithout: WeekFile["repas"][number] = {
      jour: "lundi",
      repas: "soir",
      absents: ["Marie-Laure"],
      plats: [
        { recette: "Salade verte", pour: "tous" },
        { recette: "Poisson pané, polenta à la tomate et petits pois", pour: ["Olivier", "Timothé", "Anna-Lucia", "Otis"] },
      ],
    };

    // Les lignes des repas changés : une par repas qui a des absents.
    function absenceRows(sql: string) {
      const start = sql.indexOf("for absence in");
      if (start < 0) return [];
      return sql
        .slice(start, sql.indexOf(") as a (meal, day, meal_type, label, names)", start))
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("("));
    }

    it("le repas change pour la semaine (réglage du foyer moins les absents), avant les plats", () => {
      const sql = weekSql(week([tuesday, mondayWithout]), { email: EMAIL });
      expect(absenceRows(sql)).toEqual(["(2, 0, 'soir', 'lundi soir', array['Marie-Laure'])"]);

      const section = sql.slice(sql.indexOf("for absence in"), sql.indexOf("coalesce(previous_claims, '')"));
      // Le réglage du foyer, pas les présents de la semaine : le fichier décide seul, et rejouer
      // donne le même repas.
      expect(section).toContain("from public.meal_slots s");
      expect(section).not.toContain("week_slot_members");
      expect(section).toContain("eater_ids := array_remove(eater_ids, matches[1]);");
      expect(section).toContain("perform public.set_week_meal(household, target_week, absence.day, absence.meal_type, eater_ids);");

      // Avant de chercher la semaine et de lire les présents de chaque plat : les « tous » de ce
      // repas n'ont plus les absents.
      const change = sql.indexOf("perform public.set_week_meal(");
      expect(change).toBeLessThan(sql.indexOf("into plan_id"));
      expect(change).toBeLessThan(sql.indexOf("for dish in select"));
      expect(sql).toContain("private.week_slot_members(plan_id, dish.day, dish.meal_type)");
      // Dans le bloc : au premier problème, le repas changé est annulé avec le reste.
      expect(change).toBeGreaterThan(sql.indexOf("do $popote$"));
      expect(change).toBeLessThan(sql.indexOf("\nend;\n$popote$;"));
    });

    it("set_week_meal veut un compte du foyer : le bloc prend celui de l'email, puis le rend", () => {
      // Le SQL Editor et psql n'ont pas d'utilisateur connecté : auth.uid() serait vide.
      const sql = weekSql(week([mondayWithout]), { email: EMAIL });
      expect(sql).toContain("select hu.household_id, u.id into household, account");
      const take = sql.indexOf("perform set_config('request.jwt.claims', json_build_object('sub', account)::text, true);");
      const give = sql.indexOf("perform set_config('request.jwt.claims', coalesce(previous_claims, ''), true);");
      expect(sql.indexOf("previous_claims := current_setting('request.jwt.claims', true);")).toBeLessThan(take);
      expect(take).toBeLessThan(sql.indexOf("perform public.set_week_meal("));
      expect(give).toBeGreaterThan(sql.indexOf("perform public.set_week_meal("));
      expect(give).toBeLessThan(sql.indexOf("for dish in select"));
    });

    it("la base vérifie ce que le fichier ne sait pas : le prénom, sa présence au repas, quelqu'un qui reste", () => {
      const sql = weekSql(week([mondayWithout]), { email: EMAIL });
      expect(sql).toContain("personne ne s''appelle « % » dans le foyer (absents)");
      expect(sql).toContain("% est dans les absents, mais ne vient pas à ce repas dans le foyer");
      expect(sql).toContain("ce repas n''a pas lieu dans le foyer : personne ne peut en être absent");
      expect(sql).toContain("tout le monde est absent : retire ce repas du fichier");
      expect(sql).toContain("'%s : sans %s cette semaine'");
    });

    it("sans absents (ou une liste vide), le SQL ne change pas", () => {
      for (const meal of [tuesday, { ...tuesday, absents: [] }]) {
        const sql = weekSql(week([meal]), { email: EMAIL });
        expect(sql).not.toContain("set_week_meal");
        expect(sql).not.toContain("request.jwt.claims");
        expect(sql).toContain("select hu.household_id into household\n");
      }
    });

    it("refuse des absents mal écrits, ou un absent qui mange au même repas", () => {
      const monday = (absents: unknown, plats = mondayWithout.plats) =>
        week([{ ...mondayWithout, absents: absents as string[], plats }]);
      expect(() => weekSql(monday("Marie-Laure"), { email: EMAIL })).toThrow(
        'lundi soir : "absents" attend une liste de prénoms',
      );
      expect(() => weekSql(monday([" "]), { email: EMAIL })).toThrow("lundi soir : un prénom des absents est vide");
      expect(() => weekSql(monday(["Tous"]), { email: EMAIL })).toThrow(
        "lundi soir : « tous » ne peut pas être absent : retire plutôt ce repas du fichier",
      );
      expect(() => weekSql(monday(["Otis", "otis"]), { email: EMAIL })).toThrow("lundi soir : otis est absent deux fois");
      expect(() =>
        weekSql(monday(["Marie-Laure"], [{ recette: "Salade verte", pour: ["Olivier", "marie-laure"] }]), { email: EMAIL }),
      ).toThrow("lundi soir : marie-laure est absent, mais mange « Salade verte »");
    });
  });

  it("lit le fichier de la semaine du 23 novembre : Marie-Laure ne dîne pas le lundi", () => {
    const doc = JSON.parse(readFileSync("semaines/2026-11-23.json", "utf8")) as WeekFile;
    const sql = weekSql(doc, { email: EMAIL, source: "semaines/2026-11-23.json", output: "semaines/2026-11-23.sql" });
    expect(sql.split("\n")[0]).toBe(
      "-- Semaine du lundi 23/11/2026 : 9 repas de semaines/2026-11-23.json, pour le foyer du compte test@example.com.",
    );
    expect(dataRows(sql)).toHaveLength(17);
    expect(sql).toContain("(2, 0, 'soir', 'lundi soir', array['Marie-Laure'])");
    expect(sql.match(/perform public\.set_week_meal\(/g)).toHaveLength(1);
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
