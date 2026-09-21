"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * El login se hace desde el navegador a proposito: `@supabase/ssr` guarda la
 * sesion en cookies que tambien lee el servidor, y asi la galeria publica puede
 * seguir siendo HTML cacheado mientras los controles de dueno se deciden en
 * cliente.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function safeNext(): string {
    const next = searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) return next;
    return "/upload";
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError("No hemos podido entrar con esos datos.");
        setPending(false);
        return;
      }

      router.replace(safeNext());
      router.refresh();
    } catch {
      setError("Falta configurar Supabase en este entorno.");
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="animate-rise mt-10 flex w-full flex-col gap-4"
      style={{ animationDelay: "100ms" }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold">Email</span>
        <input
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          className="w-full rounded-xl bg-field px-4 py-3.5 text-[14px] outline-none placeholder:text-muted focus:ring-1 focus:ring-ink/20"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold">Password</span>
        <input
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="w-full rounded-xl bg-field px-4 py-3.5 text-[14px] outline-none placeholder:text-muted focus:ring-1 focus:ring-ink/20"
        />
      </label>

      {error ? (
        <p role="alert" className="text-[12px] text-ink">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="caps mt-2 w-full cursor-pointer rounded-full bg-ink py-4 text-[12px] font-medium text-paper transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
      >
        {pending ? "Entering" : "Enter"}
      </button>
    </form>
  );
}
