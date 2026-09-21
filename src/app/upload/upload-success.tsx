import Link from "next/link";

import { Logo } from "@/components/logo";

/** Pantalla de confirmacion: logo grande, mensaje y salida a la galeria. */
export function UploadSuccess({ onUploadMore }: { onUploadMore?: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col items-center px-6 pb-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-7">
        <Logo size={128} className="h-[104px] w-[104px] sm:h-[128px] sm:w-[128px]" />
        <p className="text-[15px]">Pictures uploaded!</p>
      </div>

      <div className="flex w-full flex-col items-center gap-4">
        <Link
          href="/"
          className="caps w-full rounded-full bg-ink py-4 text-center text-[12px] font-medium text-paper transition-opacity hover:opacity-90"
        >
          Go look at your vision
        </Link>
        {onUploadMore ? (
          <button
            type="button"
            onClick={onUploadMore}
            className="caps cursor-pointer text-[11px] text-muted transition-colors hover:text-ink"
          >
            Upload more
          </button>
        ) : null}
      </div>
    </div>
  );
}
