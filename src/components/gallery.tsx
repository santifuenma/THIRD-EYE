"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Lightbox } from "@/components/lightbox";
import { deletePhoto } from "@/app/actions";
import { formatTakenAt } from "@/lib/dates";
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

      <ul className="columns-1 gap-x-5 sm:columns-2 lg:columns-3">
        {visible.map((photo, index) => (
          <li key={photo.id} className="group relative mb-5 break-inside-avoid sm:mb-4">
            {missing[photo.id] ? (
              <div>
                <div
                  className="flex w-full items-center justify-center bg-field"
                  style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                >
                  <span className="caps text-[10px] text-muted">File missing</span>
                </div>
                <Caption photo={photo} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                aria-label={`Ver la foto de ${photo.location}`}
                className="block w-full cursor-pointer"
              >
                <span className="block w-full overflow-hidden bg-field">
                  <Image
                    src={photo.url}
                    alt={photo.location}
                    width={photo.width}
                    height={photo.height}
                    placeholder={photo.blur_data_url ? "blur" : "empty"}
                    blurDataURL={photo.blur_data_url ?? undefined}
                    loading={index < 6 ? "eager" : "lazy"}
                    quality={85}
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                    onError={() => markMissing(photo.id)}
                    className="h-auto w-full transition-opacity duration-300 group-hover:opacity-90"
                  />
                </span>
                <Caption photo={photo} />
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

/** Pie de foto: fecha y lugar a la izquierda, con que se hizo a la derecha. */
function Caption({ photo }: { photo: Photo }) {
  const date = formatTakenAt(photo.taken_at);

  return (
    <span className="mt-1.5 flex items-start justify-between gap-4 text-left text-[11px] leading-[1.5] text-muted">
      <span className="min-w-0">
        {date ? <span className="block">{date}</span> : null}
        <span className="block">{photo.location}</span>
      </span>
      {photo.device ? (
        <span className="shrink-0 text-right">Taken on {photo.device}</span>
      ) : null}
    </span>
  );
}
