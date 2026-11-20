"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { LiveStatus } from "@/components/live-indicator";
import type { ListItem, LiveList } from "@/lib/shopping-data";
import { applyLiveChange, mergeLiveReload, type LiveEvent } from "@/lib/shopping-items";
import { createClient } from "@/lib/supabase/client";
import { loadListItemsAction } from "./actions";

// Les ajouts, suppressions et changements de la liste arrivent en rafale (une mise à jour de la
// liste recrée tous ses articles) : une seule relecture, une demi-seconde après le dernier.
const RELOAD_DELAY_MS = 500;

// Supabase réutilise un canal du même nom tant que l'ancien n'est pas fermé (il se ferme sans
// attendre au démontage) : un nom neuf à chaque abonnement.
let channels = 0;

// La liste de courses en direct entre les comptes du foyer (Supabase Realtime, filtré par la RLS).
// Une case cochée sur l'autre téléphone se coche ici, avec la même animation qu'un toucher ; un
// geste fait ici et encore en cours d'enregistrement l'emporte (`saving`). Un article ajouté ou
// supprimé, la liste mise à jour ou rangée : les articles sont relus (`loadListItemsAction`), sans
// fermer le panneau ouvert ni perdre le défilement ; `onReload` reçoit le reste (frigo, bandeaux).
// Après une coupure, au retour sur l'onglet ou sur la page : tout est relu.
export function useLiveShoppingList(listId: string, initialItems: ListItem[], onReload: (list: LiveList) => void) {
  const [items, setItems] = useState(initialItems);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const itemsRef = useRef(items);
  const onReloadRef = useRef(onReload);
  // Articles dont un geste fait ici s'enregistre (un compteur : deux touchers rapides).
  const pending = useRef(new Map<string, number>());
  // Déjà connecté une fois : une nouvelle connexion (coupure, page gardée par Next.js puis
  // remontrée) peut avoir manqué des changements.
  const wasLive = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
    onReloadRef.current = onReload;
  });

  const saving = useCallback(async <T>(ids: readonly string[], save: () => Promise<T>): Promise<T> => {
    for (const id of ids) pending.current.set(id, (pending.current.get(id) ?? 0) + 1);
    try {
      return await save();
    } finally {
      for (const id of ids) {
        const count = (pending.current.get(id) ?? 1) - 1;
        if (count > 0) pending.current.set(id, count);
        else pending.current.delete(id);
      }
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let joined = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let run = 0;
    // Les changements reçus pendant une relecture : réappliqués ensuite (la relecture a pu lire
    // la base juste avant eux).
    let during: LiveEvent[] | null = null;

    const pendingIds = () => new Set(pending.current.keys());

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), RELOAD_DELAY_MS);
    }

    async function reload() {
      clearTimeout(timer);
      const current = ++run;
      during = [];
      const result = await loadListItemsAction(listId);
      if (disposed || current !== run) return;
      const missed = during;
      during = null;
      // Liste supprimée, compte retiré du foyer, réseau coupé : on garde ce qu'on a.
      if ("error" in result) return;
      const fresh = result.list.items;
      const ids = pendingIds();
      setItems((before) =>
        missed.reduce((next, event) => applyLiveChange(next, event, ids).items, mergeLiveReload(before, fresh, ids)),
      );
      onReloadRef.current(result.list);
      if (missed.some((event) => applyLiveChange(fresh, event, ids).reload)) schedule();
    }

    function receive(event: LiveEvent) {
      during?.push(event);
      const ids = pendingIds();
      if (applyLiveChange(itemsRef.current, event, ids).reload) schedule();
      setItems((before) => applyLiveChange(before, event, ids).items);
    }

    let channel: RealtimeChannel | null = null;

    async function subscribe() {
      // Le jeton du compte d'abord : sans lui, l'abonnement part en anonyme, Supabase le refuse
      // (RLS) et ne réessaie que quelques secondes plus tard.
      const { data } = await supabase.auth.getSession();
      if (disposed || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (disposed) return;
      channel = supabase
        // `wait` : « En direct » seulement quand les changements arrivent vraiment.
        .channel(`courses:${listId}:${++channels}`, { config: { postgres_changes_options: { wait: true } } })
        .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: `list_id=eq.${listId}` }, (payload) =>
          receive({ table: payload.table, eventType: payload.eventType, new: payload.new, old: payload.old }),
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "shopping_lists", filter: `id=eq.${listId}` }, (payload) =>
          receive({ table: payload.table, eventType: payload.eventType, new: payload.new, old: payload.old }),
        )
        .subscribe((state) => {
          if (disposed) return;
          joined = state === "SUBSCRIBED";
          // Supabase se reconnecte seul après une coupure (CHANNEL_ERROR, TIMED_OUT, CLOSED).
          setStatus(joined ? "live" : "offline");
          if (joined && wasLive.current) void reload();
          if (joined) wasLive.current = true;
        });
    }
    void subscribe();

    // Le téléphone se réveille, l'onglet revient au premier plan : on relit tout.
    function onVisible() {
      if (document.visibilityState === "visible") void reload();
    }
    function onOffline() {
      setStatus("offline");
    }
    function onOnline() {
      if (joined) setStatus("live");
      void reload();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [listId]);

  return { items, setItems, saving, status };
}
