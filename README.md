# THIRD EYE

Portfolio de fotografía en `app.santiagofuenmayorruiz.com`. Galería pública,
subida privada desde el móvil, y un pipeline que comprime cada foto en el
navegador antes de que toque el servidor.

Proyecto independiente del portfolio personal: no comparte código, layout ni
proyecto de Vercel. Solo el dominio.

---

## Stack

| Pieza | Elección |
| --- | --- |
| Framework | Next.js 16.2.10 (App Router, `src/app`, Turbopack) |
| UI | React 19.2.4 + Tailwind v4 |
| Datos | Supabase Postgres (tabla `photos`) |
| Archivos | Supabase Storage (bucket público `photos`) |
| Auth | Supabase Auth, una sola cuenta (la tuya) |
| Hosting | Vercel, proyecto propio con subdominio |

## Pantallas

| Ruta | Qué es | Acceso |
| --- | --- | --- |
| `/` | Galería: logo, claim y retícula de fotos con su localización. Click abre el visor a pantalla completa. | Pública (prerenderizada, revalida cada 5 min) |
| `/login` | Email + contraseña. | Pública |
| `/upload` | Selección de fotos, campo `Location, Country`, `PUBLISH` y pantalla de confirmación. | Solo con sesión |

Con sesión iniciada aparecen además el botón `UPLOAD` flotante en la galería y
un `Delete` sobre cada foto.

---

## Puesta en marcha

### 1. Crear el proyecto de Supabase

Uno nuevo y dedicado (dashboard de Supabase → New project). Región Europa
(`eu-west-3` o `eu-central-1`) para tener menos latencia desde España.

### 2. Crear tabla, bucket y políticas

Supabase Dashboard → **SQL Editor** → pega [`supabase/schema.sql`](supabase/schema.sql)
entero y ejecútalo. Crea:

- la tabla `public.photos` con RLS: lectura pública, escritura solo del dueño;
- el bucket `photos` (público, límite de 15 MB por archivo, solo `image/webp` y
  `image/jpeg`);
- las políticas de `storage.objects`: lectura anónima, subida y borrado solo con
  sesión.

Es idempotente: puedes volver a ejecutarlo cuando quieras.

### 3. Crear tu usuario y cerrar el registro

1. **Authentication → Users → Add user**: tu email y una contraseña. Marca
   *Auto Confirm User*.
2. **Authentication → Sign In / Providers → Email**: desactiva **Allow new users
   to sign up**. Sin esto, cualquiera podría registrarse y subir fotos.

### 4. Variables de entorno

```bash
cp .env.example .env.local
```

Rellena con **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

La `anon key` es pública por diseño: quien manda es RLS.

### 5. Arrancar

```bash
npm install
npm run dev
```

`http://localhost:3000` para la galería, `/login` para entrar y `/upload` para
publicar.

---

## Despliegue en Vercel

1. Sube el repo a GitHub y **Add New → Project** en Vercel. Next.js se detecta
   solo; no hace falta tocar el build.
2. **Settings → Environment Variables**: las tres de arriba, con
   `NEXT_PUBLIC_SITE_URL=https://app.santiagofuenmayorruiz.com`.
3. **Settings → Domains → Add**: `app.santiagofuenmayorruiz.com`.
   - Si `santiagofuenmayorruiz.com` ya está en la misma cuenta de Vercel, el
     subdominio se configura solo.
   - Si el DNS está en otro sitio, añade el registro que te indique Vercel
     (normalmente `CNAME app → cname.vercel-dns.com`).
4. En Supabase → **Authentication → URL Configuration**, pon
   `https://app.santiagofuenmayorruiz.com` como *Site URL*.

El portfolio personal no se toca en ningún momento.

---

## Cómo se gestiona el peso de las imágenes

Todo el trabajo pesado ocurre en el navegador, antes de subir
([`src/lib/image.ts`](src/lib/image.ts)):

1. Se decodifica el archivo aplicando la orientación EXIF.
2. Se reduce en pasos de mitad de tamaño (evita el aliasing de un único
   `drawImage`) hasta dos versiones:
   - **full**: lado mayor 2000 px, WebP calidad 0.80 → la del visor.
   - **thumb**: lado mayor 800 px, WebP calidad 0.72 → la de la retícula.
3. Se genera un placeholder borroso de 12 px como data URL (~0,8 KB) que viaja
   en el HTML y evita el salto de layout mientras carga la foto.
4. Se suben las dos versiones a Storage con `Cache-Control` de un año, y solo
   entonces se guardan los metadatos en Postgres.

Medido con fotos de 4032×3024 (2,2 MB de origen): **518 KB** la versión grande y
**75 KB** la miniatura, en ~0,6 s por foto. Una foto típica ronda los 300 KB en
total, así que el 1 GB gratuito de Supabase da para unas 2.000.

Dos consecuencias más:

- Repintar en un canvas **elimina los metadatos EXIF**, incluida la
  geolocalización del móvil. La localización que se publica es solo la que
  escribes a mano.
- Como las fotos ya llegan optimizadas, `next.config.ts` marca
  `images.unoptimized: true`: se sirven tal cual desde el CDN de Supabase y no
  consumen cuota de transformaciones de Vercel. `<Image>` sigue dando lazy-load,
  blur y reserva de espacio.

Si un día quieres que Vercel las reprocese, pon `unoptimized: false`: los
`remotePatterns` del host de Supabase ya están configurados.

---

## Decisiones de diseño

**La galería no lee cookies.** `getPhotos()` usa un cliente de Supabase anónimo
y sin sesión ([`src/lib/supabase/public.ts`](src/lib/supabase/public.ts)), así
que `/` se prerenderiza y se sirve desde el CDN. Los controles de dueño se
deciden en cliente con [`useIsOwner()`](src/lib/use-owner.ts), sobre HTML que es
idéntico para todo el mundo. Al subir o borrar, `revalidatePath("/")` refresca
la página al instante.

**El login se hace desde el navegador.** Es el comportamiento por defecto de
`@supabase/ssr`: la cookie de sesión la escribe el cliente y la lee el servidor.
A cambio de no ser `httpOnly`, permite que la galería siga siendo cacheable.

**`proxy.ts`, no `middleware.ts`.** En Next.js 16 el middleware pasó a llamarse
proxy. Solo corre en `/upload` y `/login`, y `/upload` vuelve a comprobar la
sesión en el servidor por si el matcher cambia.

**Las server actions verifican sesión.** Son endpoints POST públicos, así que
[`src/app/actions.ts`](src/app/actions.ts) comprueba el usuario y valida las
rutas de Storage además de lo que ya impone RLS.

**Si Supabase falla, la galería se queda vacía**, no rota: `getPhotos()` atrapa
el error y devuelve una lista vacía (dejando pasar los errores internos de
Next).

---

## Estructura

```
src/
├─ app/
│  ├─ actions.ts          # server actions: crear, borrar, limpiar huérfanos
│  ├─ layout.tsx          # fuente, metadatos, tema claro
│  ├─ page.tsx            # galería pública (ISR 5 min)
│  ├─ login/              # formulario de acceso
│  └─ upload/             # subida + confirmación
├─ components/            # logo, cabecera, retícula, visor, barra de dueño
├─ lib/
│  ├─ image.ts            # redimensionado y compresión en el navegador
│  ├─ photos.ts           # consultas y helpers de la galería
│  ├─ use-owner.ts        # ¿hay sesión en este navegador?
│  └─ supabase/           # clientes: navegador, servidor y anónimo
└─ proxy.ts               # refresco de sesión + guardia de /upload

supabase/schema.sql       # tabla, bucket y políticas RLS
```

## Scripts

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```
