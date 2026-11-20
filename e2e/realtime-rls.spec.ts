import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// La liste de courses en direct ne fuit pas d'un foyer à l'autre : Supabase Realtime applique la
// RLS de chaque abonné. Sans navigateur : deux comptes neufs, chacun son foyer, abonnés à la même
// liste (celle du premier). Le propriétaire reçoit l'ajout, la case cochée et la suppression (par
// la liste « touchée », migration 0014) ; l'intrus ne reçoit rien.

// Le conteneur e2e est sur le réseau de l'hôte : Supabase y répond comme pour le navigateur.
function env(name: string) {
  if (process.env[name]) return process.env[name];
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((entry) => entry.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim();
}

const URL = env("NEXT_PUBLIC_SUPABASE_URL") ?? "http://127.0.0.1:54321";
const KEY = env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? "";

type Received = { table: string; type: string };

async function newAccount(name: string) {
  const supabase = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `e2e-rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const { error } = await supabase.auth.signUp({ email, password: "motdepasse" });
  expect(error).toBeNull();
  const { data: householdId, error: householdError } = await supabase.rpc("create_household", { household_name: name });
  expect(householdError).toBeNull();
  return { supabase, householdId: householdId as string };
}

function listen(supabase: SupabaseClient, listId: string, received: Received[]) {
  return new Promise<void>((resolve, reject) => {
    const record = (payload: { table: string; eventType: string }) => received.push({ table: payload.table, type: payload.eventType });
    supabase
      .channel(`rls:${listId}:${Math.random()}`, { config: { postgres_changes_options: { wait: true } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: `list_id=eq.${listId}` }, record)
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_lists", filter: `id=eq.${listId}` }, record)
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") resolve();
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(error ?? new Error(status));
      });
  });
}

test("la liste en direct n'arrive qu'aux comptes du foyer", async () => {
  const owner = await newAccount("Foyer en direct");
  const intruder = await newAccount("Foyer voisin");

  const { data: plan, error: planError } = await owner.supabase
    .from("week_plans")
    .insert({ household_id: owner.householdId, week_start: "2026-11-23" })
    .select("id")
    .single();
  expect(planError).toBeNull();
  const { data: listId, error: listError } = await owner.supabase.rpc("sync_shopping_list", {
    target_week_plan_id: plan!.id,
    signature: "",
    fridge: "",
    items: [],
  });
  expect(listError).toBeNull();

  const ownerEvents: Received[] = [];
  const intruderEvents: Received[] = [];
  await Promise.all([listen(owner.supabase, listId!, ownerEvents), listen(intruder.supabase, listId!, intruderEvents)]);

  // Un article ajouté, coché, puis supprimé.
  const { data: itemId, error: addError } = await owner.supabase.rpc("add_shopping_item", {
    target_list_id: listId!,
    raw_label: "Œufs",
    quantity_text: "6",
  });
  expect(addError).toBeNull();
  await expect.poll(() => ownerEvents).toContainEqual({ table: "shopping_items", type: "INSERT" });
  expect((await owner.supabase.from("shopping_items").update({ checked: true }).eq("id", itemId!)).error).toBeNull();
  await expect.poll(() => ownerEvents).toContainEqual({ table: "shopping_items", type: "UPDATE" });
  expect((await owner.supabase.from("shopping_items").delete().eq("id", itemId!)).error).toBeNull();
  await expect.poll(() => ownerEvents).toContainEqual({ table: "shopping_lists", type: "UPDATE" });

  // L'intrus a eu tout le temps de recevoir quelque chose : rien.
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  expect(intruderEvents).toEqual([]);

  await Promise.all([owner.supabase.removeAllChannels(), intruder.supabase.removeAllChannels()]);
});
