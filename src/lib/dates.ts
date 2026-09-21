/** Formato de fecha de la marca: en castellano y con el mes en mayuscula. */

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Una fecha sin hora, tal y como viaja por la base de datos: `2026-09-12`. */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parts(isoDate: string): [number, string, number] | null {
  if (!ISO_DATE_RE.test(isoDate)) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Se parte la cadena a mano en vez de usar `new Date`: un `2026-09-12` se
  // interpreta como UTC y en husos negativos acabaria mostrando el dia 11.
  return [day, MESES[month - 1], year];
}

/** "12 de Septiembre, 2026" — el que va bajo cada foto. */
export function formatTakenAt(isoDate: string | null): string | null {
  const value = isoDate && parts(isoDate);
  if (!value) return null;
  const [day, month, year] = value;
  return `${day} de ${month}, ${year}`;
}

/** "12 de Septiembre de 2026" — el del formulario de subida. */
export function formatTakenAtLong(isoDate: string): string | null {
  const value = parts(isoDate);
  if (!value) return null;
  const [day, month, year] = value;
  return `${day} de ${month} de ${year}`;
}

/** Rechaza fechas imposibles y las de pasado manana en adelante. */
export function isPlausibleTakenAt(isoDate: string): boolean {
  if (!ISO_DATE_RE.test(isoDate)) return false;

  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  if (date.toISOString().slice(0, 10) !== isoDate) return false;

  const year = date.getUTCFullYear();
  if (year < 1826) return false; // la primera fotografia conocida

  const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
  return date.getTime() <= tomorrow;
}
