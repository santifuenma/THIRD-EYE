"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { Logo } from "@/components/logo";
import { useIsOwner } from "@/lib/use-owner";

/** Margen entre clicks para que cuenten como la misma secuencia. */
const KNOCK_WINDOW_MS = 800;
const KNOCKS_NEEDED = 3;

type SecretEntranceProps = {
  size: number;
  className?: string;
};

/**
 * El logo de la home es la puerta de servicio: tres clicks seguidos llevan al
 * login (o directo a /upload si ya hay sesion). No hay ningun enlace visible a
 * la zona privada, asi que la galeria se queda limpia para quien la visita.
 */
export function SecretEntrance({ size, className }: SecretEntranceProps) {
  const router = useRouter();
  const isOwner = useIsOwner();
  const knocks = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onActivate() {
    if (timer.current) clearTimeout(timer.current);
    knocks.current += 1;

    if (knocks.current >= KNOCKS_NEEDED) {
      knocks.current = 0;
      router.push(isOwner ? "/upload" : "/login");
      return;
    }

    timer.current = setTimeout(() => {
      knocks.current = 0;
    }, KNOCK_WINDOW_MS);
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label="Third Eye"
      className="cursor-default transition-transform duration-150 select-none active:scale-[0.97]"
    >
      <Logo size={size} className={className} />
    </button>
  );
}
