"use client";

import Link from "next/link";

import { useIsOwner } from "@/lib/use-owner";

/** Acceso discreto a /upload, visible solo si hay sesion iniciada. */
export function OwnerBar() {
  const isOwner = useIsOwner();
  if (!isOwner) return null;

  return (
    <div className="fixed top-3 right-3 z-40 sm:top-4 sm:right-5">
      <Link
        href="/upload"
        className="caps animate-rise rounded-full bg-ink px-4 py-2 text-[10px] font-medium text-paper transition-[opacity,transform] duration-200 hover:opacity-80 active:scale-[0.97] sm:text-[11px]"
      >
        Upload
      </Link>
    </div>
  );
}
