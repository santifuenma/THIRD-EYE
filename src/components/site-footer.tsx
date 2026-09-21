/**
 * Firma del pie, centrada al final de la galeria.
 *
 * Misma tipografia que el claim de la cabecera (versalitas espaciadas, peso
 * medio) pero un punto por debajo en tamano: 11 px frente a los 12 del claim en
 * escritorio, para que siga siendo el claim quien manda.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 pt-4 text-center sm:mt-20">
      <p className="caps animate-fade-in text-[11px] font-medium text-ink">
        Captured by Santiago Fuenmayor Ruiz&rsquo;s third eye
      </p>
    </footer>
  );
}
