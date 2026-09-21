import type { NextConfig } from "next";

function supabaseHostname(): string | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    // Un .env.local a medio rellenar no deberia tumbar el dev server.
    return undefined;
  }
}

const hostname = supabaseHostname();

const nextConfig: NextConfig = {
  images: {
    // Las fotos ya se suben redimensionadas y comprimidas (WebP) desde el
    // navegador, asi que no hace falta volver a optimizarlas en Vercel: se
    // sirven tal cual desde el CDN de Supabase Storage y no consumen cuota de
    // transformaciones. `<Image>` sigue dando lazy-load, blur y reserva de
    // espacio. Si algun dia quieres que Vercel las reprocese, pon esto en
    // false y deja los remotePatterns de abajo.
    unoptimized: true,
    remotePatterns: hostname
      ? [{ protocol: "https", hostname, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
