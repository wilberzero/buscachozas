/**
 * Script principal del scraper de pisos.
 * 
 * Flujo completo:
 * 1. Lee la configuración de búsqueda desde Supabase
 * 2. Construye URL de Idealista
 * 3. ESTRATEGIA HÍBRIDA:
 *    - Si existe ZENROWS_API_KEY: Usa proxy API (ZenRows/ScraperAPI) para obtener HTML sin bloqueo.
 *    - Si NO existe (Local): Lanza Playwright con Stealth Plugin.
 * 4. Parsea el HTML obtenido
 * 5. Procesa los pisos y guarda en DB
 * 6. Notifica novedades
 */

// Cargar variables de entorno si estamos en local
if (!process.env.CI) {
    try {
        require('dotenv').config({ path: '.env.local' });
        require('dotenv').config();
    } catch (e) {
        // Ignorar
    }
}

import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'playwright';
import { parseListPage } from './parser';
import { procesarPiso, ResultadoProcesamiento } from './dbService';
import { construirUrlIdealista, esperaAleatoria, logger } from './utils';
import { notificar } from './notificador';
import { Tables } from '../lib/database.types';
import { SupabaseClient } from '@supabase/supabase-js';
import { logInicioScraper, logFinScraper } from './logService';
import { fetchHtmlViaProxy } from './proxyService';

// Activar plugin stealth
chromium.use(stealthPlugin());

type ConfigBusqueda = Tables<'config_busqueda'>;

export interface ResultadoScraping {
    totalProcesados: number;
    nuevos: ResultadoProcesamiento[];
    cambiosPrecio: ResultadoProcesamiento[];
    sinCambios: number;
    errores: ResultadoProcesamiento[];
    fechaEjecucion: string;
}

async function obtenerConfiguracion(client: SupabaseClient): Promise<ConfigBusqueda> {
    const { data, error } = await client.from('config_busqueda').select('*').limit(1).single();
    if (error || !data) throw new Error(`Error config: ${error?.message}`);
    return data;
}

// --- Funciones Playwright (Fallback Local) ---

async function lanzarNavegador(): Promise<Browser> {
    return await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars', '--window-size=1920,1080',
            '--start-maximized',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
    });
}

async function configurarPagina(browser: Browser): Promise<Page> {
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'es-ES', timezoneId: 'Europe/Madrid',
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        // @ts-ignore
        window.navigator.chrome = { runtime: {} };
    });
    return page;
}

// --- Logica Principal ---

export async function ejecutarScraping(client: SupabaseClient): Promise<ResultadoScraping> {
    const resultado: ResultadoScraping = {
        totalProcesados: 0, nuevos: [], cambiosPrecio: [], sinCambios: 0, errores: [],
        fechaEjecucion: new Date().toISOString(),
    };

    let browser: Browser | null = null;
    let htmlPagina = '';

    try {
        // 1. Configuración y URL
        const config = await obtenerConfiguracion(client);
        const url = construirUrlIdealista(config);
        logger.info(`🔍 URL Objetivo: ${url}`);

        // 2. Obtención del HTML (Híbrido)
        if (process.env.ZENROWS_API_KEY) {
            // ESTRATEGIA A: API PROXY (Producción / Evasión)
            logger.info('🚀 Modo: API Proxy (ZenRows)');
            try {
                htmlPagina = await fetchHtmlViaProxy(url);
            } catch (proxyError) {
                logger.error('Fallo en Proxy API', proxyError);
                throw proxyError; // Si falla el proxy, fallamos. No hacemos fallback automático en producción para no quemar IP.
            }
        } else {
            // ESTRATEGIA B: PLAYWRIGHT LOCAL (Fallback)
            logger.info('💻 Modo: Playwright Local (Sin API Key)');
            browser = await lanzarNavegador();
            const page = await configurarPagina(browser);

            logger.info('Navegando...');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await esperaAleatoria(2000, 4000);

            // Verificar bloqueo/vacío
            const hayResultados = await page.$('article[data-adid]');
            if (!hayResultados) {
                logger.warn('⚠️ No se encontraron resultados (Playwright). Posible bloqueo.');
                await page.screenshot({ path: 'debug_no_results.png', fullPage: true });
                return resultado;
            }

            htmlPagina = await page.content();
        }

        // 3. Parsing
        if (!htmlPagina) {
            throw new Error('No se pudo obtener HTML válido');
        }

        const baseUrl = 'https://www.idealista.com';
        const pisosParsed = parseListPage(htmlPagina, baseUrl);
        logger.info(`📦 Se encontraron ${pisosParsed.length} tarjetas de pisos`);

        // 4. Procesamiento
        for (const piso of pisosParsed) {
            try {
                const res = await procesarPiso(piso, client);
                resultado.totalProcesados++;

                if (res.tipo === 'NUEVO') resultado.nuevos.push(res);
                else if (res.tipo === 'CAMBIO_PRECIO') resultado.cambiosPrecio.push(res);
                else if (res.tipo === 'SIN_CAMBIOS') resultado.sinCambios++;
                else resultado.errores.push(res);

            } catch (e) {
                logger.error(`Error procesando piso ${piso.portal_id}`, e);
            }
        }

    } catch (error) {
        logger.error('❌ Error fatal en scraping', error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }

    // Resumen
    logger.info(`📊 Resumen: ${resultado.totalProcesados} procesados. ${resultado.nuevos.length} nuevos.`);
    return resultado;
}

// --- Entry Point ---

async function main() {
    logger.info('🏠 Iniciando Burgos Home Finder Scraper...');
    const { supabaseAdmin } = require('./supabaseAdmin');
    const logId = await logInicioScraper(supabaseAdmin);

    try {
        const resultado = await ejecutarScraping(supabaseAdmin);

        if (resultado.nuevos.length > 0 || resultado.cambiosPrecio.length > 0) {
            await notificar(resultado.nuevos, resultado.cambiosPrecio);
        }

        await logFinScraper(supabaseAdmin, logId!, {
            status: 'success',
            pisos_encontrados: resultado.totalProcesados,
            pisos_nuevos: resultado.nuevos.length,
            pisos_actualizados: resultado.cambiosPrecio.length,
        });
        logger.success('✅ Ejecución finalizada con éxito');
        process.exit(0);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await logFinScraper(supabaseAdmin, logId!, { status: 'error', error_message: msg });
        process.exit(1);
    }
}

if (require.main === module) main();
