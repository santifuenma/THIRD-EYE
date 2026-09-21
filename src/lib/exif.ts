/**
 * Lector minimo de EXIF: saca la fecha de captura y la camara de un JPEG.
 *
 * Existe para rellenar solo los campos "Date taken" y "Taken on" al elegir la
 * foto. El procesado posterior vuelve a pintar la imagen en un canvas y se
 * lleva por delante todos los metadatos, asi que este es el unico momento en el
 * que estan disponibles.
 *
 * Solo entiende JPEG (que es lo que sale de la galeria de un movil al subir por
 * web). Con cualquier otra cosa devuelve campos vacios y se rellenan a mano.
 */

/** Con la cabecera sobra: los metadatos van al principio del archivo. */
const HEADER_BYTES = 256 * 1024;

const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_DATETIME = 0x0132; // fecha de modificacion
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003; // el disparo
const TAG_DATETIME_DIGITIZED = 0x9004;

const WANTED = new Set([
  TAG_MAKE,
  TAG_MODEL,
  TAG_DATETIME,
  TAG_DATETIME_ORIGINAL,
  TAG_DATETIME_DIGITIZED,
]);

const TYPE_ASCII = 2;

export type PhotoMetadata = {
  /** Fecha de captura en formato `YYYY-MM-DD`. */
  takenAt: string | null;
  /** Camara o movil con el que se hizo, tal cual lo escribe el fabricante. */
  device: string | null;
};

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

/** Valor ASCII de una entrada de IFD, este donde este. */
function readEntryValue(
  view: DataView,
  tiffStart: number,
  entry: number,
  little: boolean,
): string | null {
  if (view.getUint16(entry + 2, little) !== TYPE_ASCII) return null;

  const count = view.getUint32(entry + 4, little);
  if (count === 0 || count > 256) return null;

  // Hasta 4 bytes caben en el propio registro; a partir de ahi hay un puntero.
  const offset = count <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, little);
  if (offset + count > view.byteLength) return null;

  return readAscii(view, offset, count).trim() || null;
}

function scanIfd(
  view: DataView,
  tiffStart: number,
  ifdStart: number,
  little: boolean,
  into: Map<number, string>,
): number | null {
  let exifPointer: number | null = null;

  if (ifdStart + 2 > view.byteLength) return null;
  const entries = view.getUint16(ifdStart, little);

  for (let i = 0; i < entries; i += 1) {
    const entry = ifdStart + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;

    const tag = view.getUint16(entry, little);

    if (tag === TAG_EXIF_IFD_POINTER) {
      exifPointer = tiffStart + view.getUint32(entry + 8, little);
      continue;
    }
    if (!WANTED.has(tag) || into.has(tag)) continue;

    const value = readEntryValue(view, tiffStart, entry, little);
    if (value) into.set(tag, value);
  }

  return exifPointer;
}

/**
 * Sony escribe "ILCE-7M3" y Canon "Canon EOS R6": unos repiten la marca en el
 * modelo y otros no. Se usa el modelo, que es lo que identifica al aparato
 * ("iPhone 17 Pro"), y solo se cae a la marca si no hay modelo.
 */
function composeDevice(tags: Map<number, string>): string | null {
  return tags.get(TAG_MODEL) ?? tags.get(TAG_MAKE) ?? null;
}

/** Metadatos utiles de la foto, o campos a null si no hay manera de leerlos. */
export async function readPhotoMetadata(file: File): Promise<PhotoMetadata> {
  const empty: PhotoMetadata = { takenAt: null, device: null };

  try {
    const buffer = await file.slice(0, HEADER_BYTES).arrayBuffer();
    const view = new DataView(buffer);

    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return empty; // no es JPEG

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

    if (tiffStart < 0 || tiffStart + 8 > view.byteLength) return empty;

    const endian = view.getUint16(tiffStart);
    if (endian !== 0x4949 && endian !== 0x4d4d) return empty;
    const little = endian === 0x4949;
    if (view.getUint16(tiffStart + 2, little) !== 0x002a) return empty;

    const tags = new Map<number, string>();
    const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);
    const exifPointer = scanIfd(view, tiffStart, ifd0, little, tags);
    if (exifPointer) scanIfd(view, tiffStart, exifPointer, little, tags);

    const rawDate =
      tags.get(TAG_DATETIME_ORIGINAL) ?? tags.get(TAG_DATETIME_DIGITIZED) ?? tags.get(TAG_DATETIME);

    return {
      takenAt: rawDate ? toIsoDate(rawDate) : null,
      device: composeDevice(tags),
    };
  } catch {
    return empty;
  }
}
