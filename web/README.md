# Ruido Ambiental — versión web

Versión en línea de la aplicación de escritorio de procesamiento de ruido ambiental
(Res. 0627 de 2006). Es una herramienta **interna**: los usuarios de la empresa
entran con correo y contraseña, y los proyectos, memorias e informes quedan
guardados en la nube.

Los cálculos, gráficas, mapas de isófonas y el informe Word los sigue haciendo
**el mismo código Python de la aplicación de escritorio** (`core/`), publicado
como una API (el "motor", carpeta `engine/`). Así los resultados son idénticos
a los del `.exe`.

## Arquitectura

```
Navegador ──► App web Next.js (Vercel) ──► Motor Python FastAPI (Render / Railway / VPS)
   │                 │                              │
   │                 ├─► PostgreSQL (Supabase)      │
   └─ subida directa ┴─► Almacenamiento S3 ◄────────┘ descarga con URL firmada
                         (Supabase Storage)
```

| Componente | Tecnología |
| --- | --- |
| Interfaz y API | Next.js 16 (App Router), Tailwind CSS 4, shadcn/ui |
| Base de datos | PostgreSQL (Supabase) + Drizzle ORM (migraciones en `drizzle/`) |
| Archivos | S3 compatible (Supabase Storage, Cloudflare R2, AWS S3) — bucket privado |
| Autenticación | Auth.js v5 (correo + contraseña) |
| Motor de cálculo | FastAPI + `core/` (Python), en Docker (`Dockerfile` en la raíz del repo) |

- Los archivos se suben **directo del navegador al bucket** con URLs firmadas; el
  servidor verifica después el tamaño y la firma binaria (xlsx/docx/jpg/png) y
  borra lo que no sea válido.
- El motor no guarda nada: recibe el proyecto con URLs firmadas de corta duración,
  descarga las memorias en una carpeta temporal y devuelve el resultado.
- El navegador nunca habla con el motor: solo el servidor web, con la clave
  `ENGINE_API_KEY`.

## Uso

1. **Proyecto y puntos**: datos del proyecto y puntos de monitoreo (sector de la
   Res. 0627, incertidumbre, coordenadas Origen Nacional, altitud, foto, descripción).
   Opcionalmente, el **archivo de la estación meteorológica** (.xlsx exportado de
   WeatherLink u otro, con fecha/hora, temperatura, humedad, presión, viento y
   lluvia): al generar el Word se usan solo los registros de los días de medición
   para completar el capítulo de meteorología (tabla de promedios diarios, textos,
   gráficas y rosa de vientos). Las filas con valores imposibles se descartan con
   una advertencia.
   **Datos del informe** (área de estudio, municipio, título de portada,
   expediente, versión, fecha y datos del cliente) y, en cada punto, las
   **fuentes de ruido percibidas**: con ellos y los resultados el Word sale
   redactado — portada, encabezado, cuadro de control, resumen, objetivos,
   información del cliente, tabla de la Res. 0627 con el sector resaltado,
   fuentes de ruido, análisis por jornada y conclusiones — junto con el mapa de
   localización de los puntos. Word actualiza los índices al abrir el archivo.
2. **Memorias del sonómetro**: una tabla por punto con las 4 jornadas × 5
   direcciones. «Subir las 5» permite elegir varios `.xlsx` a la vez; la dirección
   se reconoce por el nombre del archivo (`RA1_Norte.xlsx`, `RA1_N.xlsx`…).
3. **Resultados e informes**: «Procesar proyecto» muestra la comparación con la
   norma, las advertencias, los equipos detectados y el detalle de correcciones.
   Luego se generan el **Informe Word**, el **Excel de resultados** y el **ZIP de
   gráficas e isófonas** (PNG + PDF); quedan en un historial descargable.

Además: **Equipos** (inventario de sonómetros por serial), **Usuarios** y
**Ajustes** (plantilla Word propia, firmas del cuadro de control y texto «Elaboró» de los planos) para los
administradores. Solo los administradores pueden eliminar proyectos y equipos.
El primer acceso abre `/setup` para crear el administrador.

## Desarrollo local

Requisitos: Node 22, Python 3.11+, PostgreSQL.

```bash
# 1) Motor (desde la raíz del repositorio)
pip install -r engine/requirements.txt
ENGINE_API_KEY=dev-engine-key uvicorn engine.app:app --port 8000

# 2) Web
cd web
npm install
cp .env.example .env        # DATABASE_URL, AUTH_SECRET, ENGINE_API_KEY=dev-engine-key
npm run db:migrate
npm run dev                 # http://localhost:3000
```

Con `STORAGE_DRIVER=local` los archivos se guardan en `web/.uploads/`.

Pruebas:

```bash
python -m pytest tests engine/tests      # cálculo + API del motor
cd web && npm run lint && npm run typecheck && npm test
```

## Puesta en producción

### 1. Supabase (base de datos + archivos)

1. Cree un proyecto en [supabase.com](https://supabase.com).
2. **Base de datos**: en *Connect*, copie la cadena del **Transaction pooler**
   (puerto 6543) → `DATABASE_URL`. Aplique las migraciones una vez desde su
   equipo: `cd web && DATABASE_URL=... npm run db:migrate`.
3. **Storage**: cree un bucket **privado** (p. ej. `ruido`). En *Storage →
   Settings → S3 Connection* active el acceso S3, copie el *Endpoint* y la
   *Region* y cree un par de claves de acceso → `S3_ENDPOINT`, `S3_REGION`,
   `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET=ruido`,
   `S3_FORCE_PATH_STYLE=true`.

### 2. Motor Python (Render, Railway o un VPS con Docker)

El `Dockerfile` de la raíz del repositorio construye el motor.

En **Render**: *New → Web Service* → este repositorio → *Runtime: Docker*
(raíz del repo) → variable `ENGINE_API_KEY` (genere una con
`openssl rand -hex 32`). Health check: `/health`. El plan gratuito se
"duerme" tras 15 min sin uso (la primera petición tarda ~1 min); para uso diario
conviene el plan *Starter*.

En un **VPS**: `docker build -t ruido-engine . && docker run -d -p 8000:8000 -e ENGINE_API_KEY=... ruido-engine`
(detrás de HTTPS, p. ej. con Caddy o Nginx).

El motor necesita salida a internet para descargar las imágenes satelitales de
los mapas de isófonas (Esri World Imagery). `ENGINE_BASEMAP=0` las desactiva.

### 3. App web (Vercel)

*Add New → Project* → este repositorio → **Root Directory: `web`**. Variables de
entorno: todas las de `.env.example` con `STORAGE_DRIVER=s3`,
`APP_URL=https://<su-proyecto>.vercel.app`, `AUTH_SECRET` nuevo,
`ENGINE_URL=https://<su-motor>.onrender.com` y la misma `ENGINE_API_KEY` del motor.

Las rutas que llaman al motor tienen `maxDuration = 300` s (el informe Word con
4 mapas de isófonas tarda normalmente de 30 s a 2 min).

Al abrir la URL por primera vez se muestra la pantalla de configuración inicial
para crear el administrador (y se carga el inventario de equipos de `equipos.json`).
