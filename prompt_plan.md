Markdown

# Plan Maestro de Desarrollo: Burgos Home Finder

Este documento contiene la hoja de ruta paso a paso para construir el "Buscador Inmobiliario Privado". Está diseñado para ser alimentado a un LLM (como Claude 3.5 Sonnet o GPT-4o) de manera secuencial.

---

## 0. Instrucción Global (System Prompt)

**COPIA Y PEGA ESTO PRIMERO.** Define la personalidad y las reglas del asistente para toda la sesión.

```text
Actúa como un Arquitecto de Software Senior y Tech Lead experto en Next.js, Supabase y Automatización. Estamos construyendo "Burgos Home Finder", un sistema personal para monitorizar el mercado inmobiliario.

REGLAS INQUEBRANTABLES PARA ESTA SESIÓN:
1.  **Idioma:** Todas tus respuestas, explicaciones y comentarios en el código deben ser estrictamente en **Español**.
2.  **Uso de Herramientas MCP:**
    * Usa `mcp-context7` para leer y escribir la arquitectura del proyecto, asegurando que cada paso respete la estructura de archivos existente.
    * Usa `mcp-supabase` para validar esquemas, crear tablas y verificar conexiones a la base de datos real.
    * Usa `mcp-vercel` para gestionar configuraciones de despliegue y variables de entorno.
3.  **Desarrollo Iterativo:** No generes código "suelto". Cada pieza debe encajar con la anterior. Si detectas una inconsistencia en el plan, avísame antes de generar código.
4.  **Validación:** Antes de dar por concluido un paso, verifica (usando las herramientas) que los archivos o tablas se han creado correctamente.

Espera mi primer prompt para comenzar.

Fase 1: Cimientos y Datos
Prompt 1: Infraestructura y Esquema de Datos ✅ COMPLETADO

Objetivo: Configurar el proyecto Next.js y la Base de Datos en Supabase.

Markdown

Vamos a iniciar la Fase 1.

**Herramientas requeridas:** `mcp-context7` (estructura), `mcp-supabase` (DB).

**Tu tarea:**
1.  Inicializa la estructura mental de un proyecto Next.js 14+ (App Router) con TypeScript y Tailwind CSS.
2.  Utiliza `mcp-supabase` para generar y ejecutar el siguiente esquema SQL (asegúrate de aplicar Row Level Security - RLS):
    * `config_busqueda`: Tabla `singleton` (una sola fila permitida) con: `min_habitaciones` (int), `min_banos` (int), `min_metros` (int), `garaje` (bool), `trastero` (bool), `zona` (text array), `updated_at`.
    * `pisos`: `id` (uuid PK), `portal_id` (string unique, indexado), `titulo`, `precio` (numeric), `metros` (int), `habitaciones` (int), `banos` (int), `descripcion` (text), `url_anuncio` (text), `foto_principal` (text), `lat` (float), `lng` (float), `activo` (bool, default true), `created_at`, `updated_at`.
    * `historico_precios`: `id` (serial PK), `piso_id` (uuid FK a pisos), `precio` (numeric), `fecha_cambio` (timestamp default now).
    * `favoritos`: `id` (uuid PK), `piso_id` (uuid FK a pisos), `user_id` (uuid FK a auth.users).
3.  Genera el archivo de tipos TypeScript (`database.types.ts`) basado en este esquema.

**Entregable:** El SQL ejecutado, la estructura de carpetas inicial sugerida y los tipos TS.

Fase 2: Lógica del Scraper (Backend Puro)
Prompt 2: Parser HTML con TDD ✅ COMPLETADO

Objetivo: Crear la lógica de extracción de datos sin tocar el navegador aún.
Markdown

Pasamos a la Fase 2: El Cerebro del Scraper.

**Herramientas requeridas:** `mcp-context7` (para ver los tipos generados).

**Contexto:** Necesitamos convertir HTML crudo en objetos JSON limpios.
**Tu tarea:**
1.  Crea la carpeta `scraper/` en la raíz.
2.  Instala `cheerio` (para parseo) y `jest` (para testing).
3.  Crea el archivo `scraper/parser.ts`.
4.  **TDD Estricto:** Primero, crea `scraper/parser.test.ts`. Escribe un test que reciba un string HTML (mock de un anuncio típico de Idealista) y espere que la función devuelva un objeto con la interfaz `Piso` (parcial) que definimos antes.
5.  Implementa la función `parseProperty(html: string)` para que pase el test. Debe extraer: precio, metros, habitaciones, y detectar palabras clave "Garaje" o "Trastero" en la descripción.

**Nota:** Maneja los errores con gracia (ej: si no hay precio, devuelve 0 o null, no lances excepción).

Prompt 3: Servicio de Base de Datos (Upsert Logic) ✅ COMPLETADO

Objetivo: Lógica para detectar si un piso es nuevo o cambió de precio.
Markdown

Continuamos en la Fase 2. Ahora conectaremos el parser con la persistencia.

**Herramientas requeridas:** `mcp-supabase`.

**Tu tarea:**
1.  Crea el archivo `scraper/dbService.ts`.
2.  Implementa la función `procesarPiso(datos: Partial<Piso>)`.
3.  **Lógica de Negocio:**
    * Busca en la DB si existe el `portal_id`.
    * **Caso A (Nuevo):** Inserta en `pisos` y añade el precio actual a `historico_precios`.
    * **Caso B (Cambio de Precio):** Si existe y `precio` es diferente, actualiza la tabla `pisos` e inserta una nueva fila en `historico_precios`. Retorna "CAMBIO_PRECIO".
    * **Caso C (Sin Cambios):** Actualiza `updated_at` en `pisos`. Retorna "SIN_CAMBIOS".
4.  Escribe un test unitario (mockeando la llamada a Supabase) que cubra los 3 casos.

Prompt 4: Implementación de Playwright con Stealth ✅ COMPLETADO

Objetivo: Navegar la web real esquivando bloqueos básicos.
Markdown

Fase 3: El Navegador.

**Herramientas requeridas:** `mcp-context7` (estructura), `mcp-supabase` (config).

**Contexto:** Usaremos Playwright para obtener el HTML que procesará nuestra lógica anterior.
**Tu tarea:**
1.  Configura `playwright` y `puppeteer-extra-plugin-stealth` en el proyecto.
2.  Crea el script principal `scraper/index.ts`.
3.  Implementa el flujo completo:
    * Usa `mcp-supabase` (o el cliente supabase) para leer los filtros desde la tabla `config_busqueda`.
    * Construye la URL de búsqueda basada en esos filtros (usa un portal de ejemplo).
    * Lanza el navegador (headless: true) con el plugin Stealth.
    * Navega a la lista de resultados.
    * Itera sobre cada tarjeta de piso:
        * Extrae el HTML.
        * Llama a `parser.parseProperty`.
        * Llama a `dbService.procesarPiso`.
    * Añade esperas aleatorias (human-like behavior) de 2 a 5 segundos entre acciones.

**Importante:** El script debe ser robusto. Si falla una tarjeta, loguea el error y continúa con la siguiente.

                Prompt 5: Autenticación y Seguridad ✅ COMPLETADO

Objetivo: Proteger la aplicación.
Markdown

Fase 4: Frontend. Empezamos por la seguridad.

**Herramientas requeridas:** `mcp-vercel` (env vars), `mcp-supabase` (auth).

**Tu tarea:**
1.  Crea la página de Login en `app/login/page.tsx` (diseño limpio con Tailwind).
2.  Configura el Middleware de Next.js (`middleware.ts`) para proteger toda la ruta `/dashboard/*`.
3.  Si el usuario no tiene sesión activa, redirige a `/login`.
4.  Asegúrate de configurar correctamente las variables de entorno para el cliente de Supabase (SSR y Client side).

Prompt 6: Dashboard y Visualización (Lista y Mapa) ✅ COMPLETADO

Objetivo: Ver los datos recolectados.
Markdown

Fase 4: Visualización de Datos.

**Herramientas requeridas:** `mcp-context7` (estilos).

**Tu tarea:**
1.  Crea la página `app/dashboard/pisos/page.tsx`.
2.  **Vista de Lista:** Crea un componente `GridPisos` que reciba los datos de Supabase. Tarjetas con foto, precio grande y badges para habs/baños.
3.  **Vista de Mapa:** Implementa un componente `MapaPisos` usando `react-leaflet`.
    * **Nota Técnica:** Recuerda usar `next/dynamic` con `ssr: false` para importar Leaflet, ya que no funciona en el servidor.
    * Pinta pines en las coordenadas (`lat`, `lng`) de los pisos.
4.  Añade un botón para editar la configuración (conecta con `config_busqueda` mediante una Server Action).

Fase 5: Automatización (CI/CD)
Prompt 7: Notificaciones y GitHub Actions ✅ COMPLETADO

Objetivo: Automatizar la ejecución diaria y las alertas.
Markdown

Fase Final: Automatización.

**Herramientas requeridas:** `mcp-vercel` (secrets check).

**Tu tarea:**
1.  **Notificador:** Crea `scraper/notificador.ts`.
    * Debe recibir arrays de `nuevosPisos` y `bajadasPrecio`.
    * Usa `node-telegram-bot-api` para enviar un mensaje al canal configurado.
    * Usa `resend` para enviar un email resumen.
2.  **Integración:** Modifica `scraper/index.ts` para acumular los cambios y llamar al `notificador` al final de la ejecución.
3.  **Workflow:** Genera el archivo `.github/workflows/diario.yml`.
    * Schedule: `0 9,20 * * *` (9:00 y 20:00).
    * Steps: Checkout -> Setup Node -> Install Deps (con caché) -> Install Playwright Browsers -> Run Scraper.
    * Define qué `Secrets` necesito configurar en GitHub (SUPABASE_URL, TELEGRAM_TOKEN, etc.).