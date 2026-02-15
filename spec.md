Especificación Técnica: Buscador Inmobiliario Privado "Burgos Home Finder"
1. Visión General

Desarrollo de una aplicación web personal y privada para monitorizar el mercado inmobiliario de Burgos Capital. El sistema debe automatizar el rastreo (scraping) diario de anuncios, permitir la visualización de datos en mapa y lista, y notificar cualquier novedad o cambio de precio.
2. Requisitos de Infraestructura (Stack "Coste 0€")

    Frontend & Hosting: Next.js (App Router) alojado en Vercel (Plan Hobby).

    Base de Datos: Supabase (PostgreSQL).

    Autenticación: Supabase Auth (Un solo usuario/contraseña compartido para el propietario y su pareja).

    Scraper: Node.js con Playwright + Playwright-extra (Stealth) ejecutado en GitHub Actions (Plan gratuito, repositorio privado).

    Notificaciones: Bot de Telegram (API gratuita) y Resend (Plan gratuito para emails).

    Mapas: Leaflet.js con tiles de OpenStreetMap (Sin cuotas ni APIs de pago).

3. El Motor de Scraping (GitHub Actions)

El script debe ejecutarse una vez al día (Cron job) y realizar los siguientes pasos:

    Consulta de Configuración: Conectarse a la tabla config_busqueda en Supabase para obtener los criterios actuales (Habitaciones, Baños, Metros, Garaje, Trastero).

    Ejecución de Scraping: Visitar Idealista, Fotocasa y Pisos.com simulando comportamiento humano (tiempos de espera, movimientos de ratón) para evitar bloqueos.

    Extracción de Datos:

        ID único del anuncio, Título, Precio, m², Nº de habitaciones, Nº de baños.

        Extras: Garaje (Sí/No), Trastero (Sí/No).

        Descripción completa del texto.

        Coordenadas aproximadas (Lat/Lng) y URL del anuncio.

        Galería de imágenes (URLs).

    Procesamiento de Datos:

        Nuevos: Insertar en la tabla pisos.

        Cambios de Precio: Si el ID existe y el precio es distinto, guardar el nuevo precio y registrar el anterior en la tabla historico_precios.

        Bajas: Si un piso guardado ya no aparece en el portal, marcar campo activo como false.

4. Base de Datos (Supabase)

Esquema simplificado:

    pisos: Datos principales, coordenadas, descripción y estado (activo/inactivo).

    historico_precios: Relación 1:N con pisos (fecha y precio).

    favoritos: Relación de IDs de pisos marcados por el usuario.

    config_busqueda: Fila única con los parámetros de filtrado (mínimos de m2, baños, habs, etc.).

5. Interfaz Web (Vercel)

La web debe ser privada (pantalla de login inicial) y constar de tres secciones principales:
A. Visualización de Resultados

    Modo Mapa: Pines en Burgos con Pop-ups que muestran foto, precio y link.

    Modo Lista/Muro: Tarjetas con foto grande y datos técnicos ordenables por precio (asc/desc) y fecha de entrada.

    Buscador Interno: Filtro de texto que busque palabras clave dentro del campo "Descripción" guardado en la DB.

    Acción: Botón para marcar/desmarcar como "Favorito".

B. Panel de Configuración (Dashboard)

Formulario para que el usuario modifique en tiempo real los criterios que usará el Scraper en su próxima ejecución:

    Mínimo de Habitaciones, Baños y Metros cuadrados.

    Checks obligatorios: Garaje y Trastero.

C. Sistema de Alertas

Al finalizar el scraping diario, el sistema enviará un mensaje por Telegram (vía Bot) y un Email si:

    Hay pisos nuevos que cumplan los filtros actuales.

    Un piso guardado ha bajado de precio (independientemente del importe).

6. Seguridad y Privacidad

    Acceso restringido mediante Middleware de Next.js para redirigir al Login si no hay sesión activa.

    Repositorio de código en GitHub configurado como Privado.