"use client";

import Image from "next/image";
import { useCallback, useEffect } from "react";

import type { Photo } from "@/lib/photos";

type LightboxProps = {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

export function Lightbox({ photos, index, onClose, onNavigate }: LightboxProps) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(index - 1);
  }, [hasPrev, index, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(index + 1);
  }, [hasNext, index, onNavigate]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [goNext, goPrev, onClose]);

  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.location}
      className="fixed inset-0 z-50 flex flex-col bg-paper"
    >
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <span className="caps text-[11px] font-medium">{photo.location}</span>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="caps cursor-pointer text-[11px] font-medium text-muted transition-colors hover:text-ink"
        >
          Close
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4 sm:px-10">
        <Image
          key={photo.id}
          src={photo.url}
          alt={photo.location}
          width={photo.width}
          height={photo.height}
          placeholder={photo.blur_data_url ? "blur" : "empty"}
          blurDataURL={photo.blur_data_url ?? undefined}
          priority
          className="max-h-full w-auto max-w-full object-contain"
        />
      </div>

      <div className="flex items-center justify-between px-4 py-5 sm:px-6">
        <button
          type="button"
          onClick={goPrev}
          disabled={!hasPrev}
          className="caps cursor-pointer text-[11px] font-medium transition-opacity disabled:cursor-default disabled:opacity-25"
        >
          Prev
        </button>
        <span className="text-[11px] tabular-nums text-muted">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={!hasNext}
          className="caps cursor-pointer text-[11px] font-medium transition-opacity disabled:cursor-default disabled:opacity-25"
        >
          Next
        </button>
      </div>
    </div>
  );
}
