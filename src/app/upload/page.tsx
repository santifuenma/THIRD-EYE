import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UploadForm } from "./upload-form";
import { collectLocations, formatBytes, getPhotos, totalBytes } from "@/lib/photos";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Upload",
  robots: { index: false, follow: false },
};

export default async function UploadPage() {
  // `src/proxy.ts` ya corta el paso, pero la pagina vuelve a comprobarlo: es la
  // unica garantia si algun dia cambia el matcher del proxy.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/upload");

  const photos = await getPhotos();

  return (
    <UploadForm
      locations={collectLocations(photos)}
      storedLabel={formatBytes(totalBytes(photos))}
      photoCount={photos.length}
    />
  );
}
