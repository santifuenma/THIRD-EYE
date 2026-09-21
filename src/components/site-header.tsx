import Link from "next/link";

import { Logo } from "@/components/logo";
import { SecretEntrance } from "@/components/secret-entrance";

type SiteHeaderProps = {
  /** El logo grande y centrado de la pantalla de confirmacion. */
  size?: "default" | "large";
  /** El claim solo aparece en la galeria. */
  tagline?: boolean;
  linkToHome?: boolean;
  /** En la home el logo esconde el acceso a la zona privada (3 clicks). */
  secret?: boolean;
};

export function SiteHeader({
  size = "default",
  tagline = true,
  linkToHome = true,
  secret = false,
}: SiteHeaderProps) {
  const logoSize = size === "large" ? 120 : 96;
  const logoClass =
    size === "large"
      ? "h-auto w-[92px] sm:w-[120px]"
      : "h-auto w-[72px] sm:w-[88px]";

  let logo;
  if (secret) {
    logo = <SecretEntrance size={logoSize} className={logoClass} />;
  } else if (linkToHome) {
    logo = (
      <Link href="/" aria-label="Third Eye — inicio" className="transition-opacity hover:opacity-60">
        <Logo size={logoSize} className={logoClass} />
      </Link>
    );
  } else {
    logo = <Logo size={logoSize} className={logoClass} />;
  }

  return (
    <header className="flex flex-col items-center pt-10 sm:pt-14">
      {logo}

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
