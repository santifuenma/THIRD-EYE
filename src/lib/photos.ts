import { storagePublicUrl } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";

/** Fila tal cual vive en la tabla `public.photos`. */
export type PhotoRow = {
  id: string;
  location: string;
  /** Fecha de captura en formato `YYYY-MM-DD`. */
  taken_at: string | null;
  storage_path: string;
  width: number;
  height: number;
  blur_data_url: string | null;
  bytes: number | null;
  created_at: string;
};

/** Foto lista para pintar: con la URL publica ya resuelta. */
export type Photo = PhotoRow & {
  url: string;
};

const PHOTO_COLUMNS =
  "id, location, taken_at, storage_path, width, height, blur_data_url, bytes, created_at";

/** Tope de fotos por pagina de galeria. Suficiente para un portfolio personal. */
export const GALLERY_LIMIT = 300;

function isFrameworkError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_") || digest === "DYNAMIC_SERVER_USAGE");
}

function toPhoto(row: PhotoRow): Photo {
  return {
    ...row,
    url: storagePublicUrl(row.storage_path),
  };
}

/**
 * Fotos publicadas, de la mas reciente a la mas antigua. Si Supabase falla no
 * se tira la pagina entera: se devuelve una galeria vacia.
 */
export async function getPhotos(): Promise<Photo[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("photos")
      .select(PHOTO_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(GALLERY_LIMIT);

    if (error) {
      console.error("[photos] no se pudieron leer las fotos:", error.message);
      return [];
    }

    return (data as PhotoRow[]).map(toPhoto);
  } catch (error) {
    // Los errores internos de Next (redirect, notFound, render dinamico) viajan
    // como excepciones: hay que dejarlos pasar.
    if (isFrameworkError(error)) throw error;
    console.error("[photos] error inesperado leyendo las fotos:", error);
    return [];
  }
}

/** Localizaciones ya usadas (para autocompletar el formulario de subida). */
export function collectLocations(photos: Photo[]): string[] {
  return [...new Set(photos.map((photo) => photo.location))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Bytes ocupados en Storage segun los metadatos guardados. */
export function totalBytes(photos: Photo[]): number {
  return photos.reduce((sum, photo) => sum + (photo.bytes ?? 0), 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
