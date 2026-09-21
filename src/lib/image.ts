/**
 * Procesado de imagenes en el navegador: antes de subir nada a Supabase la foto
 * se redimensiona, se recomprime a WebP y se le calcula un placeholder borroso.
 *
 * Se guarda una sola version de cada foto. Las medidas que necesita cada
 * pantalla (la reticula en el movil, el visor en un portatil) las genera Vercel
 * a partir de ella, asi que no tiene sentido guardar una miniatura aparte: solo
 * ocuparia sitio y limitaria la calidad de la reticula.
 *
 * Como efecto secundario, volver a pintar la imagen en un canvas elimina los
 * metadatos EXIF (incluida la geolocalizacion del movil).
 */

/**
 * Lado mayor de la foto que se guarda.
 *
 * 3000 px deja ~1690 de ancho en una vertical 9:16: de sobra para el visor a
 * pantalla completa en un portatil retina, y para que la reticula del movil
 * (que pide unos 1100 px de ancho a DPR 3) se vea nitida.
 */
export const MAX_EDGE = 3000;
/** Lado mayor del placeholder borroso embebido en el HTML. */
const BLUR_MAX_EDGE = 12;

const QUALITY = 0.85;

export const ACCEPTED_MIME = "image/*";
export const MAX_INPUT_BYTES = 40 * 1024 * 1024;

export type ProcessedImage = {
  blob: Blob;
  width: number;
  height: number;
  extension: "webp" | "jpg";
  contentType: string;
  blurDataUrl: string;
  bytes: number;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function decode(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Safari antiguo o formato no soportado por createImageBitmap: se
      // reintenta con un <img>, que ya aplica la orientacion EXIF al pintar.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("El navegador no pudo leer esta imagen"));
      element.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function scaledSize(width: number, height: number, maxEdge: number) {
  const ratio = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este navegador no permite procesar imagenes en canvas");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

/**
 * Reduce en pasos de mitad de tamano antes del paso final: un unico drawImage
 * con un factor de reduccion grande deja la imagen con aliasing.
 */
function drawResized(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  let current = source;
  let currentWidth = sourceWidth;
  let currentHeight = sourceHeight;

  while (currentWidth / 2 > targetWidth) {
    const stepWidth = Math.max(targetWidth, Math.round(currentWidth / 2));
    const stepHeight = Math.max(targetHeight, Math.round(currentHeight / 2));
    const { canvas, context } = canvasOf(stepWidth, stepHeight);
    context.drawImage(current, 0, 0, stepWidth, stepHeight);
    current = canvas;
    currentWidth = stepWidth;
    currentHeight = stepHeight;
  }

  const { canvas, context } = canvasOf(targetWidth, targetHeight);
  context.drawImage(current, 0, 0, targetWidth, targetHeight);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** WebP si el navegador sabe codificarlo (Safari < 16.4 no), si no JPEG. */
async function encode(canvas: HTMLCanvasElement, quality: number) {
  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") {
    return { blob: webp, contentType: "image/webp", extension: "webp" as const };
  }
  const jpeg = await toBlob(canvas, "image/jpeg", Math.min(0.9, quality + 0.06));
  if (!jpeg) throw new Error("No se pudo comprimir la imagen");
  return { blob: jpeg, contentType: "image/jpeg", extension: "jpg" as const };
}

export async function processImage(file: File): Promise<ProcessedImage> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("La imagen pesa mas de 40 MB");
  }

  const decoded = await decode(file);
  try {
    const size = scaledSize(decoded.width, decoded.height, MAX_EDGE);
    const blurSize = scaledSize(decoded.width, decoded.height, BLUR_MAX_EDGE);

    const canvas = drawResized(
      decoded.source,
      decoded.width,
      decoded.height,
      size.width,
      size.height,
    );
    const blurCanvas = drawResized(
      canvas,
      size.width,
      size.height,
      blurSize.width,
      blurSize.height,
    );

    const encoded = await encode(canvas, QUALITY);
    const blurDataUrl = blurCanvas.toDataURL(
      encoded.contentType === "image/webp" ? "image/webp" : "image/jpeg",
      0.5,
    );

    return {
      blob: encoded.blob,
      width: size.width,
      height: size.height,
      extension: encoded.extension,
      contentType: encoded.contentType,
      blurDataUrl,
      bytes: encoded.blob.size,
    };
  } finally {
    decoded.release();
  }
}
