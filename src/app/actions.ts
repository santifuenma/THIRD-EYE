"use server";

import { revalidatePath } from "next/cache";

import { LOCATION_MAX_LENGTH } from "@/lib/constants";
import { PHOTOS_BUCKET } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export type NewPhotoInput = {
  storagePath: string;
  width: number;
  height: number;
  blurDataUrl: string;
  location: string;
  bytes: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_PATH_RE = /^[0-9a-f-]{36}\/(full|thumb)\.(webp|jpg)$/i;

const BLUR_MAX_LENGTH = 6000;

function isPositiveInt(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max;
}

/**
 * Guarda los metadatos de una foto ya subida a Storage.
 *
 * Las server actions son endpoints POST publicos, asi que la sesion se
 * comprueba aqui dentro ademas de en las policies RLS de Supabase.
 */
export async function createPhoto(input: NewPhotoInput): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Sesion caducada. Vuelve a iniciar sesion." };

  const location = input.location?.trim() ?? "";
  if (!location || location.length > LOCATION_MAX_LENGTH) {
    return { ok: false, error: "Escribe la localizacion (maximo 80 caracteres)." };
  }
  if (!STORAGE_PATH_RE.test(input.storagePath)) {
    return { ok: false, error: "Ruta de archivo no valida." };
  }
  if (!isPositiveInt(input.width, 10_000) || !isPositiveInt(input.height, 10_000)) {
    return { ok: false, error: "Dimensiones de imagen no validas." };
  }
  if (!isPositiveInt(input.bytes, 60 * 1024 * 1024)) {
    return { ok: false, error: "Tamano de imagen no valido." };
  }
  if (
    typeof input.blurDataUrl !== "string" ||
    !input.blurDataUrl.startsWith("data:image/") ||
    input.blurDataUrl.length > BLUR_MAX_LENGTH
  ) {
    return { ok: false, error: "Placeholder no valido." };
  }

  const { data, error } = await supabase
    .from("photos")
    .insert({
      owner_id: user.id,
      location,
      storage_path: input.storagePath,
      width: input.width,
      height: input.height,
      blur_data_url: input.blurDataUrl,
      bytes: input.bytes,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true, data: { id: data.id as string } };
}

/** Borra la fila y sus dos objetos de Storage. Solo para la sesion del dueno. */
export async function deletePhoto(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Sesion caducada. Vuelve a iniciar sesion." };
  if (!UUID_RE.test(id)) return { ok: false, error: "Identificador no valido." };

  const { data: photo, error: readError } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!photo) return { ok: false, error: "Esa foto ya no existe." };

  const { error: deleteError } = await supabase.from("photos").delete().eq("id", id);
  if (deleteError) return { ok: false, error: deleteError.message };

  // La segunda ruta solo existe en las fotos subidas cuando ademas se guardaba
  // una miniatura; borrar una clave que no esta es inocuo.
  const { error: storageError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .remove([photo.storage_path, photo.storage_path.replace("/full.", "/thumb.")]);

  // La fila ya no esta: si el borrado del archivo falla solo queda basura en
  // Storage, no una foto rota en la galeria.
  if (storageError) console.error("[photos] no se pudo borrar de Storage:", storageError.message);

  revalidatePath("/");
  return { ok: true, data: null };
}

/** Limpia los objetos subidos cuando el insert de metadatos falla a medias. */
export async function discardUploads(paths: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Sesion caducada." };

  const valid = paths.filter((path) => STORAGE_PATH_RE.test(path)).slice(0, 20);
  if (valid.length === 0) return { ok: true, data: null };

  const { error } = await supabase.storage.from(PHOTOS_BUCKET).remove(valid);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
