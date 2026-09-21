/** Bucket publico de Storage donde viven las fotos. */
export const PHOTOS_BUCKET = "photos";

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.example a .env.local y rellenala con los datos de tu proyecto Supabase.`,
    );
  }
  return value;
}

// Se leen de forma perezosa (y no en el ambito del modulo) para que un fallo de
// configuracion no reviente el build entero, solo la peticion que las necesita.
export function getSupabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** URL publica de un objeto del bucket (el bucket es de lectura publica). */
export function storagePublicUrl(path: string): string {
  return `${getSupabaseUrl()}/storage/v1/object/public/${PHOTOS_BUCKET}/${path}`;
}
