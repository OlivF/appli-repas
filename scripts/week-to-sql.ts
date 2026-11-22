// Transforme un fichier de semaine (semaines/AAAA-MM-JJ.json) en SQL qui pose ces repas dans la
// semaine d'un foyer, retrouvé par l'email d'un de ses comptes. À coller dans le SQL Editor de
// Supabase (prod) ou à jouer en local.
//
// Générer (Node 26 exécute le TypeScript directement) :
//   docker compose exec web node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
//     scripts/week-to-sql.ts semaines/2026-11-16.json semaines/2026-11-16.sql --email test@example.com
// Jouer en local (psql n'est pas installé dans WSL ; celui du conteneur de la base l'est) :
//   docker exec -i supabase_db_appli-repas psql -U postgres -v ON_ERROR_STOP=1 < semaines/2026-11-16.sql
// Le SQL contient l'email : semaines/*.sql est ignoré par git.
//
// Format : { "semaine": "2026-11-16", "repas": [ { "jour": "lundi", "repas": "soir", "plats": [
//   { "recette": "Tartiflette", "pour": ["Olivier", "Otis"] }, { "recette": "…", "pour": "tous" } ] } ] }
// semaine : un lundi ; jour : lundi … dimanche ; repas : petit_dej | midi | soir | pique_nique ;
// "tous" : les présents du repas cette semaine (le repas tel que changé pour la semaine dans
// l'appli, « Qui est là ? », sinon le réglage du foyer).
// "absents" (facultatif, sur un repas) : { "jour": "lundi", "repas": "soir", "absents": ["Marie-Laure"],
// "plats": […] }. Le repas change pour la semaine, comme « Qui est là ? » dans l'appli : le réglage
// du foyer moins les absents (set_week_meal), avant les plats ; ses "tous" ne les comptent plus.
//
// Le script vérifie ce qui se lit dans le fichier. Le SQL vérifie le reste dans la base (foyer,
// recettes, prénoms, créneaux, et « un seul plat par personne et par repas » : seule la base sait si
// une recette est un plat ou une entrée), en un seul bloc do : au premier problème, rien ne change.
// Pas de begin/commit ni d'objet temporaire hors du bloc : le SQL Editor de Supabase joue chaque
// instruction à part, et une table temporaire créée par l'une n'existe plus pour la suivante.
// Il remplace toutes les cartes des repas du fichier, et elles seules ; les plats sont verrouillés,
// les plats légers non (comme dans l'appli). Ni liste de courses ni frigo : le bandeau « Le menu a
// changé » s'en charge.

import { readFileSync, writeFileSync } from "node:fs";

export type WeekDish = { recette: string; pour: string | string[] };
export type WeekMeal = { jour: string; repas: string; absents?: string[]; plats: WeekDish[] };
export type WeekFile = { semaine: string; repas: WeekMeal[] };

const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
// Le repas tel qu'on le dit (« mardi soir », « mercredi pique-nique »), pour les messages.
const MEALS: Record<string, string> = {
  petit_dej: "petit-déj",
  midi: "midi",
  soir: "soir",
  pique_nique: "pique-nique",
};

// Même règle que normalizeText (lib/recipes.ts), recopiée : le script tourne hors de Next. Plus
// l'apostrophe typographique, qu'un fichier tapé à la main peut contenir.
function normalize(text: string) {
  return text
    .toLocaleLowerCase("fr")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/’/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function text(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

type Row = { meal: number; day: number; mealType: string; label: string; n: number; recipe: string; eaters: string[] | null };
// Un repas qui a des absents.
type Absence = { meal: number; day: number; mealType: string; label: string; names: string[] };

function isMonday(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

// Vérifie le fichier et l'aplatit : une ligne par plat, dans l'ordre du fichier, et une par repas
// qui a des absents.
function parse(doc: WeekFile): { dishes: Row[]; absences: Absence[] } {
  if (!isMonday(doc?.semaine)) {
    throw new Error(`semaine : « ${doc?.semaine} » n'est pas un lundi (attendu : AAAA-MM-JJ, un lundi)`);
  }
  if (!Array.isArray(doc.repas) || doc.repas.length === 0) throw new Error("aucun repas dans le fichier");

  const seenMeals = new Set<string>();
  const absences: Absence[] = [];
  const dishes = doc.repas.flatMap((meal, index) => {
    const where = `repas n° ${index + 1}`;
    const day = DAYS.indexOf(normalize(String(meal?.jour ?? "")));
    if (day < 0) throw new Error(`${where} : jour inconnu : « ${meal?.jour} » (lundi … dimanche)`);
    if (typeof meal.repas !== "string" || !Object.hasOwn(MEALS, meal.repas)) {
      throw new Error(`${where} : repas inconnu : « ${meal.repas} » (petit_dej, midi, soir ou pique_nique)`);
    }
    const label = `${DAYS[day]} ${MEALS[meal.repas]}`;
    const fail = (message: string): never => {
      throw new Error(`${label} : ${message}`);
    };
    if (seenMeals.has(label)) fail("ce repas apparaît deux fois dans le fichier");
    seenMeals.add(label);
    if (!Array.isArray(meal.plats) || meal.plats.length === 0) fail("aucun plat");

    let absents: string[] = [];
    if (meal.absents !== undefined) {
      if (!Array.isArray(meal.absents)) fail('"absents" attend une liste de prénoms');
      absents = meal.absents.map((name) => (typeof name === "string" ? name.trim().replace(/\s+/g, " ") : ""));
      const keys = absents.map(normalize);
      if (keys.some((key) => key === "")) fail("un prénom des absents est vide");
      if (keys.includes("tous")) fail("« tous » ne peut pas être absent : retire plutôt ce repas du fichier");
      const twice = absents.find((_, i) => keys.indexOf(keys[i]) !== i);
      if (twice) fail(`${twice} est absent deux fois`);
      if (absents.length > 0) absences.push({ meal: index + 1, day, mealType: meal.repas, label, names: absents });
    }
    const absentKeys = new Set(absents.map(normalize));

    const seenRecipes = new Set<string>();
    return meal.plats.map((dish, position): Row => {
      const recipe = typeof dish?.recette === "string" ? dish.recette.trim().replace(/\s+/g, " ") : "";
      if (recipe.length < 1 || recipe.length > 120) fail("recette sans titre ou trop longue (120 caractères au plus)");
      if (seenRecipes.has(normalize(recipe))) fail(`« ${recipe} » apparaît deux fois`);
      seenRecipes.add(normalize(recipe));

      let eaters: string[] | null;
      if (typeof dish.pour === "string" && normalize(dish.pour) === "tous") {
        eaters = null;
      } else if (Array.isArray(dish.pour) && dish.pour.length > 0) {
        eaters = dish.pour.map((name) => (typeof name === "string" ? name.trim().replace(/\s+/g, " ") : ""));
        const keys = eaters.map(normalize);
        if (keys.some((key) => key === "")) fail(`« ${recipe} » : un prénom est vide`);
        if (keys.includes("tous")) fail(`« ${recipe} » : « tous » s'écrit seul ("pour": "tous")`);
        const twice = eaters.find((_, i) => keys.indexOf(keys[i]) !== i);
        if (twice) fail(`« ${recipe} » : ${twice} est nommé deux fois`);
        const away = eaters.find((_, i) => absentKeys.has(keys[i]));
        if (away) fail(`${away} est absent, mais mange « ${recipe} »`);
      } else {
        return fail(`« ${recipe} » : "pour" attend "tous" ou une liste de prénoms`);
      }

      return { meal: index + 1, day, mealType: meal.repas, label, n: position + 1, recipe, eaters };
    });
  });
  return { dishes, absences };
}

function absenceSql(absence: Absence) {
  return `      (${absence.meal}, ${absence.day}, ${text(absence.mealType)}, ${text(absence.label)}, array[${absence.names.map(text).join(", ")}])`;
}

// Les repas qui ont des absents changent pour la semaine, avant tout le reste : les présents de
// chaque plat se lisent ensuite dans la semaine. Rien du tout sans absents.
function absencesSql(absences: Absence[]) {
  if (absences.length === 0) return "";
  return `
  -- Les absents (« absents » dans le fichier) : le repas change pour la semaine, comme « Qui est
  -- là ? » dans l'appli. Le réglage du foyer moins les absents, et non les présents de la semaine :
  -- le fichier décide seul, rejouer donne le même repas. set_week_meal crée la semaine au besoin et
  -- retire les absents des plats déjà posés ; il veut un compte du foyer, et le SQL Editor n'a pas
  -- d'utilisateur connecté : le bloc prend l'identité du compte de l'email le temps des appels.
  previous_claims := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claims', json_build_object('sub', account)::text, true);
  for absence in
    select a.meal, a.day::smallint as day, a.meal_type::public.meal_type as meal_type, a.label, a.names
    from (values
${absences.map(absenceSql).join(",\n")}
    ) as a (meal, day, meal_type, label, names)
    order by a.meal
  loop
    select s.member_ids into slot_members
    from public.meal_slots s
    where s.household_id = household
      and s.day = absence.day
      and s.meal_type = absence.meal_type;
    if coalesce(cardinality(slot_members), 0) = 0 then
      raise exception '% : ce repas n''a pas lieu dans le foyer : personne ne peut en être absent', absence.label;
    end if;

    eater_ids := slot_members;
    foreach eater in array absence.names loop
      select array_agg(m.id) into matches
      from public.members m
      where m.household_id = household
        and pg_temp.popote_key(m.first_name) = pg_temp.popote_key(eater);
      if matches is null then
        raise exception '% : personne ne s''appelle « % » dans le foyer (absents)', absence.label, eater;
      end if;
      if cardinality(matches) > 1 then
        raise exception '% : plusieurs membres s''appellent « % »', absence.label, eater;
      end if;
      if not (matches[1] = any (slot_members)) then
        raise exception '% : % est dans les absents, mais ne vient pas à ce repas dans le foyer', absence.label, eater;
      end if;
      eater_ids := array_remove(eater_ids, matches[1]);
    end loop;
    if cardinality(eater_ids) = 0 then
      raise exception '% : tout le monde est absent : retire ce repas du fichier', absence.label;
    end if;

    perform public.set_week_meal(household, target_week, absence.day, absence.meal_type, eater_ids);
    raise notice '%', format('%s : sans %s cette semaine', absence.label, array_to_string(absence.names, ', '));
  end loop;
  perform set_config('request.jwt.claims', coalesce(previous_claims, ''), true);
`;
}

function rowSql(row: Row) {
  const eaters = row.eaters === null ? "null /* tous */" : `array[${row.eaters.map(text).join(", ")}]`;
  return `    (${row.meal}, ${row.day}, ${text(row.mealType)}, ${text(row.label)}, ${row.n}, ${text(row.recipe)}, ${eaters})`;
}

export function weekSql(
  doc: WeekFile,
  options: { email: string; source?: string; output?: string },
): string {
  const email = options.email?.trim() ?? "";
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error(`email invalide : « ${options.email ?? ""} »`);
  const { dishes: all, absences } = parse(doc);
  const meals = new Set(all.map((row) => row.meal)).size;
  const [year, month, day] = doc.semaine.split("-");
  const source = options.source ?? "<semaine>.json";
  const output = options.output ?? "<semaine>.sql";

  return `-- Semaine du lundi ${day}/${month}/${year} : ${meals} repas de ${source}, pour le foyer du compte ${email}.
-- Fichier généré, ne pas modifier à la main. Pour le régénérer :
--   docker compose exec web node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/week-to-sql.ts ${source} ${output} --email ${email}
-- En prod : coller tout le fichier dans le SQL Editor de Supabase. En local :
--   docker exec -i supabase_db_appli-repas psql -U postgres -v ON_ERROR_STOP=1 < ${output}
-- Remplace toutes les cartes des repas ci-dessous, et elles seules ; les plats sont verrouillés.
-- Tout tient dans un seul bloc do (le SQL Editor joue chaque instruction à part et n'en garde rien
-- pour la suivante) : au premier problème, rien n'est enregistré. Rejouable : les repas du fichier
-- sont remplacés.

do $popote$
declare
  target_email constant text := ${text(email)};
  target_week constant date := ${text(doc.semaine)};
  household uuid;
  plan_id uuid;
  dish record;
  problem record;
  matches uuid[];
  slot_members uuid[];
  eater_ids uuid[];
  eater text;
  found uuid;
  replaced integer;
  removed integer;
  added integer;${absences.length > 0 ? "\n  account uuid;\n  absence record;\n  previous_claims text;" : ""}
begin
  -- Le foyer, par l'email d'un de ses comptes. Le SQL Editor passe outre la RLS : chaque requête
  -- ci-dessous filtre sur ce foyer.
  select hu.household_id${absences.length > 0 ? ", u.id into household, account" : " into household"}
  from auth.users u
  join public.household_users hu on hu.user_id = u.id
  where lower(u.email) = lower(target_email);
  if household is null then
    raise exception 'Aucun foyer pour le compte « % » : vérifie l''email', target_email;
  end if;

  -- Comparer sans accents ni majuscules, comme normalizeText (lib/recipes.ts).
  create or replace function pg_temp.popote_key(raw text)
  returns text
  language sql
  immutable
  as $key$
    select btrim(regexp_replace(
      translate(
        lower(replace(replace(replace(replace(coalesce(raw, ''), 'Œ', 'oe'), 'œ', 'oe'), 'Æ', 'ae'), 'æ', 'ae')),
        'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸ’',
        'aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuyy'''),
      '[[:space:]]+', ' ', 'g'));
  $key$;
${absencesSql(absences)}
  -- La semaine, si elle existe déjà : elle peut avoir des repas changés (« Qui est là ? »).
  select wp.id into plan_id
  from public.week_plans wp
  where wp.household_id = household
    and wp.week_start = target_week;

  -- Les plats du fichier, dans l'ordre ; eaters null : tous les présents du repas.
  create temp table popote_week (
    meal smallint not null,
    day smallint not null,
    meal_type public.meal_type not null,
    label text not null,
    n smallint not null,
    recipe text not null,
    eaters text[],
    recipe_id uuid,
    course public.course,
    member_ids uuid[]
  ) on commit drop;

  insert into popote_week (meal, day, meal_type, label, n, recipe, eaters) values
${all.map(rowSql).join(",\n")};

  for dish in select * from popote_week w order by w.meal, w.n loop
    -- La recette du foyer d'abord, sinon celle du catalogue, ou sa copie dans le foyer (même
    -- renommée : la copie remplace l'original).
    select array_agg(r.id) into matches
    from public.recipes r
    where r.household_id = household
      and pg_temp.popote_key(r.title) = pg_temp.popote_key(dish.recipe);
    if cardinality(matches) > 1 then
      raise exception '% : plusieurs recettes « % » dans le foyer, renomme l''une d''elles', dish.label, dish.recipe;
    end if;
    found := matches[1];
    if found is null then
      select array_agg(r.id) into matches
      from public.recipes r
      where r.household_id is null
        and pg_temp.popote_key(r.title) = pg_temp.popote_key(dish.recipe);
      if matches is null then
        raise exception '% : recette « % » introuvable, ni dans le foyer ni au catalogue', dish.label, dish.recipe;
      end if;
      if cardinality(matches) > 1 then
        raise exception '% : plusieurs recettes « % » au catalogue', dish.label, dish.recipe;
      end if;
      found := coalesce(
        (select r.id from public.recipes r
         where r.household_id = household and r.source_recipe_id = matches[1]
         order by r.created_at limit 1),
        matches[1]);
    end if;

    -- Les mangeurs : les présents du repas cette semaine, ou ceux nommés, qui doivent en être.
    if plan_id is null then
      select s.member_ids into slot_members
      from public.meal_slots s
      where s.household_id = household
        and s.day = dish.day
        and s.meal_type = dish.meal_type;
    else
      slot_members := private.week_slot_members(plan_id, dish.day, dish.meal_type);
    end if;
    if coalesce(cardinality(slot_members), 0) = 0 then
      raise exception '% : ce repas n''a pas lieu cette semaine (ni dans le foyer, ni ajouté à la semaine dans l''appli)', dish.label;
    end if;

    if dish.eaters is null then
      -- Dans l'ordre du foyer, comme l'appli les range.
      select array_agg(m.id order by m.created_at, m.id) into eater_ids
      from public.members m
      where m.household_id = household
        and m.id = any (slot_members);
    else
      eater_ids := '{}';
      foreach eater in array dish.eaters loop
        select array_agg(m.id) into matches
        from public.members m
        where m.household_id = household
          and pg_temp.popote_key(m.first_name) = pg_temp.popote_key(eater);
        if matches is null then
          raise exception '% : personne ne s''appelle « % » dans le foyer (plat « % »)', dish.label, eater, dish.recipe;
        end if;
        if cardinality(matches) > 1 then
          raise exception '% : plusieurs membres s''appellent « % »', dish.label, eater;
        end if;
        if not (matches[1] = any (slot_members)) then
          raise exception '% : % n''est pas de ce repas (plat « % ») : ajoute-le au repas dans l''appli (« Qui est là ? »), ou retire-le du fichier', dish.label, eater, dish.recipe;
        end if;
        eater_ids := eater_ids || matches[1];
      end loop;
    end if;

    update popote_week w
    set recipe_id = found,
        course = (select r.course from public.recipes r where r.id = found),
        member_ids = eater_ids
    where w.meal = dish.meal and w.n = dish.n;
  end loop;

  -- Une même recette une seule fois par repas.
  for problem in
    select w.label, min(w.recipe) as recipe
    from popote_week w
    group by w.meal, w.label, w.recipe_id
    having count(*) > 1
    order by w.meal
    limit 1
  loop
    raise exception '% : « % » apparaît deux fois', problem.label, problem.recipe;
  end loop;

  -- Un seul plat par personne et par repas ; entrées, desserts, fruits, fromages et laitages libres.
  for problem in
    select w.label, m.first_name, string_agg('« ' || w.recipe || ' »', ' et ' order by w.n) as dishes
    from popote_week w
    cross join lateral unnest(w.member_ids) as e (id)
    join public.members m on m.id = e.id and m.household_id = household
    where w.course = 'main'
    group by w.meal, w.label, e.id, m.first_name
    having count(*) > 1
    order by w.meal
    limit 1
  loop
    raise exception '% : % a deux plats, % : un seul plat par personne et par repas', problem.label, problem.first_name, problem.dishes;
  end loop;

  -- La semaine, puis les repas du fichier, remplacés.
  insert into public.week_plans (household_id, week_start)
  values (household, target_week)
  on conflict (household_id, week_start) do nothing;

  select wp.id into plan_id
  from public.week_plans wp
  where wp.household_id = household
    and wp.week_start = target_week;

  delete from public.planned_meals p
  where p.household_id = household
    and p.week_plan_id = plan_id
    and exists (select 1 from popote_week w where w.day = p.day and w.meal_type = p.meal_type);
  get diagnostics removed = row_count;

  -- Les plats d'abord, verrouillés, puis les plats légers ; dans l'ordre du fichier.
  insert into public.planned_meals (week_plan_id, day, meal_type, position, recipe_id, member_ids, locked)
  select plan_id, w.day, w.meal_type,
         (row_number() over (partition by w.meal order by w.course <> 'main', w.n) - 1)::smallint,
         w.recipe_id, w.member_ids, w.course = 'main'
  from popote_week w;
  get diagnostics added = row_count;

  -- Ceux qui n'ont pas de plat : « Proposer » les servira.
  for problem in
    select w.label, string_agg(m.first_name, ', ' order by e.k) as names
    from (select distinct x.meal, x.label, x.day, x.meal_type from popote_week x) as w
    cross join lateral unnest(private.week_slot_members(plan_id, w.day, w.meal_type)) with ordinality as e (id, k)
    join public.members m on m.id = e.id and m.household_id = household
    where not exists (
      select 1 from popote_week x where x.meal = w.meal and x.course = 'main' and e.id = any (x.member_ids))
    group by w.meal, w.label
    order by w.meal
  loop
    raise notice '% : pas de plat pour % (« Proposer » s''en chargera)', problem.label, problem.names;
  end loop;

  select count(distinct w.meal) into replaced from popote_week w;
  raise notice '%', format('Semaine du %s : %s repas remplacé%s, %s carte%s retirée%s, %s posée%s.',
    to_char(target_week, 'DD/MM/YYYY'),
    replaced, case when replaced > 1 then 's' else '' end,
    removed, case when removed > 1 then 's' else '' end, case when removed > 1 then 's' else '' end,
    added, case when added > 1 then 's' else '' end);

  drop table popote_week;
  drop function pg_temp.popote_key(text);
end;
$popote$;

-- La semaine du foyer, telle qu'elle est maintenant.
select (array['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'])[p.day + 1] as jour,
       p.meal_type as repas,
       r.title as plat,
       (select string_agg(m.first_name, ', ' order by e.k)
        from unnest(p.member_ids) with ordinality as e (id, k)
        join public.members m on m.id = e.id and m.household_id = hu.household_id) as pour,
       p.locked as verrou
from auth.users u
join public.household_users hu on hu.user_id = u.id
join public.week_plans wp on wp.household_id = hu.household_id and wp.week_start = ${text(doc.semaine)}
join public.planned_meals p on p.week_plan_id = wp.id and p.household_id = hu.household_id
join public.recipes r on r.id = p.recipe_id
where lower(u.email) = lower(${text(email)})
order by p.day, array_position(array['petit_dej', 'midi', 'pique_nique', 'soir']::public.meal_type[], p.meal_type), p.position;
`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let email = "";
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email") email = args[++i] ?? "";
    else if (args[i].startsWith("--email=")) email = args[i].slice("--email=".length);
    else files.push(args[i]);
  }
  const [input, output] = files;
  if (!input || !output || !email) {
    console.error("Usage : node scripts/week-to-sql.ts <semaine.json> <sortie.sql> --email <email d'un compte du foyer>");
    process.exit(1);
  }
  try {
    const doc = JSON.parse(readFileSync(input, "utf8")) as WeekFile;
    writeFileSync(output, weekSql(doc, { email, source: input, output }));
    console.log(`${doc.repas.length} repas écrits dans ${output}, pour le foyer du compte ${email}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
