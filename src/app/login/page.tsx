import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "./login-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-6 pb-16">
      <SiteHeader tagline={false} />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
