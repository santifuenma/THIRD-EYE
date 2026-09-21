/**
 * Lector minimo de EXIF: saca la fecha de captura de un JPEG.
 *
 * Existe para rellenar solo el campo "Date taken" al elegir la foto. El
 * procesado posterior vuelve a pintar la imagen en un canvas y se lleva por
 * delante todos los metadatos, asi que este es el unico momento en el que la
 * fecha original esta disponible.
 *
 * Solo entiende JPEG (que es lo que sale de la galeria de un movil al subir por
 * web). Con cualquier otra cosa devuelve null y la fecha se elige a mano.
 */

/** Con la cabecera sobra: los metadatos van al principio del archivo. */
const HEADER_BYTES = 256 * 1024;

const TAG_DATETIME = 0x0132; // IFD0: fecha de modificacion
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003; // el disparo
const TAG_DATETIME_DIGITIZED = 0x9004;

/** "2026:09:12 18:41:07" -> "2026-09-12" */
function toIsoDate(exifDate: string): string | null {
  const match = exifDate.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  if (year === "0000" || month === "00" || day === "00") return null;
  return `${year}-${month}-${day}`;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

/**
 * Recorre las entradas de un IFD. Devuelve la primera fecha encontrada segun el
 * orden de preferencia de `wanted`, y el puntero al sub-IFD de Exif si aparece.
 */
function scanIfd(
  view: DataView,
  tiffStart: number,
  ifdStart: number,
  little: boolean,
): { dates: Map<number, string>; exifPointer: number | null } {
  const dates = new Map<number, string>();
  let exifPointer: number | null = null;

  if (ifdStart + 2 > view.byteLength) return { dates, exifPointer };
  const entries = view.getUint16(ifdStart, little);

  for (let i = 0; i < entries; i += 1) {
    const entry = ifdStart + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;

    const tag = view.getUint16(entry, little);

    if (tag === TAG_EXIF_IFD_POINTER) {
      exifPointer = tiffStart + view.getUint32(entry + 8, little);
      continue;
    }

    if (tag !== TAG_DATETIME && tag !== TAG_DATETIME_ORIGINAL && tag !== TAG_DATETIME_DIGITIZED) {
      continue;
    }

    const count = view.getUint32(entry + 4, little);
    if (count < 10 || count > 64) continue;

    // Un ASCII de 20 bytes nunca cabe en los 4 del propio registro: el valor
    // siempre esta en el offset al que apunta.
    const valueOffset = tiffStart + view.getUint32(entry + 8, little);
    if (valueOffset + count > view.byteLength) continue;

    const iso = toIsoDate(readAscii(view, valueOffset, count));
    if (iso) dates.set(tag, iso);
  }

  return { dates, exifPointer };
}

/** Fecha de captura en formato `YYYY-MM-DD`, o null si no hay manera. */
export async function readTakenDate(file: File): Promise<string | null> {
  try {
    const buffer = await file.slice(0, HEADER_BYTES).arrayBuffer();
    const view = new DataView(buffer);

    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // no es JPEG

    // Buscar el segmento APP1 con la firma "Exif\0\0".
    let offset = 2;
    let tiffStart = -1;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (marker === 0xda) break; // empiezan los datos de imagen

      const size = view.getUint16(offset + 2);
      if (marker === 0xe1 && readAscii(view, offset + 4, 4) === "Exif") {
        tiffStart = offset + 10;
        break;
      }
      offset += 2 + size;
    }

    if (tiffStart < 0 || tiffStart + 8 > view.byteLength) return null;

    const endian = view.getUint16(tiffStart);
    if (endian !== 0x4949 && endian !== 0x4d4d) return null;
    const little = endian === 0x4949;
    if (view.getUint16(tiffStart + 2, little) !== 0x002a) return null;

    const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);
    const first = scanIfd(view, tiffStart, ifd0, little);
    const second = first.exifPointer
      ? scanIfd(view, tiffStart, first.exifPointer, little)
      : { dates: new Map<number, string>(), exifPointer: null };

    const dates = new Map([...first.dates, ...second.dates]);

    return (
      dates.get(TAG_DATETIME_ORIGINAL) ??
      dates.get(TAG_DATETIME_DIGITIZED) ??
      dates.get(TAG_DATETIME) ??
      null
    );
  } catch {
    return null;
  }
}
