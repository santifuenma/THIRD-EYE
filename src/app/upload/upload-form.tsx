"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createPhoto, discardUploads } from "@/app/actions";
import { SiteHeader } from "@/components/site-header";
import { UploadSuccess } from "./upload-success";
import { DEVICE_MAX_LENGTH, LOCATION_MAX_LENGTH, MAX_FILES_PER_UPLOAD } from "@/lib/constants";
import { formatTakenAt, TAKEN_AT_PLACEHOLDER } from "@/lib/dates";
import { readPhotoMetadata } from "@/lib/exif";
import { processImage } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { PHOTOS_BUCKET } from "@/lib/supabase/env";

type Selected = {
  key: string;
  file: File;
  previewUrl: string;
};

type Progress = {
  index: number;
  total: number;
  step: "processing" | "uploading" | "saving";
};

const STEP_LABEL: Record<Progress["step"], string> = {
  processing: "Optimizing",
  uploading: "Uploading",
  saving: "Saving",
};

type UploadFormProps = {
  locations: string[];
  storedLabel: string;
  photoCount: number;
};

export function UploadForm({ locations, storedLabel, photoCount }: UploadFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [location, setLocation] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [device, setDevice] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Las object URL de las previsualizaciones hay que liberarlas a mano, pero
  // solo al desmontar: si el efecto dependiese de `selected`, anadir una foto
  // revocaria las URL de las que ya estaban.
  const selectedRef = useRef<Selected[]>([]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    return () => {
      for (const item of selectedRef.current) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  const busy = progress !== null;
  const canPublish =
    selected.length > 0 && location.trim().length > 0 && takenAt.length > 0 && !busy;

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      setError("Solo se pueden subir imagenes.");
      return;
    }

    setSelected((current) => {
      const room = MAX_FILES_PER_UPLOAD - current.length;
      if (room <= 0) {
        setError("Maximo " + MAX_FILES_PER_UPLOAD + " fotos por tanda.");
        return current;
      }
      if (images.length > room) {
        setError("Maximo " + MAX_FILES_PER_UPLOAD + " fotos por tanda.");
      }
      const next = images.slice(0, room).map((file) => ({
        key: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      void prefillFromExif(next.map((item) => item.file));
      return [...current, ...next];
    });
  }

  /**
   * La fecha y la camara se rellenan solas con lo que diga el EXIF. Solo se
   * tocan los campos vacios: si ya has escrito algo, manda lo tuyo.
   */
  async function prefillFromExif(files: File[]) {
    let needsDate = true;
    let needsDevice = true;

    for (const file of files) {
      if (!needsDate && !needsDevice) return;

      const meta = await readPhotoMetadata(file);
      if (needsDate && meta.takenAt) {
        needsDate = false;
        setTakenAt((current) => current || meta.takenAt!);
      }
      if (needsDevice && meta.device) {
        needsDevice = false;
        setDevice((current) => current || meta.device!.slice(0, DEVICE_MAX_LENGTH));
      }
    }
  }

  function removeFile(key: string) {
    setSelected((current) => {
      const target = current.find((item) => item.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.key !== key);
    });
  }

  async function publish() {
    if (!canPublish) return;

    setError(null);
    const supabase = createClient();
    const storage = supabase.storage.from(PHOTOS_BUCKET);
    const trimmedLocation = location.trim();
    const orphans: string[] = [];
    const published: string[] = [];

    try {
      for (let index = 0; index < selected.length; index += 1) {
        const item = selected[index];

        setProgress({ index: index + 1, total: selected.length, step: "processing" });
        const processed = await processImage(item.file);

        const id = crypto.randomUUID();
        const storagePath = id + "/full." + processed.extension;

        setProgress({ index: index + 1, total: selected.length, step: "uploading" });
        const upload = await storage.upload(storagePath, processed.blob, {
          contentType: processed.contentType,
          cacheControl: "31536000",
          upsert: false,
        });
        if (upload.error) throw new Error(upload.error.message);
        orphans.push(storagePath);

        setProgress({ index: index + 1, total: selected.length, step: "saving" });
        const saved = await createPhoto({
          storagePath,
          takenAt,
          device,
          width: processed.width,
          height: processed.height,
          blurDataUrl: processed.blurDataUrl,
          location: trimmedLocation,
          bytes: processed.bytes,
        });
        if (!saved.ok) throw new Error(saved.error);

        // Esta foto ya esta completa: deja de ser candidata a limpieza.
        orphans.length = 0;
        published.push(item.key);
      }

      for (const item of selected) URL.revokeObjectURL(item.previewUrl);
      setSelected([]);
      setProgress(null);
      setDone(true);
      router.refresh();
    } catch (caught) {
      setProgress(null);
      if (orphans.length > 0) await discardUploads(orphans);

      // Las que si se publicaron salen de la lista para que reintentar no las
      // duplique.
      setSelected((current) =>
        current.filter((item) => {
          if (!published.includes(item.key)) return true;
          URL.revokeObjectURL(item.previewUrl);
          return false;
        }),
      );

      const reason = caught instanceof Error ? caught.message : "No se pudo publicar.";
      setError(
        published.length > 0
          ? `Se publicaron ${published.length} de ${selected.length}. La siguiente fallo: ${reason}`
          : reason,
      );
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (done) {
    return <UploadSuccess onUploadMore={() => setDone(false)} />;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-6 pb-8">
      <div className="relative">
        <SiteHeader tagline={false} />
        <button
          type="button"
          onClick={signOut}
          className="caps absolute top-0 right-0 cursor-pointer text-[10px] text-muted transition-colors hover:text-ink"
        >
          Sign out
        </button>
      </div>

      <main className="mt-9 flex flex-1 flex-col gap-6">
        <div>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(event.dataTransfer.files);
            }}
            className={
              "rounded-2xl border p-3 transition-colors " +
              (dragging ? "border-dashed border-ink bg-field" : "border-line bg-field/60")
            }
          >
            {selected.length === 0 ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="flex aspect-3/2 w-full cursor-pointer flex-col items-center justify-center gap-3 text-muted transition-colors hover:text-ink disabled:cursor-default"
              >
                <ImagePlusIcon />
                <span className="caps text-[11px] font-medium">Upload your picture</span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {selected.map((item) => (
                  <div
                    key={item.key}
                    className="animate-rise relative aspect-square overflow-hidden rounded-lg bg-line"
                  >
                    <Image
                      src={item.previewUrl}
                      alt={item.file.name}
                      fill
                      unoptimized
                      sizes="120px"
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(item.key)}
                      disabled={busy}
                      aria-label={"Quitar " + item.file.name}
                      className="absolute top-1 right-1 cursor-pointer rounded-full bg-paper/90 px-1.5 py-0.5 text-[11px] leading-4 font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                    >
                      &times;
                    </button>
                  </div>
                ))}

                {selected.length < MAX_FILES_PER_UPLOAD ? (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy}
                    className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed border-line text-[18px] text-muted transition-colors hover:text-ink disabled:cursor-default"
                    aria-label="Anadir mas fotos"
                  >
                    +
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold">Location, Country</span>
          <input
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Valencia, ES"
            maxLength={LOCATION_MAX_LENGTH}
            list="known-locations"
            disabled={busy}
            className="w-full rounded-xl bg-field px-4 py-3.5 text-[14px] outline-none placeholder:text-muted focus:ring-1 focus:ring-ink/20 disabled:opacity-60"
          />
          <datalist id="known-locations">
            {locations.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold">Date taken</span>
          {/*
            El <input type="date"> va encima, transparente: aporta el selector
            nativo (y en el movil, la ruleta) mientras la caja de abajo mantiene
            el formato de la marca, que el navegador no deja personalizar.
          */}
          <div className="relative">
            <div
              aria-hidden="true"
              className={
                "w-full rounded-xl bg-field px-4 py-3.5 text-[14px] " +
                (takenAt ? "text-ink" : "text-muted") +
                (busy ? " opacity-60" : "")
              }
            >
              {(takenAt && formatTakenAt(takenAt)) || TAKEN_AT_PLACEHOLDER}
            </div>
            <input
              type="date"
              value={takenAt}
              onChange={(event) => setTakenAt(event.target.value)}
              onClick={(event) => {
                // Chrome solo abre el calendario al pulsar su icono, que aqui
                // es invisible.
                event.currentTarget.showPicker?.();
              }}
              disabled={busy}
              className="absolute inset-0 h-full w-full cursor-pointer rounded-xl opacity-0 disabled:cursor-default"
            />
          </div>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold">Taken on</span>
          <input
            type="text"
            value={device}
            onChange={(event) => setDevice(event.target.value)}
            placeholder="iPhone 17 Pro"
            maxLength={DEVICE_MAX_LENGTH}
            disabled={busy}
            className="w-full rounded-xl bg-field px-4 py-3.5 text-[14px] outline-none placeholder:text-muted focus:ring-1 focus:ring-ink/20 disabled:opacity-60"
          />
        </label>

        {progress ? (
          <div className="animate-fade-in flex flex-col gap-2" aria-live="polite">
            <p className="caps text-[11px] text-muted">
              {STEP_LABEL[progress.step]} {progress.index} / {progress.total}
            </p>
            <div className="h-px w-full bg-line">
              <div
                className="h-px bg-ink transition-[width] duration-300"
                style={{ width: Math.round((progress.index / progress.total) * 100) + "%" }}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="animate-rise text-[12px] text-ink">
            {error}
          </p>
        ) : null}
      </main>

      <footer className="flex flex-col items-center gap-3 pt-8">
        <button
          type="button"
          onClick={publish}
          disabled={!canPublish}
          className="caps w-full cursor-pointer rounded-full bg-ink py-4 text-[12px] font-medium text-paper transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.99] disabled:cursor-default disabled:opacity-30 disabled:active:scale-100"
        >
          {busy ? "Publishing" : "Publish"}
        </button>
        <p className="text-[10px] text-muted">
          {photoCount} {photoCount === 1 ? "photo" : "photos"} · {storedLabel} stored
        </p>
      </footer>
    </div>
  );
}

function ImagePlusIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 13V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m3 16 4.5-4.5a2 2 0 0 1 2.8 0L15 16" />
      <path d="M18 15v6M15 18h6" />
    </svg>
  );
}
