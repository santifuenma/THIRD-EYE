# THIRD EYE

Portfolio de fotografía en `thirdeye.santiagofuenmayorruiz.com`. Galería pública,
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
| Archivos | Supabase Storage (bucket público `photos`, una versión por foto) |
| Auth | Supabase Auth, una sola cuenta (la tuya) |
| Hosting | Vercel, proyecto propio con subdominio |

## Pantallas

| Ruta | Qué es | Acceso |
| --- | --- | --- |
| `/` | Galería: logo, claim y mosaico de fotos con su localización y fecha. Click abre el visor a pantalla completa. | Pública (prerenderizada, revalida cada 5 min) |
| `/login` | Email + contraseña. | Pública, sin enlaces entrantes |
| `/upload` | Selección de fotos, campos `Location, Country` y `Date taken`, `PUBLISH` y pantalla de confirmación. | Solo con sesión |

**El acceso a la zona privada está escondido.** La galería no enseña ningún
enlace de admin: tres clicks seguidos sobre el logo de la home (con menos de
0,8 s entre uno y otro) llevan a `/login`, o directamente a `/upload` si ya hay
sesión. Clicks sueltos o espaciados no hacen nada.

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
   `NEXT_PUBLIC_SITE_URL=https://thirdeye.santiagofuenmayorruiz.com`.
3. **Settings → Domains → Add**: `thirdeye.santiagofuenmayorruiz.com`.
   - Si `santiagofuenmayorruiz.com` ya está en la misma cuenta de Vercel, el
     subdominio se configura solo.
   - Si el DNS está en otro sitio, añade el registro que te indique Vercel
     (normalmente `CNAME thirdeye → cname.vercel-dns.com`).
4. En Supabase → **Authentication → URL Configuration**, pon
   `https://thirdeye.santiagofuenmayorruiz.com` como *Site URL*.

El portfolio personal no se toca en ningún momento.

---

## Cómo se gestiona el peso de las imágenes

**Una sola versión por foto.** Al subir, el navegador la redimensiona a 3000 px
de lado mayor y la recomprime a WebP calidad 0.85
([`src/lib/image.ts`](src/lib/image.ts)):

1. Se decodifica el archivo aplicando la orientación EXIF.
2. Se reduce en pasos de mitad de tamaño — un único `drawImage` con un factor
   de reducción grande deja la imagen con aliasing.
3. Se genera un placeholder borroso de 12 px como data URL (~0,8 KB) que viaja
   en el HTML y evita el salto de layout mientras carga la foto.
4. Se sube a Storage con `Cache-Control` de un año, y solo entonces se guardan
   los metadatos en Postgres.

Medido: una vertical de 2250×4000 queda en 1688×3000 y 164 KB; una horizontal
de 4032×3024 queda en 3000×2250 y 429 KB, en algo más de medio segundo. Con
fotos de cámara y mucho detalle espera entre 400 KB y 1 MB, así que el 1 GB
gratuito de Supabase da para unas mil.

**Los tamaños de entrega los genera Vercel.** `next/image` pide a la
optimización de Vercel exactamente los píxeles que necesita cada pantalla y los
sirve en AVIF: la retícula de un móvil recibe ~1080 px de ancho, una tesela de
escritorio ~640, el visor a pantalla completa hasta 2048. Por eso no se guarda
una miniatura aparte — sería una copia peor de algo que Vercel ya sabe hacer, y
limitaría la calidad de la retícula.

El plan Hobby incluye del orden de mil imágenes fuente al mes, contadas una vez
por foto sin importar cuántos tamaños se deriven de ella; un portfolio personal
se queda en decenas. Si algún día estorba, `images.unoptimized: true` en
[`next.config.ts`](next.config.ts) desactiva todo esto y sirve los originales
tal cual.

Un efecto secundario que conviene conocer: repintar en un canvas **elimina los
metadatos EXIF**, incluida la geolocalización del móvil. La localización que se
publica es solo la que escribes a mano.

## La fecha

El campo `Date taken` se rellena solo: al elegir la foto se le lee el EXIF
([`src/lib/exif.ts`](src/lib/exif.ts), un lector mínimo de unas cien líneas sin
dependencias) y se saca `DateTimeOriginal`. Tiene que pasar antes del procesado,
porque el canvas se lleva los metadatos por delante.

Si el archivo no trae fecha —un PNG, una captura, un HEIC— el campo se queda
vacío y la eliges tú. Encima de la caja hay un `<input type="date">`
transparente: aporta el selector nativo (en el móvil, la ruleta) mientras la
caja de debajo mantiene el formato de la marca, que el navegador no deja
personalizar.

La fecha se guarda como `date` (sin hora ni huso) y se formatea partiendo la
cadena a mano en [`src/lib/dates.ts`](src/lib/dates.ts): un `new Date("2026-09-12")`
se interpreta como UTC y en husos negativos mostraría el día 11.

Una tanda de subida comparte localización y fecha. Si las fotos son de días
distintos, súbelas por separado.

## El mosaico

Las fotos se muestran a su proporción original, sin recortes, en un mosaico de
columnas CSS (`columns-*` con `break-inside-avoid`). Una retícula por filas
dejaría huecos irregulares cada vez que una horizontal y una vertical comparten
fila. El precio es que las columnas se leen de arriba abajo, no de izquierda a
derecha.

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
scripts/build-logo.mjs    # public/logo.svg -> componente + favicon
```

## Scripts

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run logo       # regenera el logo desde public/logo.svg
```

## Cambiar el logo

El logo va embebido en el JSX para que herede el color del texto y no cueste una
petición extra, así que editar el SVG no basta por sí solo:

1. Sustituye [`public/logo.svg`](public/logo.svg).
2. `npm run logo` — regenera `src/components/logo.tsx` y el favicon
   `src/app/icon.svg`.

El componente calcula el alto a partir del `viewBox`, así que un SVG con otra
proporción no se deforma. Nunca edites `logo.tsx` a mano: el script lo pisa.
