"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * True cuando hay sesion de Supabase en el navegador. La galeria publica es
 * HTML cacheado e igual para todo el mundo: los controles de dueno (subir,
 * borrar) se deciden aqui, en cliente, para no personalizar el HTML.
 */
export function useIsOwner(): boolean {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let active = true;

    let supabase;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (active) setIsOwner(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setIsOwner(Boolean(session));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return isOwner;
}
