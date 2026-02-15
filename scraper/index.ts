/**
 * Script principal del scraper de pisos.
 * 
 * Flujo completo:
 * 1. Lee la configuración de búsqueda desde Supabase (config_busqueda)
 * 2. Construye la URL de búsqueda para Idealista
 * 3. Lanza el navegador con Playwright + Stealth
 * 4. Navega a la lista de resultados
 * 5. Itera sobre cada tarjeta de piso:
 *    - Extrae el HTML
 *    - Llama a parseProperty()
 *    - Llama a procesarPiso()
 * 6. Añade esperas aleatorias entre acciones
 * 7. Retorna un resumen de resultados
 */

import { chromium, Browser, Page } from 'playwright';
import { parseListPage } from './parser';
import { procesarPiso, ResultadoProcesamiento } from './dbService';
import { construirUrlIdealista, esperaAleatoria, logger } from './utils';
import { Tables } from '../lib/database.types';
import { SupabaseClient } from '@supabase/supabase-js';

type ConfigBusqueda = Tables<'config_busqueda'>;

/**
 * Resultado global de la ejecución del scraper.
 */
export interface ResultadoScraping {
    totalProcesados: number;
    nuevos: ResultadoProcesamiento[];
    cambiosPrecio: ResultadoProcesamiento[];
    sinCambios: number;
    errores: ResultadoProcesamiento[];
    fechaEjecucion: string;
}

/**
 * Obtiene la configuración de búsqueda desde Supabase.
 */
async function obtenerConfiguracion(client: SupabaseClient): Promise<ConfigBusqueda> {
    const { data, error } = await client
        .from('config_busqueda')
        .select('*')
        .limit(1)
        .single();

    if (error || !data) {
        throw new Error(`Error obteniendo configuración: ${error?.message || 'No se encontró config'}`);
    }

    return data;
}

/**
 * Configura y lanza el navegador con comportamiento stealth.
 */
async function lanzarNavegador(): Promise<Browser> {
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--window-size=1920,1080',
        ],
    });

    return browser;
}

/**
 * Configura la página del navegador con headers y propiedades anti-detección.
 */
async function configurarPagina(browser: Browser): Promise<Page> {
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'es-ES',
        timezoneId: 'Europe/Madrid',
    });

    const page = await context.newPage();

    // Ocultar que somos un bot
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'es', 'en'] });
    });

    return page;
}

/**
 * Extrae el HTML de todas las tarjetas de la página actual.
 */
async function extraerHTMLPagina(page: Page): Promise<string> {
    return await page.content();
}

/**
 * Ejecuta el proceso completo de scraping.
 * 
 * @param client - Cliente de Supabase (inyectable para testing)
 */
export async function ejecutarScraping(client: SupabaseClient): Promise<ResultadoScraping> {
    const resultado: ResultadoScraping = {
        totalProcesados: 0,
        nuevos: [],
        cambiosPrecio: [],
        sinCambios: 0,
        errores: [],
        fechaEjecucion: new Date().toISOString(),
    };

    let browser: Browser | null = null;

    try {
        // 1. Obtener configuración de búsqueda
        logger.info('Obteniendo configuración de búsqueda...');
        const config = await obtenerConfiguracion(client);
        logger.success('Configuración obtenida', {
            habitaciones: config.min_habitaciones,
            banos: config.min_banos,
            metros: config.min_metros,
            garaje: config.garaje,
            trastero: config.trastero,
        });

        // 2. Construir URL de búsqueda
        const url = construirUrlIdealista(config);
        logger.info(`URL de búsqueda: ${url}`);

        // 3. Lanzar navegador
        logger.info('Lanzando navegador...');
        browser = await lanzarNavegador();
        const page = await configurarPagina(browser);
        logger.success('Navegador lanzado correctamente');

        // 4. Navegar a la página de resultados
        logger.info('Navegando a la página de resultados...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await esperaAleatoria(3000, 6000);

        // Verificar si hay resultados
        const hayResultados = await page.$('article[data-adid]');
        if (!hayResultados) {
            logger.warn('No se encontraron resultados en la página. Posible bloqueo o sin resultados.');
            return resultado;
        }

        // 5. Extraer y parsear tarjetas de la página actual
        logger.info('Extrayendo tarjetas de pisos...');
        const htmlPagina = await extraerHTMLPagina(page);
        const baseUrl = 'https://www.idealista.com';
        const pisosParsed = parseListPage(htmlPagina, baseUrl);
        logger.info(`Se encontraron ${pisosParsed.length} tarjetas de pisos`);

        // 6. Procesar cada piso con esperas aleatorias
        for (let i = 0; i < pisosParsed.length; i++) {
            const piso = pisosParsed[i];

            try {
                logger.info(`Procesando piso ${i + 1}/${pisosParsed.length}: ${piso.titulo}`);

                const resultadoPiso = await procesarPiso(piso, client);
                resultado.totalProcesados++;

                switch (resultadoPiso.tipo) {
                    case 'NUEVO':
                        resultado.nuevos.push(resultadoPiso);
                        logger.success(`NUEVO: ${piso.titulo} - ${piso.precio}€`);
                        break;
                    case 'CAMBIO_PRECIO':
                        resultado.cambiosPrecio.push(resultadoPiso);
                        logger.info(`CAMBIO PRECIO: ${piso.titulo} - ${resultadoPiso.precioAnterior}€ → ${resultadoPiso.precioNuevo}€`);
                        break;
                    case 'SIN_CAMBIOS':
                        resultado.sinCambios++;
                        break;
                    case 'ERROR':
                        resultado.errores.push(resultadoPiso);
                        logger.error(`Error procesando ${piso.portal_id}: ${resultadoPiso.error}`);
                        break;
                }

                // Espera aleatoria entre procesamiento de pisos (human-like behavior)
                if (i < pisosParsed.length - 1) {
                    await esperaAleatoria(500, 1500);
                }
            } catch (error) {
                // Si falla un piso, loguear y continuar con el siguiente
                const mensaje = error instanceof Error ? error.message : 'Error desconocido';
                logger.error(`Error inesperado en piso ${piso.portal_id}: ${mensaje}`);
                resultado.errores.push({
                    tipo: 'ERROR',
                    portal_id: piso.portal_id,
                    error: mensaje,
                });
            }
        }

        // 7. Intentar navegar a la siguiente página (si existe)
        // TODO: Implementar paginación en futuras iteraciones

    } catch (error) {
        const mensaje = error instanceof Error ? error.message : 'Error desconocido';
        logger.error(`Error fatal en el scraping: ${mensaje}`);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            logger.info('Navegador cerrado');
        }
    }

    // Resumen final
    logger.info('═══════════════════════════════════');
    logger.info(`📊 RESUMEN DE EJECUCIÓN`);
    logger.info(`   Total procesados: ${resultado.totalProcesados}`);
    logger.info(`   Nuevos:           ${resultado.nuevos.length}`);
    logger.info(`   Cambios precio:   ${resultado.cambiosPrecio.length}`);
    logger.info(`   Sin cambios:      ${resultado.sinCambios}`);
    logger.info(`   Errores:          ${resultado.errores.length}`);
    logger.info('═══════════════════════════════════');

    return resultado;
}

/**
 * Punto de entrada cuando se ejecuta directamente (node scraper/index.ts)
 */
async function main() {
    logger.info('🏠 Iniciando Burgos Home Finder Scraper...');

    // Cargar cliente de Supabase (en producción, desde las env vars)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../lib/supabase');

    try {
        const resultado = await ejecutarScraping(supabase);

        if (resultado.nuevos.length > 0 || resultado.cambiosPrecio.length > 0) {
            logger.success('¡Se encontraron novedades! Listo para notificar.');
        } else {
            logger.info('No hay novedades. Todo igual que en la última ejecución.');
        }

        process.exit(0);
    } catch (error) {
        logger.error('El scraper falló de forma fatal', error);
        process.exit(1);
    }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
    main();
}
