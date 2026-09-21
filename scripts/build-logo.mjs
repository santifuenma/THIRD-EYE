/**
 * Regenera src/components/logo.tsx a partir de public/logo.svg.
 *
 * El logo va embebido en el JSX (y no como <img src="/logo.svg">) para que
 * herede el color del texto y no cueste una peticion extra. El precio es que
 * cambiar el .svg no basta: hay que volver a generar el componente.
 *
 *   npm run logo
 */

import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public/logo.svg");

const svg = readFileSync(source, "utf8");

const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
if (!viewBox) {
  console.error("public/logo.svg no tiene un viewBox del tipo \"0 0 ancho alto\".");
  process.exit(1);
}
const [, width, height] = viewBox;

const body = svg
  .split(">")
  .slice(1)
  .join(">")
  .replace(/<\/svg>\s*$/, "")
  .trim()
  .replace(/"black"/g, '"currentColor"')
  .replace(/stroke-width=/g, "strokeWidth=")
  .replace(/stroke-linecap=/g, "strokeLinecap=")
  .replace(/stroke-linejoin=/g, "strokeLinejoin=")
  .replace(/fill-rule=/g, "fillRule=")
  .replace(/clip-rule=/g, "clipRule=")
  .split("\n")
  .map((line) => "      " + line)
  .join("\n");

const component = `type LogoProps = {
  /** Ancho en px. El alto sale del viewBox, asi que nunca se deforma. */
  size?: number;
  className?: string;
  title?: string;
};

/** Proporcion alto/ancho del viewBox (${width} x ${height}). */
const RATIO = ${height} / ${width};

/**
 * Marca THIRD EYE. Hereda el color del texto (\`currentColor\`), asi que se
 * puede invertir sobre fondo oscuro con \`text-paper\`.
 *
 * Generado por scripts/build-logo.mjs desde public/logo.svg: no editar a mano,
 * cambia el SVG y ejecuta \`npm run logo\`.
 */
export function Logo({ size = 96, className, title = "Third Eye" }: LogoProps) {
  return (
    <svg
      width={size}
      height={Math.round(size * RATIO)}
      viewBox="0 0 ${width} ${height}"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
${body}
    </svg>
  );
}
`;

writeFileSync(join(root, "src/components/logo.tsx"), component);
copyFileSync(source, join(root, "src/app/icon.svg"));

console.log(`Logo regenerado desde public/logo.svg (${width}x${height}).`);
console.log("Actualizados: src/components/logo.tsx y src/app/icon.svg (favicon).");
