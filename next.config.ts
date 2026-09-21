import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  images: {
    // Las fotos ya se suben redimensionadas y comprimidas (WebP) desde el
    // navegador, asi que no hace falta volver a optimizarlas en Vercel: se
    // sirven tal cual desde el CDN de Supabase Storage y no consumen cuota de
    // transformaciones. `<Image>` sigue dando lazy-load, blur y reserva de
    // espacio. Si algun dia quieres que Vercel las reprocese, pon esto en
    // false y deja los remotePatterns de abajo.
    unoptimized: true,
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
