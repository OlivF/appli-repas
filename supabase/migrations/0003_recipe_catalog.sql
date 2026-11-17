-- Catalogue commun : 40 recettes françaises du quotidien (household_id null).
-- Lisible par tout compte connecté, modifiable par personne ; un foyer peut en copier une.
-- Identifiants fixes (ca7a0000-0000-4000-8000-0000000000NN) : une future migration peut
-- corriger une recette précise. Noms d'ingrédients harmonisés d'une recette à l'autre :
-- ils alimentent l'autocomplétion et, plus tard, la liste de courses.
--
--   1-11  petits-déjeuners (9-11 cétogènes)
--  12-26  dîners familiaux (21-26 cétogènes, qui plaisent aussi aux enfants)
--  27-34  midis cétogènes à emporter
--  35-40  pique-niques rapides pour les enfants

-- Ajoute une recette décrite en JSON ; ingrédients en [nom, quantité, unité, rayon].
create function pg_temp.catalog_recipe(doc jsonb)
returns void
language plpgsql
as $$
declare
  new_id uuid := ('ca7a0000-0000-4000-8000-' || lpad(doc ->> 'n', 12, '0'))::uuid;
begin
  insert into public.recipes (
    id, household_id, title, description, meal_types, servings, prep_minutes, cook_minutes,
    diets, steps, batch_friendly, batch_notes, kid_friendly
  ) values (
    new_id, null, doc ->> 'title', doc ->> 'description',
    array(select value from jsonb_array_elements_text(doc -> 'meal_types') with ordinality as t (value, n) order by n)::public.meal_type[],
    (doc ->> 'servings')::smallint,
    coalesce((doc ->> 'prep')::smallint, 0),
    coalesce((doc ->> 'cook')::smallint, 0),
    array(select value from jsonb_array_elements_text(coalesce(doc -> 'diets', '[]')) as t (value))::public.diet[],
    array(select value from jsonb_array_elements_text(doc -> 'steps') with ordinality as t (value, n) order by n),
    coalesce((doc ->> 'batch')::boolean, false),
    doc ->> 'batch_notes',
    coalesce((doc ->> 'kid')::boolean, false)
  );

  insert into public.recipe_ingredients (recipe_id, position, name, quantity, unit, aisle)
  select new_id, (item.n - 1)::smallint, item.value ->> 0, (item.value ->> 1)::numeric,
         (item.value ->> 2)::public.ingredient_unit, (item.value ->> 3)::public.grocery_aisle
  from jsonb_array_elements(doc -> 'ingredients') with ordinality as item (value, n);
end;
$$;

-- ═══ Petits-déjeuners ═══════════════════════════════════════════════════════

select pg_temp.catalog_recipe($${
  "n": 1, "title": "Tartines beurre et confiture",
  "description": "Le classique du matin, avec un bol de lait chaud.",
  "meal_types": ["petit_dej"], "servings": 4, "prep": 5, "cook": 0,
  "diets": ["vegetarian"], "kid": true,
  "ingredients": [
    ["Baguette", 1, "piece", "boulangerie"],
    ["Beurre", 60, "g", "cremerie"],
    ["Confiture", 120, "g", "epicerie"],
    ["Lait", 1, "l", "cremerie"]
  ],
  "steps": [
    "Coupe la baguette en tartines et fais-les griller si tu aimes.",
    "Beurre-les et ajoute la confiture.",
    "Fais chauffer le lait et sers-le en bol."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 2, "title": "Porridge aux pommes et à la cannelle",
  "description": "Crémeux et réconfortant, prêt en dix minutes.",
  "meal_types": ["petit_dej"], "servings": 4, "prep": 5, "cook": 10,
  "diets": ["vegetarian"], "kid": true,
  "ingredients": [
    ["Flocons d'avoine", 160, "g", "epicerie"],
    ["Lait", 800, "ml", "cremerie"],
    ["Pommes", 2, "piece", "fruits_legumes"],
    ["Cannelle", 1, "cac", "epicerie"],
    ["Miel", 2, "cas", "epicerie"]
  ],
  "steps": [
    "Épluche les pommes et coupe-les en petits dés.",
    "Verse le lait et les flocons dans une casserole, ajoute les pommes et la cannelle.",
    "Fais cuire 8 à 10 minutes à feu doux en remuant, jusqu'à ce que ce soit crémeux.",
    "Sers chaud avec un filet de miel."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 3, "title": "Pancakes moelleux",
  "description": "Une quinzaine de pancakes épais, à garnir de fruits ou de confiture.",
  "meal_types": ["petit_dej"], "servings": 4, "prep": 10, "cook": 20,
  "diets": ["vegetarian"], "kid": true, "batch": true,
  "batch_notes": "Fais cuire toute la pâte le dimanche : les pancakes se gardent 3 jours au frais ou 2 mois au congélateur, et se réchauffent en une minute au grille-pain.",
  "ingredients": [
    ["Farine", 250, "g", "epicerie"],
    ["Lait", 300, "ml", "cremerie"],
    ["Œufs", 2, "piece", "cremerie"],
    ["Sucre", 30, "g", "epicerie"],
    ["Levure chimique", 11, "g", "epicerie"],
    ["Beurre", 30, "g", "cremerie"],
    ["Sel", null, null, "epicerie"]
  ],
  "steps": [
    "Fais fondre le beurre.",
    "Dans un saladier, mélange la farine, le sucre, la levure et une pincée de sel.",
    "Ajoute les œufs, puis le lait petit à petit et le beurre fondu, en fouettant jusqu'à obtenir une pâte lisse.",
    "Dans une poêle chaude légèrement beurrée, verse une petite louche de pâte. Retourne le pancake quand des bulles apparaissent.",
    "Sers avec des fruits, du sirop d'érable ou de la confiture."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 4, "title": "Overnight oats à la banane",
  "description": "Préparés la veille, il n'y a plus qu'à ouvrir le bocal.",
  "meal_types": ["petit_dej"], "servings": 4, "prep": 10, "cook": 0,
  "diets": ["vegetarian"], "kid": true, "batch": true,
  "batch_notes": "Prépare les 4 bocaux le dimanche soir : ils se gardent 3 jours au frais. Ajoute la banane le matin même.",
  "ingredients": [
    ["Flocons d'avoine", 200, "g", "epicerie"],
    ["Lait", 400, "ml", "cremerie"],
    ["Yaourt nature", 4, "piece", "cremerie"],
    ["Graines de chia", 2, "cas", "epicerie"],
    ["Bananes", 2, "piece", "fruits_legumes"],
    ["Miel", 2, "cas", "epicerie"]
  ],
  "steps": [
    "Répartis les flocons, les graines de chia, le lait et les yaourts dans 4 bocaux.",
    "Mélange bien, ferme et laisse une nuit au réfrigérateur.",
    "Le matin, ajoute la banane en rondelles et un filet de miel."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 5, "title": "Pain perdu",
  "description": "La meilleure façon de finir le pain de la veille.",
  "meal_types": ["petit_dej"], "servings": 4, "prep": 10, "cook": 10,
  "diets": ["vegetarian"], "kid": true,
  "ingredients": [
    ["Tranches de pain rassis", 8, "piece", "boulangerie"],
    ["Lait", 250, "ml", "cremerie"],
    ["Œufs", 3, "piece", "cremerie"],
    ["Sucre", 40, "g", "epicerie"],
    ["Beurre", 30, "g", "cremerie"],
    ["Cannelle", 1, "cac", "epicerie"]
  ],
  "steps": [
    "Fouette les œufs avec le lait, le sucre et la cannelle dans une assiette creuse.",
    "Trempe chaque tranche de pain des deux côtés.",
    "Fais-les dorer 2 à 3 minutes de chaque côté dans le beurre chaud.",
    "Sers tiède, saupoudré d'un peu de sucre."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 6, "title": "Granola maison et yaourt",
  "description": "Croustillant au miel et aux amandes, sur un yaourt nature.",
  "meal_types": ["petit_dej"], "servings": 4, "prep": 10, "cook": 25,
  "diets": ["vegetarian"], "kid": true, "batch": true,
  "batch_notes": "Fais cuire tout le granola le dimanche : il se garde 2 semaines dans un bocal bien fermé.",
  "ingredients": [
    ["Flocons d'avoine", 200, "g", "epicerie"],
    ["Amandes", 60, "g", "epicerie"],
    ["Miel", 4, "cas", "epicerie"],
    ["Huile de tournesol", 2, "cas", "epicerie"],
    ["Raisins secs", 50, "g", "epicerie"],
    ["Yaourt nature", 4, "piece", "cremerie"]
  ],
  "steps": [
    "Préchauffe le four à 160 °C.",
    "Mélange les flocons, les amandes concassées, le miel et l'huile.",
    "Étale sur une plaque et fais cuire 25 minutes en remuant à mi-cuisson.",
    "Laisse refroidir, ajoute les raisins secs et sers sur les yaourts."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 7, "title": "Crêpes",
  "description": "Une douzaine de crêpes fines, sucre, confiture ou pâte à tartiner.",
  "meal_types": ["petit_dej"], "servings": 4, "prep": 10, "cook": 30,
  "diets": ["vegetarian"], "kid": true, "batch": true,
  "batch_notes": "Fais toutes les crêpes le dimanche : empilées et filmées, elles se gardent 3 jours au frais. Réchauffe-les 30 secondes à la poêle.",
  "ingredients": [
    ["Farine", 250, "g", "epicerie"],
    ["Œufs", 4, "piece", "cremerie"],
    ["Lait", 500, "ml", "cremerie"],
    ["Beurre", 30, "g", "cremerie"],
    ["Sucre", 20, "g", "epicerie"],
    ["Sel", null, null, "epicerie"]
  ],
  "steps": [
    "Mets la farine, le sucre et une pincée de sel dans un saladier, et creuse un puits.",
    "Ajoute les œufs, puis le lait petit à petit en fouettant pour éviter les grumeaux.",
    "Ajoute le beurre fondu et laisse reposer 30 minutes si tu as le temps.",
    "Fais cuire les crêpes une à une dans une poêle chaude légèrement beurrée."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 8, "title": "Œufs brouillés et tartines grillées",
  "description": "Des œufs crémeux à la ciboulette, pour les matins qui ont faim.",
  "meal_types": ["petit_dej"], "servings": 4, "prep": 5, "cook": 5,
  "diets": ["vegetarian"], "kid": true,
  "ingredients": [
    ["Œufs", 8, "piece", "cremerie"],
    ["Beurre", 20, "g", "cremerie"],
    ["Crème fraîche épaisse", 2, "cas", "cremerie"],
    ["Tranches de pain de campagne", 4, "piece", "boulangerie"],
    ["Ciboulette", 1, "cas", "fruits_legumes"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Fais griller les tranches de pain.",
    "Bats les œufs avec une pincée de sel et de poivre.",
    "Fais fondre le beurre à feu doux, verse les œufs et remue sans arrêt avec une spatule.",
    "Hors du feu, quand ils sont encore un peu baveux, ajoute la crème et la ciboulette ciselée.",
    "Sers aussitôt sur les tartines."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 9, "title": "Œufs brouillés au bacon et à l'avocat",
  "description": "Un petit-déjeuner cétogène qui tient jusqu'à midi.",
  "meal_types": ["petit_dej"], "servings": 2, "prep": 5, "cook": 8,
  "diets": ["keto", "gluten_free"], "kid": true,
  "ingredients": [
    ["Œufs", 4, "piece", "cremerie"],
    ["Tranches de bacon", 4, "piece", "boucherie"],
    ["Avocats", 1, "piece", "fruits_legumes"],
    ["Beurre", 10, "g", "cremerie"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Fais dorer le bacon à la poêle, sans matière grasse, puis réserve-le.",
    "Bats les œufs avec le sel et le poivre.",
    "Fais fondre le beurre à feu doux et brouille les œufs en remuant sans arrêt.",
    "Sers avec le bacon et l'avocat coupé en tranches."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 10, "title": "Pudding de chia au lait de coco",
  "description": "Cétogène, sans lactose, et prêt d'avance pour toute la semaine.",
  "meal_types": ["petit_dej"], "servings": 2, "prep": 5, "cook": 0,
  "diets": ["keto", "vegetarian", "gluten_free", "lactose_free"], "batch": true,
  "batch_notes": "Prépare 4 pots le dimanche : ils se gardent 4 jours au frais. Ajoute les framboises le matin.",
  "ingredients": [
    ["Graines de chia", 60, "g", "epicerie"],
    ["Lait de coco", 400, "ml", "epicerie"],
    ["Extrait de vanille", 1, "cac", "epicerie"],
    ["Framboises", 100, "g", "fruits_legumes"]
  ],
  "steps": [
    "Mélange le lait de coco, la vanille et les graines de chia.",
    "Remue de nouveau après 10 minutes, pour éviter les grumeaux.",
    "Répartis dans des pots et laisse prendre au moins 4 heures au frais.",
    "Sers avec les framboises."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 11, "title": "Muffins aux œufs, jambon et fromage",
  "description": "Douze petites omelettes au four, à manger chaudes ou froides.",
  "meal_types": ["petit_dej"], "servings": 4, "prep": 10, "cook": 20,
  "diets": ["keto", "gluten_free"], "kid": true, "batch": true,
  "batch_notes": "Fais cuire les 12 muffins le dimanche : ils se gardent 4 jours au frais et se réchauffent 30 secondes au micro-ondes.",
  "ingredients": [
    ["Œufs", 8, "piece", "cremerie"],
    ["Tranches de jambon blanc", 3, "piece", "boucherie"],
    ["Gruyère râpé", 80, "g", "cremerie"],
    ["Crème fraîche épaisse", 3, "cas", "cremerie"],
    ["Ciboulette", 1, "cas", "fruits_legumes"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Préchauffe le four à 180 °C et beurre un moule à 12 muffins.",
    "Bats les œufs avec la crème, le sel, le poivre et la ciboulette.",
    "Répartis le jambon coupé en dés et le gruyère dans les moules, puis verse les œufs.",
    "Fais cuire 20 minutes, jusqu'à ce que les muffins soient gonflés et dorés."
  ]
}$$);

-- ═══ Dîners familiaux ═══════════════════════════════════════════════════════

select pg_temp.catalog_recipe($${
  "n": 12, "title": "Lasagnes à la bolognaise",
  "description": "Le grand plat qui met tout le monde d'accord.",
  "meal_types": ["soir"], "servings": 6, "prep": 30, "cook": 45,
  "diets": [], "kid": true, "batch": true,
  "batch_notes": "Monte les lasagnes le dimanche et garde-les au frais 2 jours, ou 2 mois au congélateur. Le jour J, 45 minutes au four.",
  "ingredients": [
    ["Pâtes à lasagne", 300, "g", "epicerie"],
    ["Bœuf haché", 500, "g", "boucherie"],
    ["Tomates concassées", 800, "g", "epicerie"],
    ["Oignons", 1, "piece", "fruits_legumes"],
    ["Carottes", 1, "piece", "fruits_legumes"],
    ["Gousses d'ail", 2, "piece", "fruits_legumes"],
    ["Huile d'olive", 2, "cas", "epicerie"],
    ["Beurre", 50, "g", "cremerie"],
    ["Farine", 50, "g", "epicerie"],
    ["Lait", 750, "ml", "cremerie"],
    ["Gruyère râpé", 100, "g", "cremerie"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Fais revenir l'oignon, la carotte et l'ail hachés dans l'huile, ajoute la viande et laisse-la dorer.",
    "Verse les tomates, sale, poivre et laisse mijoter 20 minutes.",
    "Pour la béchamel, fais fondre le beurre, ajoute la farine, puis le lait petit à petit en fouettant jusqu'à ce que la sauce épaississe.",
    "Dans un plat, alterne pâtes, bolognaise et béchamel, et termine par la béchamel et le gruyère.",
    "Fais cuire 45 minutes au four à 180 °C."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 13, "title": "Hachis parmentier",
  "description": "Purée maison et viande fondante, gratinées au four.",
  "meal_types": ["soir"], "servings": 6, "prep": 30, "cook": 30,
  "diets": ["gluten_free"], "kid": true, "batch": true,
  "batch_notes": "Prépare le hachis le dimanche et garde-le au frais 2 jours, ou 2 mois au congélateur. Le jour J, 30 minutes au four à 200 °C.",
  "ingredients": [
    ["Pommes de terre", 1.2, "kg", "fruits_legumes"],
    ["Bœuf haché", 600, "g", "boucherie"],
    ["Oignons", 2, "piece", "fruits_legumes"],
    ["Gousses d'ail", 2, "piece", "fruits_legumes"],
    ["Lait", 200, "ml", "cremerie"],
    ["Beurre", 50, "g", "cremerie"],
    ["Gruyère râpé", 80, "g", "cremerie"],
    ["Persil", 2, "cas", "fruits_legumes"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Fais cuire les pommes de terre épluchées 20 minutes dans l'eau salée.",
    "Pendant ce temps, fais revenir les oignons et l'ail hachés, puis la viande ; ajoute le persil.",
    "Écrase les pommes de terre avec le lait chaud et le beurre.",
    "Étale la viande dans un plat, couvre de purée et parsème de gruyère.",
    "Fais gratiner 30 minutes au four à 200 °C."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 14, "title": "Gratin de coquillettes au jambon",
  "description": "Le gratin doudou des enfants, crème et fromage.",
  "meal_types": ["soir", "midi"], "servings": 4, "prep": 15, "cook": 25,
  "diets": [], "kid": true, "batch": true,
  "batch_notes": "Prépare le gratin le dimanche, couvre-le et garde-le 2 jours au frais : 25 minutes au four le jour J.",
  "ingredients": [
    ["Coquillettes", 400, "g", "epicerie"],
    ["Tranches de jambon blanc", 4, "piece", "boucherie"],
    ["Crème liquide", 200, "ml", "cremerie"],
    ["Gruyère râpé", 120, "g", "cremerie"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Fais cuire les coquillettes 2 minutes de moins qu'indiqué sur le paquet, puis égoutte-les.",
    "Mélange-les avec le jambon coupé en dés, la crème et la moitié du gruyère.",
    "Verse dans un plat, couvre du reste de gruyère.",
    "Fais gratiner 25 minutes au four à 200 °C."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 15, "title": "Poulet rôti et pommes de terre",
  "description": "Le poulet du dimanche, avec ses pommes de terre dorées dans le jus.",
  "meal_types": ["soir"], "servings": 6, "prep": 15, "cook": 75,
  "diets": ["gluten_free", "lactose_free"], "kid": true,
  "ingredients": [
    ["Poulet entier", 1, "piece", "boucherie"],
    ["Pommes de terre", 1, "kg", "fruits_legumes"],
    ["Gousses d'ail", 4, "piece", "fruits_legumes"],
    ["Huile d'olive", 3, "cas", "epicerie"],
    ["Herbes de Provence", 1, "cac", "epicerie"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Préchauffe le four à 200 °C.",
    "Coupe les pommes de terre en quartiers et mélange-les avec l'huile, les herbes, l'ail en chemise, le sel et le poivre.",
    "Pose le poulet au milieu du plat, sale-le, poivre-le et entoure-le des pommes de terre.",
    "Fais rôtir 1 h 15 en arrosant de temps en temps avec le jus."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 16, "title": "Quiche lorraine et salade verte",
  "description": "Lardons, œufs et crème sur une pâte croustillante.",
  "meal_types": ["soir", "midi"], "servings": 6, "prep": 15, "cook": 35,
  "diets": [], "kid": true, "batch": true,
  "batch_notes": "Fais cuire la quiche le dimanche : elle se garde 3 jours au frais et se réchauffe 15 minutes au four.",
  "ingredients": [
    ["Pâte brisée", 1, "piece", "cremerie"],
    ["Lardons", 200, "g", "boucherie"],
    ["Œufs", 3, "piece", "cremerie"],
    ["Crème fraîche épaisse", 200, "g", "cremerie"],
    ["Lait", 200, "ml", "cremerie"],
    ["Salade verte", 1, "piece", "fruits_legumes"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Préchauffe le four à 180 °C et étale la pâte dans un moule.",
    "Fais dorer les lardons à la poêle et répartis-les sur la pâte.",
    "Bats les œufs avec la crème, le lait et le poivre, et verse sur les lardons.",
    "Fais cuire 35 minutes. Sers avec la salade."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 17, "title": "Velouté de potimarron",
  "description": "Une soupe orange et douce, au goût de châtaigne.",
  "meal_types": ["soir"], "servings": 4, "prep": 15, "cook": 30,
  "diets": ["vegetarian", "gluten_free"], "kid": true, "batch": true,
  "batch_notes": "Prépare une grande marmite le dimanche : le velouté se garde 4 jours au frais ou 3 mois au congélateur.",
  "ingredients": [
    ["Potimarron", 1.2, "kg", "fruits_legumes"],
    ["Oignons", 1, "piece", "fruits_legumes"],
    ["Crème liquide", 100, "ml", "cremerie"],
    ["Huile d'olive", 1, "cas", "epicerie"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Lave le potimarron (inutile de l'éplucher), retire les graines et coupe-le en cubes.",
    "Fais revenir l'oignon émincé dans l'huile, ajoute le potimarron et couvre d'eau à hauteur.",
    "Sale et laisse cuire 25 minutes.",
    "Mixe avec la crème, rectifie l'assaisonnement et sers bien chaud."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 18, "title": "Chili con carne",
  "description": "Bœuf, haricots rouges et épices douces, servi avec du riz.",
  "meal_types": ["soir"], "servings": 6, "prep": 20, "cook": 60,
  "diets": ["gluten_free", "lactose_free"], "batch": true,
  "batch_notes": "Le chili est encore meilleur réchauffé : prépare-le le dimanche, il se garde 3 jours au frais ou 3 mois au congélateur. Cuis le riz le jour J.",
  "ingredients": [
    ["Bœuf haché", 600, "g", "boucherie"],
    ["Haricots rouges", 500, "g", "epicerie"],
    ["Tomates concassées", 800, "g", "epicerie"],
    ["Oignons", 2, "piece", "fruits_legumes"],
    ["Poivrons", 1, "piece", "fruits_legumes"],
    ["Gousses d'ail", 2, "piece", "fruits_legumes"],
    ["Cumin", 2, "cac", "epicerie"],
    ["Paprika", 1, "cac", "epicerie"],
    ["Huile d'olive", 2, "cas", "epicerie"],
    ["Riz", 400, "g", "epicerie"],
    ["Sel", null, null, "epicerie"]
  ],
  "steps": [
    "Fais revenir les oignons, le poivron et l'ail hachés dans l'huile.",
    "Ajoute la viande et les épices, et laisse dorer 5 minutes.",
    "Verse les tomates et les haricots égouttés, sale, couvre et laisse mijoter 45 minutes.",
    "Fais cuire le riz et sers-le avec le chili."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 19, "title": "Croque-monsieur et salade verte",
  "description": "Le dîner express du vendredi soir.",
  "meal_types": ["soir"], "servings": 4, "prep": 10, "cook": 10,
  "diets": [], "kid": true,
  "ingredients": [
    ["Tranches de pain de mie", 8, "piece", "boulangerie"],
    ["Tranches de jambon blanc", 4, "piece", "boucherie"],
    ["Gruyère râpé", 120, "g", "cremerie"],
    ["Beurre", 40, "g", "cremerie"],
    ["Salade verte", 1, "piece", "fruits_legumes"]
  ],
  "steps": [
    "Préchauffe le four à 220 °C.",
    "Beurre les tranches de pain sur une face.",
    "Garnis la moitié des tranches de jambon et de gruyère, referme avec les autres, côté beurré dehors, et parsème du reste de gruyère.",
    "Fais dorer 10 minutes au four. Sers avec la salade."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 20, "title": "Curry de pois chiches au lait de coco",
  "description": "Un curry doux et parfumé, sans viande ni lactose.",
  "meal_types": ["soir"], "servings": 4, "prep": 15, "cook": 25,
  "diets": ["vegetarian", "gluten_free", "lactose_free"], "batch": true,
  "batch_notes": "Fais le curry le dimanche : il se garde 4 jours au frais. Cuis le riz le jour J.",
  "ingredients": [
    ["Pois chiches", 500, "g", "epicerie"],
    ["Lait de coco", 400, "ml", "epicerie"],
    ["Tomates concassées", 400, "g", "epicerie"],
    ["Oignons", 1, "piece", "fruits_legumes"],
    ["Gousses d'ail", 2, "piece", "fruits_legumes"],
    ["Épinards frais", 150, "g", "fruits_legumes"],
    ["Curry en poudre", 2, "cac", "epicerie"],
    ["Huile d'olive", 1, "cas", "epicerie"],
    ["Riz", 300, "g", "epicerie"],
    ["Sel", null, null, "epicerie"]
  ],
  "steps": [
    "Fais revenir l'oignon et l'ail hachés dans l'huile, ajoute le curry et remue une minute.",
    "Ajoute les tomates, le lait de coco et les pois chiches égouttés ; sale et laisse mijoter 15 minutes.",
    "Ajoute les épinards et laisse-les fondre 2 minutes.",
    "Sers avec le riz."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 21, "title": "Poulet à la crème et aux champignons",
  "description": "Une sauce crémeuse que les enfants saucent jusqu'au bout.",
  "meal_types": ["soir"], "servings": 4, "prep": 15, "cook": 25,
  "diets": ["keto", "gluten_free"], "kid": true,
  "ingredients": [
    ["Blancs de poulet", 600, "g", "boucherie"],
    ["Champignons de Paris", 300, "g", "fruits_legumes"],
    ["Crème fraîche épaisse", 200, "g", "cremerie"],
    ["Échalotes", 2, "piece", "fruits_legumes"],
    ["Beurre", 20, "g", "cremerie"],
    ["Haricots verts", 400, "g", "surgeles"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Coupe le poulet en morceaux et fais-le dorer dans le beurre, puis réserve-le.",
    "Dans la même poêle, fais revenir les échalotes émincées et les champignons en lamelles.",
    "Remets le poulet, ajoute la crème, sale, poivre et laisse mijoter 10 minutes.",
    "Pendant ce temps, fais cuire les haricots verts 8 minutes à l'eau bouillante salée, et sers avec le poulet."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 22, "title": "Saumon au four, beurre citronné et brocolis",
  "description": "Prêt en vingt minutes, tout cuit sur la même plaque.",
  "meal_types": ["soir"], "servings": 4, "prep": 10, "cook": 20,
  "diets": ["keto", "gluten_free"], "kid": true,
  "ingredients": [
    ["Pavés de saumon", 4, "piece", "poissonnerie"],
    ["Brocolis", 600, "g", "fruits_legumes"],
    ["Beurre", 50, "g", "cremerie"],
    ["Citrons", 1, "piece", "fruits_legumes"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Préchauffe le four à 200 °C.",
    "Dispose les pavés de saumon et les fleurettes de brocoli sur une plaque, sale et poivre.",
    "Fais fondre le beurre avec le jus et le zeste du citron, et verse-le sur le tout.",
    "Fais cuire 15 à 20 minutes, jusqu'à ce que le saumon se détache en lamelles."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 23, "title": "Boulettes de bœuf à la tomate et mozzarella",
  "description": "Des boulettes fondantes, gratinées à la mozzarella.",
  "meal_types": ["soir"], "servings": 4, "prep": 20, "cook": 30,
  "diets": ["keto", "gluten_free"], "kid": true, "batch": true,
  "batch_notes": "Façonne et cuis les boulettes dans leur sauce le dimanche : elles se gardent 3 jours au frais ou 2 mois au congélateur. Ajoute la mozzarella au moment de réchauffer.",
  "ingredients": [
    ["Bœuf haché", 600, "g", "boucherie"],
    ["Œufs", 1, "piece", "cremerie"],
    ["Parmesan", 40, "g", "cremerie"],
    ["Gousses d'ail", 2, "piece", "fruits_legumes"],
    ["Herbes de Provence", 1, "cac", "epicerie"],
    ["Tomates concassées", 400, "g", "epicerie"],
    ["Mozzarella", 125, "g", "cremerie"],
    ["Huile d'olive", 2, "cas", "epicerie"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Mélange la viande avec l'œuf, le parmesan, l'ail haché, les herbes, le sel et le poivre.",
    "Façonne une vingtaine de boulettes et fais-les dorer dans l'huile.",
    "Ajoute les tomates et laisse mijoter 15 minutes à couvert.",
    "Pose la mozzarella en tranches sur les boulettes et laisse fondre 5 minutes à couvert."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 24, "title": "Gratin de chou-fleur au jambon",
  "description": "Tout le réconfort d'un gratin, sans féculents.",
  "meal_types": ["soir"], "servings": 4, "prep": 15, "cook": 35,
  "diets": ["keto", "gluten_free"], "kid": true, "batch": true,
  "batch_notes": "Prépare le gratin le dimanche et garde-le 3 jours au frais : 25 minutes au four le jour J.",
  "ingredients": [
    ["Chou-fleur", 1, "piece", "fruits_legumes"],
    ["Tranches de jambon blanc", 4, "piece", "boucherie"],
    ["Crème fraîche épaisse", 200, "g", "cremerie"],
    ["Œufs", 2, "piece", "cremerie"],
    ["Gruyère râpé", 100, "g", "cremerie"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Fais cuire les fleurettes de chou-fleur 10 minutes à l'eau bouillante salée, et égoutte-les bien.",
    "Mets-les dans un plat avec le jambon coupé en lanières.",
    "Bats les œufs avec la crème, la moitié du gruyère, le sel et le poivre, et verse sur le chou-fleur.",
    "Parsème du reste de gruyère et fais gratiner 25 minutes au four à 200 °C."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 25, "title": "Pizza à la pâte de mozzarella",
  "description": "Une vraie pizza du vendredi, avec une pâte sans farine.",
  "meal_types": ["soir"], "servings": 4, "prep": 20, "cook": 25,
  "diets": ["keto", "gluten_free"], "kid": true,
  "ingredients": [
    ["Mozzarella râpée", 340, "g", "cremerie"],
    ["Poudre d'amande", 170, "g", "epicerie"],
    ["Fromage frais", 30, "g", "cremerie"],
    ["Œufs", 1, "piece", "cremerie"],
    ["Coulis de tomate", 100, "g", "epicerie"],
    ["Tranches de jambon blanc", 2, "piece", "boucherie"],
    ["Champignons de Paris", 100, "g", "fruits_legumes"],
    ["Olives noires", 30, "g", "epicerie"],
    ["Herbes de Provence", 1, "cac", "epicerie"]
  ],
  "steps": [
    "Préchauffe le four à 200 °C.",
    "Fais fondre 170 g de mozzarella avec le fromage frais 1 minute au micro-ondes, puis mélange avec la poudre d'amande et l'œuf.",
    "Étale la pâte sur une plaque couverte de papier cuisson et fais-la cuire 10 minutes.",
    "Garnis de coulis, de jambon, de champignons, d'olives, du reste de mozzarella et des herbes.",
    "Remets 12 à 15 minutes au four."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 26, "title": "Courgettes farcies à la viande",
  "description": "Des courgettes fondantes et leur farce gratinée.",
  "meal_types": ["soir"], "servings": 4, "prep": 20, "cook": 35,
  "diets": ["keto", "gluten_free"], "kid": true, "batch": true,
  "batch_notes": "Farcis les courgettes le dimanche : elles se gardent 2 jours au frais. 30 minutes au four le jour J.",
  "ingredients": [
    ["Courgettes", 4, "piece", "fruits_legumes"],
    ["Bœuf haché", 400, "g", "boucherie"],
    ["Oignons", 1, "piece", "fruits_legumes"],
    ["Gousses d'ail", 1, "piece", "fruits_legumes"],
    ["Herbes de Provence", 1, "cac", "epicerie"],
    ["Gruyère râpé", 60, "g", "cremerie"],
    ["Huile d'olive", 1, "cas", "epicerie"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Préchauffe le four à 200 °C. Coupe les courgettes en deux dans la longueur et creuse-les.",
    "Fais revenir l'oignon, l'ail et la chair des courgettes hachés dans l'huile, ajoute la viande et les herbes ; sale et poivre.",
    "Remplis les courgettes de farce et parsème de gruyère.",
    "Fais cuire 30 à 35 minutes."
  ]
}$$);

-- ═══ Midis cétogènes à emporter ═════════════════════════════════════════════

select pg_temp.catalog_recipe($${
  "n": 27, "title": "Salade de poulet, avocat et œuf",
  "description": "Une boîte complète et rassasiante pour le déjeuner.",
  "meal_types": ["midi"], "servings": 2, "prep": 15, "cook": 10,
  "diets": ["keto", "gluten_free", "lactose_free"], "batch": true,
  "batch_notes": "Cuis le poulet et les œufs durs le dimanche : ils se gardent 3 jours au frais. Coupe l'avocat le matin même.",
  "ingredients": [
    ["Blancs de poulet", 250, "g", "boucherie"],
    ["Œufs", 2, "piece", "cremerie"],
    ["Avocats", 1, "piece", "fruits_legumes"],
    ["Jeunes pousses", 60, "g", "fruits_legumes"],
    ["Tomates cerises", 100, "g", "fruits_legumes"],
    ["Huile d'olive", 2, "cas", "epicerie"],
    ["Vinaigre de cidre", 1, "cas", "epicerie"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Fais cuire le poulet 10 minutes à la poêle et les œufs 9 minutes à l'eau bouillante.",
    "Coupe le poulet en lanières, les œufs en quartiers, l'avocat en dés et les tomates en deux.",
    "Répartis le tout sur les jeunes pousses, dans deux boîtes.",
    "Emporte la vinaigrette à part : huile, vinaigre, sel et poivre."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 28, "title": "Salade niçoise sans pommes de terre",
  "description": "Thon, œufs, haricots verts et olives : le soleil dans une boîte.",
  "meal_types": ["midi"], "servings": 2, "prep": 15, "cook": 10,
  "diets": ["keto", "gluten_free", "lactose_free"],
  "ingredients": [
    ["Thon au naturel", 140, "g", "epicerie"],
    ["Œufs", 2, "piece", "cremerie"],
    ["Haricots verts", 150, "g", "surgeles"],
    ["Tomates", 2, "piece", "fruits_legumes"],
    ["Olives noires", 30, "g", "epicerie"],
    ["Filets d'anchois", 4, "piece", "epicerie"],
    ["Huile d'olive", 2, "cas", "epicerie"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Fais cuire les œufs 9 minutes et les haricots verts 8 minutes à l'eau bouillante salée, puis refroidis-les.",
    "Coupe les tomates et les œufs en quartiers.",
    "Répartis haricots, tomates, œufs, thon émietté, olives et anchois dans deux boîtes.",
    "Arrose d'huile d'olive au moment de manger."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 29, "title": "Œufs mimosa au thon et crudités",
  "description": "Le classique de la cantine, version boîte à lunch.",
  "meal_types": ["midi"], "servings": 2, "prep": 15, "cook": 10,
  "diets": ["keto", "gluten_free", "lactose_free"], "batch": true,
  "batch_notes": "Prépare les œufs mimosa le dimanche : ils se gardent 2 jours au frais dans une boîte hermétique.",
  "ingredients": [
    ["Œufs", 4, "piece", "cremerie"],
    ["Thon au naturel", 80, "g", "epicerie"],
    ["Mayonnaise", 2, "cas", "epicerie"],
    ["Concombre", 1, "piece", "fruits_legumes"],
    ["Radis", 6, "piece", "fruits_legumes"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Fais cuire les œufs 10 minutes, refroidis-les et écale-les.",
    "Coupe-les en deux, écrase les jaunes avec le thon, la mayonnaise, le sel et le poivre.",
    "Garnis les blancs avec ce mélange.",
    "Accompagne de concombre en bâtonnets et de radis."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 30, "title": "Wraps de laitue au poulet",
  "description": "Des feuilles de laitue à la place des galettes, croquantes et fraîches.",
  "meal_types": ["midi"], "servings": 2, "prep": 10, "cook": 10,
  "diets": ["keto", "gluten_free", "lactose_free"], "batch": true,
  "batch_notes": "Cuis et émince le poulet le dimanche : il se garde 3 jours au frais. Garnis les feuilles le matin.",
  "ingredients": [
    ["Blancs de poulet", 250, "g", "boucherie"],
    ["Laitue", 1, "piece", "fruits_legumes"],
    ["Avocats", 1, "piece", "fruits_legumes"],
    ["Tomates cerises", 80, "g", "fruits_legumes"],
    ["Mayonnaise", 2, "cas", "epicerie"],
    ["Paprika", 1, "cac", "epicerie"],
    ["Huile d'olive", 1, "cas", "epicerie"]
  ],
  "steps": [
    "Saupoudre le poulet de paprika et fais-le cuire 10 minutes dans l'huile, puis émince-le.",
    "Détache les plus grandes feuilles de laitue.",
    "Garnis-les de poulet, d'avocat, de tomates et d'un peu de mayonnaise.",
    "Roule-les et emballe-les serrées."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 31, "title": "Quiche sans pâte aux épinards et feta",
  "description": "Quatre parts à emporter, bonnes chaudes comme froides.",
  "meal_types": ["midi"], "servings": 4, "prep": 10, "cook": 30,
  "diets": ["keto", "vegetarian", "gluten_free"], "batch": true,
  "batch_notes": "Fais cuire la quiche le dimanche : elle se garde 4 jours au frais et se mange froide.",
  "ingredients": [
    ["Œufs", 6, "piece", "cremerie"],
    ["Épinards frais", 300, "g", "fruits_legumes"],
    ["Feta", 150, "g", "cremerie"],
    ["Crème fraîche épaisse", 150, "g", "cremerie"],
    ["Parmesan", 30, "g", "cremerie"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Préchauffe le four à 180 °C.",
    "Fais tomber les épinards 2 minutes à la poêle et presse-les pour retirer l'eau.",
    "Bats les œufs avec la crème, le parmesan, le sel et le poivre ; ajoute les épinards et la feta émiettée.",
    "Verse dans un moule beurré et fais cuire 30 minutes."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 32, "title": "Salade de saumon fumé, concombre et fromage frais",
  "description": "Fraîche et sans cuisson, prête en dix minutes.",
  "meal_types": ["midi"], "servings": 2, "prep": 10, "cook": 0,
  "diets": ["keto", "gluten_free"],
  "ingredients": [
    ["Saumon fumé", 150, "g", "poissonnerie"],
    ["Concombre", 1, "piece", "fruits_legumes"],
    ["Fromage frais", 60, "g", "cremerie"],
    ["Avocats", 1, "piece", "fruits_legumes"],
    ["Citrons", 0.5, "piece", "fruits_legumes"],
    ["Aneth", 1, "cas", "fruits_legumes"],
    ["Huile d'olive", 1, "cas", "epicerie"]
  ],
  "steps": [
    "Coupe le concombre et l'avocat en dés, et arrose-les de jus de citron.",
    "Ajoute le saumon en lanières et des petites cuillerées de fromage frais.",
    "Parsème d'aneth ciselé et arrose d'huile d'olive."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 33, "title": "Taboulé de chou-fleur au poulet",
  "description": "Le chou-fleur râpé remplace la semoule, la menthe fait le reste.",
  "meal_types": ["midi"], "servings": 2, "prep": 20, "cook": 10,
  "diets": ["keto", "gluten_free", "lactose_free"], "batch": true,
  "batch_notes": "Prépare le taboulé le dimanche : il se garde 3 jours au frais et il est encore meilleur le lendemain.",
  "ingredients": [
    ["Chou-fleur", 0.5, "piece", "fruits_legumes"],
    ["Blancs de poulet", 250, "g", "boucherie"],
    ["Concombre", 0.5, "piece", "fruits_legumes"],
    ["Tomates", 2, "piece", "fruits_legumes"],
    ["Menthe", 2, "cas", "fruits_legumes"],
    ["Persil", 2, "cas", "fruits_legumes"],
    ["Citrons", 1, "piece", "fruits_legumes"],
    ["Huile d'olive", 3, "cas", "epicerie"],
    ["Sel", null, null, "epicerie"],
    ["Poivre", null, null, "epicerie"]
  ],
  "steps": [
    "Râpe le chou-fleur cru, ou mixe-le quelques secondes, jusqu'à obtenir une fine semoule.",
    "Fais cuire le poulet 10 minutes à la poêle et coupe-le en dés.",
    "Mélange le chou-fleur, le poulet, le concombre et les tomates en dés, la menthe et le persil ciselés.",
    "Assaisonne avec le jus du citron, l'huile, le sel et le poivre."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 34, "title": "Roulés de jambon au fromage frais et noix",
  "description": "Sans cuisson, à grignoter avec une poignée de salade.",
  "meal_types": ["midi"], "servings": 2, "prep": 10, "cook": 0,
  "diets": ["keto", "gluten_free"], "batch": true,
  "batch_notes": "Roule-les le dimanche : ils se gardent 3 jours au frais, bien emballés.",
  "ingredients": [
    ["Tranches de jambon blanc", 6, "piece", "boucherie"],
    ["Fromage frais", 120, "g", "cremerie"],
    ["Noix", 40, "g", "epicerie"],
    ["Ciboulette", 1, "cas", "fruits_legumes"],
    ["Cornichons", 6, "piece", "epicerie"],
    ["Jeunes pousses", 60, "g", "fruits_legumes"]
  ],
  "steps": [
    "Mélange le fromage frais avec les noix concassées et la ciboulette.",
    "Étale-le sur les tranches de jambon et roule-les serrées.",
    "Range-les dans une boîte avec les cornichons et les jeunes pousses."
  ]
}$$);

-- ═══ Pique-niques rapides pour les enfants ══════════════════════════════════

select pg_temp.catalog_recipe($${
  "n": 35, "title": "Wraps houmous et crudités",
  "description": "Des galettes roulées qui se tiennent bien dans la main.",
  "meal_types": ["pique_nique"], "servings": 2, "prep": 10, "cook": 0,
  "diets": ["vegetarian", "lactose_free"], "kid": true,
  "ingredients": [
    ["Tortillas de blé", 2, "piece", "epicerie"],
    ["Houmous", 100, "g", "cremerie"],
    ["Carottes", 1, "piece", "fruits_legumes"],
    ["Concombre", 0.5, "piece", "fruits_legumes"],
    ["Jeunes pousses", 30, "g", "fruits_legumes"]
  ],
  "steps": [
    "Étale le houmous sur les tortillas.",
    "Ajoute la carotte râpée, le concombre en bâtonnets et les jeunes pousses.",
    "Roule serré, coupe en deux et emballe dans du papier."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 36, "title": "Jambon-beurre et bâtonnets de carotte",
  "description": "Le sandwich qu'on ne présente plus, avec ses crudités.",
  "meal_types": ["pique_nique"], "servings": 2, "prep": 10, "cook": 0,
  "diets": [], "kid": true,
  "ingredients": [
    ["Baguette", 1, "piece", "boulangerie"],
    ["Tranches de jambon blanc", 2, "piece", "boucherie"],
    ["Beurre", 20, "g", "cremerie"],
    ["Carottes", 2, "piece", "fruits_legumes"],
    ["Compotes en gourde", 2, "piece", "epicerie"]
  ],
  "steps": [
    "Coupe la baguette en deux et ouvre chaque moitié.",
    "Beurre-les et garnis-les d'une tranche de jambon.",
    "Épluche les carottes et coupe-les en bâtonnets.",
    "Emballe le tout avec une compote."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 37, "title": "Salade de pâtes au thon et maïs",
  "description": "Se prépare la veille et voyage sans souci.",
  "meal_types": ["pique_nique", "midi"], "servings": 2, "prep": 10, "cook": 10,
  "diets": ["lactose_free"], "kid": true, "batch": true,
  "batch_notes": "Prépare la salade le dimanche : elle se garde 3 jours au frais, juste à temps pour le pique-nique du mercredi.",
  "ingredients": [
    ["Pâtes", 150, "g", "epicerie"],
    ["Thon au naturel", 140, "g", "epicerie"],
    ["Maïs", 140, "g", "epicerie"],
    ["Tomates cerises", 100, "g", "fruits_legumes"],
    ["Mayonnaise", 2, "cas", "epicerie"],
    ["Sel", null, null, "epicerie"]
  ],
  "steps": [
    "Fais cuire les pâtes, rince-les à l'eau froide et égoutte-les.",
    "Mélange-les avec le thon émietté, le maïs égoutté, les tomates coupées en deux et la mayonnaise.",
    "Sale et répartis dans deux boîtes."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 38, "title": "Muffins salés jambon-fromage",
  "description": "Douze muffins moelleux, faciles à glisser dans le sac.",
  "meal_types": ["pique_nique"], "servings": 4, "prep": 15, "cook": 20,
  "diets": [], "kid": true, "batch": true,
  "batch_notes": "Fais cuire les muffins le dimanche : ils se gardent 3 jours au frais ou 2 mois au congélateur. Sors-les la veille.",
  "ingredients": [
    ["Farine", 150, "g", "epicerie"],
    ["Œufs", 2, "piece", "cremerie"],
    ["Lait", 100, "ml", "cremerie"],
    ["Huile de tournesol", 60, "ml", "epicerie"],
    ["Levure chimique", 11, "g", "epicerie"],
    ["Tranches de jambon blanc", 2, "piece", "boucherie"],
    ["Gruyère râpé", 80, "g", "cremerie"],
    ["Sel", null, null, "epicerie"]
  ],
  "steps": [
    "Préchauffe le four à 180 °C.",
    "Mélange la farine, la levure et une pincée de sel ; ajoute les œufs, le lait et l'huile.",
    "Incorpore le jambon coupé en dés et le gruyère.",
    "Remplis 12 moules à muffins aux trois quarts et fais cuire 20 minutes."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 39, "title": "Brochettes tomate-mozzarella et gressins",
  "description": "Des petites brochettes colorées à croquer avec les doigts.",
  "meal_types": ["pique_nique"], "servings": 2, "prep": 10, "cook": 0,
  "diets": ["vegetarian"], "kid": true,
  "ingredients": [
    ["Tomates cerises", 150, "g", "fruits_legumes"],
    ["Billes de mozzarella", 125, "g", "cremerie"],
    ["Feuilles de basilic", 8, "piece", "fruits_legumes"],
    ["Gressins", 8, "piece", "epicerie"],
    ["Pommes", 2, "piece", "fruits_legumes"]
  ],
  "steps": [
    "Enfile en alternance tomates cerises, billes de mozzarella et feuilles de basilic sur des piques.",
    "Range-les dans une boîte avec les gressins.",
    "Ajoute une pomme pour le dessert."
  ]
}$$);

select pg_temp.catalog_recipe($${
  "n": 40, "title": "Roulés de tortilla au fromage frais et à la dinde",
  "description": "Des petites roues à picorer, faciles pour les petites mains.",
  "meal_types": ["pique_nique"], "servings": 2, "prep": 10, "cook": 0,
  "diets": [], "kid": true,
  "ingredients": [
    ["Tortillas de blé", 2, "piece", "epicerie"],
    ["Fromage frais", 60, "g", "cremerie"],
    ["Tranches de blanc de dinde", 3, "piece", "boucherie"],
    ["Jeunes pousses", 30, "g", "fruits_legumes"],
    ["Concombre", 0.5, "piece", "fruits_legumes"]
  ],
  "steps": [
    "Étale le fromage frais sur les tortillas.",
    "Couvre de dinde et de jeunes pousses, puis roule serré.",
    "Coupe en tronçons de 3 cm et range-les dans une boîte avec des bâtonnets de concombre."
  ]
}$$);

drop function pg_temp.catalog_recipe(jsonb);
