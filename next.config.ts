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

const nextConfig: NextConfig = {
  images: {
    // Vercel reescala cada foto al tamano exacto que pide la pantalla y la
    // sirve en AVIF. Es lo que evita que una foto vertical se vea borrosa en
    // el movil: del original de Storage salen versiones de 640, 1080, 1920...
    // y el navegador coge la suya. El plan Hobby incluye del orden de mil
    // imagenes fuente al mes; un portfolio personal se queda en decenas.
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85],
    // Las rutas llevan un uuid, asi que el contenido nunca cambia: se puede
    // cachear un ano.
    minimumCacheTTL: 31_536_000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname() ?? "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
