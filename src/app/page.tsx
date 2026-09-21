import { Gallery } from "@/components/gallery";
import { OwnerBar } from "@/components/owner-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPhotos } from "@/lib/photos";

// La galeria es identica para todo el mundo: se prerenderiza y se refresca
// cada minuto (o al instante cuando subes o borras una foto desde la app).
export const revalidate = 60;

export default async function HomePage() {
  const photos = await getPhotos();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1120px] flex-col px-4 pb-10 sm:px-6">
      <OwnerBar />
      <SiteHeader secret />
      <main className="mt-10 flex-1 sm:mt-12">
        <Gallery photos={photos} />
      </main>
      <SiteFooter />
    </div>
  );
}
