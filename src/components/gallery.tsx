"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Lightbox } from "@/components/lightbox";
import { deletePhoto } from "@/app/actions";
import type { Photo } from "@/lib/photos";
import { useIsOwner } from "@/lib/use-owner";

export function Gallery({ photos }: { photos: Photo[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [missing, setMissing] = useState<Record<string, true>>({});
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const isOwner = useIsOwner();
  const router = useRouter();

  function onDelete(photo: Photo) {
    if (!window.confirm(`Borrar la foto de ${photo.location}?`)) return;

    setError(null);
    setPendingId(photo.id);
    startTransition(async () => {
      const result = await deletePhoto(photo.id);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpenIndex(null);
      router.refresh();
    });
  }

  // Si un archivo desaparece de Storage (por ejemplo, borrado a mano desde el
  // dashboard) la fila se queda huerfana. Al visitante se le esconde el hueco
  // roto; al dueno se le ensena marcado, para que pueda borrar la fila.
  function markMissing(id: string) {
    setMissing((current) => (current[id] ? current : { ...current, [id]: true }));
  }

  const visible = isOwner ? photos : photos.filter((photo) => !missing[photo.id]);

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p className="caps text-[11px] text-muted">Nothing seen yet</p>
        {isOwner ? (
          <Link href="/upload" className="caps text-[11px] font-medium underline underline-offset-4">
            Upload the first one
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-4 text-center text-[12px] text-ink">
          {error}
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-y-7 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6">
        {visible.map((photo, index) => (
          <li key={photo.id} className="group relative">
            {missing[photo.id] ? (
              <div>
                <div className="flex aspect-square w-full items-center justify-center bg-field">
                  <span className="caps text-[10px] text-muted">File missing</span>
                </div>
                <span className="mt-2 block text-left text-[11px] text-ink/70">
                  {photo.location}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                aria-label={`Ver la foto de ${photo.location}`}
                className="block w-full cursor-pointer"
              >
                <span className="relative block w-full overflow-hidden bg-field sm:aspect-square">
                  <Image
                    src={photo.url}
                    alt={photo.location}
                    width={photo.width}
                    height={photo.height}
                    placeholder={photo.blur_data_url ? "blur" : "empty"}
                    blurDataURL={photo.blur_data_url ?? undefined}
                    loading={index < 6 ? "eager" : "lazy"}
                    quality={85}
                    sizes="(min-width: 640px) 280px, 100vw"
                    onError={() => markMissing(photo.id)}
                    className="h-auto w-full object-cover transition-opacity duration-300 group-hover:opacity-90 sm:absolute sm:inset-0 sm:h-full"
                  />
                </span>
                <span className="mt-2 block text-left text-[11px] text-ink/70">
                  {photo.location}
                </span>
              </button>
            )}

            {isOwner ? (
              <button
                type="button"
                onClick={() => onDelete(photo)}
                disabled={pendingId === photo.id}
                aria-label={`Borrar la foto de ${photo.location}`}
                className="absolute top-2 right-2 cursor-pointer rounded-full bg-paper/90 px-2.5 py-1 text-[10px] font-medium text-ink transition-opacity disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:text-[11px]"
              >
                {pendingId === photo.id ? "..." : "Delete"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {openIndex !== null ? (
        <Lightbox
          photos={visible}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      ) : null}
    </>
  );
}
