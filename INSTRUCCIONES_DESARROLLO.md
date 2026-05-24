# Guía de Desarrollo y Despliegue - BuscaChozas v2

Esta guía documenta la arquitectura técnica del proyecto, los accesos, y el flujo de trabajo (incluyendo trucos de red/Git) para continuar el desarrollo de forma fluida.

---

## 📡 Conexión por SSH a la Raspberry Pi
- **Dirección IP Local:** `192.168.1.161`
- **Dirección IP Tailscale:** `100.79.154.89`
- **Usuario:** `adminpi`
- **Autenticación:** Llave SSH autorizada.
- **Ruta del Proyecto:** `/home/adminpi/antigravity-data/proyectos/buscapisos_v2`

---

## 🐳 Entorno Docker y Ejecución del Scraper
- **Contenedor:** `antigravity_web` (ejecuta Webtop Ubuntu-XFCE en los puertos `3000`/`3001` de la Pi).
- **Mapeo:** La carpeta `/home/adminpi/antigravity-data` del host está montada en `/config` dentro del contenedor.
- **Frecuencia del Scraper:** 
  - Se ejecuta **todos los días a las 08:00 CEST** (8:00 AM hora local española) mediante la tarea cron del contenedor.
  - **Crontab (dentro del contenedor):**
    `00 08 * * * /lsiopy/bin/python3 /config/proyectos/buscapisos_v2/buscapisos_v3_supabase.py >> /config/proyectos/buscapisos_v2/scraper.log 2>&1`
- **Ejecución Manual:**
  Para forzar la ejecución del scraper en cualquier momento, ejecuta en la terminal de la Raspberry Pi:
  ```bash
  docker exec antigravity_web /lsiopy/bin/python3 /config/proyectos/buscapisos_v2/buscapisos_v3_supabase.py
  ```
- **Ficheros de Log:**
  - Registro de ejecuciones del scraper: `/home/adminpi/antigravity-data/proyectos/buscapisos_v2/scraper.log`

---

## ⚙️ Compilación Local de Next.js (Raspberry Pi Host)
La Raspberry Pi tiene un Node.js (v24.14.0) installed. Para probar y asegurar la compilación del frontend antes de desplegar, añade el path de Node y corre el build:
```bash
export PATH=$PATH:/home/adminpi/antigravity-data/.nvm/versions/node/v24.14.0/bin
cd /home/adminpi/antigravity-data/proyectos/buscapisos_v2/web
npm run build
```
*(Nota: El build está optimizado y libre de bloqueos de red gracias a la eliminación del fetching de Google Fonts).*

---

## 🪄 La "Triquiñuela" de Despliegue en Git y Vercel
### El Desafío
1. El repositorio en la Raspberry Pi está clonado mediante **HTTPS**, requiriendo credenciales manuales para cada `git push`.
2. La Raspberry Pi tiene ocasionalmente restricciones de MTU/DNS sobre Tailscale que provocan bloqueos y timeouts de descarga con `registry.npmjs.org` o resoluciones de dominios, impidiendo el uso de comandos remotos como `vercel deploy` o pushes directos cómodos.

### La Solución (Flujo de Despliegue)
Para realizar modificaciones de forma segura y subirlas a producción en Vercel (la cual se redespliega automáticamente con cada push a `main`), sigue este pipeline:

1. **Desarrollar y probar en la Raspberry Pi:**
   Realiza y edita los ficheros directamente en la Pi. Haz las pruebas de ejecución local y verifica la compilación usando `npm run build` en el host.
2. **Clonar de forma temporal en tu máquina de Windows:**
   Dado que tu Windows tiene perfectas credenciales cacheadas por el Administrador de Credenciales y una red libre de timeouts, clona de manera temporal en una carpeta:
   ```bash
   git clone https://github.com/wilberzero/buscachozas.git C:\Users\wilber\.gemini\antigravity\scratch\temp_deploy
   ```
3. **Copiar los archivos modificados desde la Raspberry Pi (o desde tu scratch):**
   Copia los ficheros editados (por ejemplo, `ClientDashboard.tsx`, `buscapisos_v3_supabase.py`) desde tu directorio local o descargándolos de la Pi usando `scp` hacia la carpeta del clon temporal.
4. **Hacer commit y push desde Windows:**
   ```bash
   cd C:\Users\wilber\.gemini\antigravity\scratch\temp_deploy
   git add .
   git commit -m "feat: [descripción de tu mejora]"
   git push origin main
   ```
   *Vercel detectará el push al instante y desplegará la web en producción en menos de 60 segundos.*
5. **Sincronizar el repositorio de la Raspberry Pi:**
   Para que la Raspberry Pi no quede desactualizada ni con conflictos, accede por SSH y ejecuta:
   ```bash
   cd /home/adminpi/antigravity-data/proyectos/buscapisos_v2
   git fetch && git reset --hard origin/main
   ```
6. **Limpiar:**
   Elimina la carpeta temporal `temp_deploy` de Windows para mantener tu espacio de trabajo ordenado.

---

## 📈 Historial de Versiones de la Web
- **`v1.0.16`:** Ajustes visuales, modal de ajustes scrollable y mejoras de iconos.
- **`v1.1.0`:** 
  - Conexión SMTP corregida con fallbacks automáticos para nulos.
  - Implementación del **Listado de Bajas** (viviendas inactivas).
  - Creación del panel de **Estadísticas de Mercado** con gráficos interactivos de Recharts (barrios y precio por m²).
  - Eliminación del bloqueo de compilación por Google Fonts.
- **`v1.2.0` (Actual):**
  - **Ordenación del listado principal:** Filtro dropdown por Precio, Habitaciones y Superficie (menor a mayor y viceversa).
  - **Tendencia Histórica de Precios:** Gráfico interactivo de línea mostrando la evolución del precio promedio de las viviendas activas.
  - **Tendencia Histórica de Suelo (€/m²):** Gráfico interactivo de línea mostrando el comportamiento del valor medio del m² en Burgos.
  - Enlaces de redirección directa a Idealista desde las oportunidades de estadísticas.
