import { Gallery } from "@/components/gallery";
import { OwnerBar } from "@/components/owner-bar";
import { SiteHeader } from "@/components/site-header";
import { getPhotos } from "@/lib/photos";

// La galeria es identica para todo el mundo: se prerenderiza y se refresca
// cada 5 minutos (o al instante cuando subes o borras una foto).
export const revalidate = 300;

export default async function HomePage() {
  const photos = await getPhotos();

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pb-24 sm:px-6">
      <OwnerBar />
      <SiteHeader secret />
      <main className="mt-10 sm:mt-12">
        <Gallery photos={photos} />
      </main>
    </div>
  );
}
