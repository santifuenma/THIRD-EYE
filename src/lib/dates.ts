/** Formato de fecha de la marca: "September, 12th, 2026". */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Una fecha sin hora, tal y como viaja por la base de datos: `2026-09-12`. */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** El ejemplo que se ensena en el campo vacio del formulario. */
export const TAKEN_AT_PLACEHOLDER = "September, 12th, 2026";

function ordinal(day: number): string {
  const teens = day % 100;
  if (teens >= 11 && teens <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** "September, 12th, 2026", o null si la cadena no es una fecha. */
export function formatTakenAt(isoDate: string | null): string | null {
  if (!isoDate || !ISO_DATE_RE.test(isoDate)) return null;

  const [year, month, day] = isoDate.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Se parte la cadena a mano en vez de usar `new Date`: un `2026-09-12` se
  // interpreta como UTC y en husos negativos acabaria mostrando el dia 11.
  return `${MONTHS[month - 1]}, ${ordinal(day)}, ${year}`;
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
