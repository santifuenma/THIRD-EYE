import Link from "next/link";

import { Logo } from "@/components/logo";

type SiteHeaderProps = {
  /** El logo grande y centrado de la pantalla de confirmacion. */
  size?: "default" | "large";
  /** El claim solo aparece en la galeria. */
  tagline?: boolean;
  linkToHome?: boolean;
};

export function SiteHeader({
  size = "default",
  tagline = true,
  linkToHome = true,
}: SiteHeaderProps) {
  const logo =
    size === "large" ? (
      <Logo size={120} className="h-[92px] w-[92px] sm:h-[120px] sm:w-[120px]" />
    ) : (
      <Logo size={96} className="h-[72px] w-[72px] sm:h-[88px] sm:w-[88px]" />
    );

  return (
    <header className="flex flex-col items-center pt-10 sm:pt-14">
      {linkToHome ? (
        <Link href="/" aria-label="Third Eye — inicio" className="transition-opacity hover:opacity-60">
          {logo}
        </Link>
      ) : (
        logo
      )}

      {tagline ? (
        <p className="caps mt-5 text-center text-[11px] leading-[1.8] font-medium sm:text-[12px]">
          Use your third eye
          <br />
          View the world around you
        </p>
      ) : null}
    </header>
  );
}
