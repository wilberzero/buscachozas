/**
 * Utilidades para el scraper:
 * - Esperas aleatorias para simular comportamiento humano
 * - Construcción de URLs de búsqueda
 * - Logging
 */

import { Tables } from '../lib/database.types';

type ConfigBusqueda = Tables<'config_busqueda'>;

/**
 * Espera un tiempo aleatorio entre min y max milisegundos.
 * Simula comportamiento humano al navegar.
 */
export function esperaAleatoria(minMs: number = 2000, maxMs: number = 5000): Promise<void> {
    const tiempo = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise(resolve => setTimeout(resolve, tiempo));
}

/**
 * Construye la URL de búsqueda de Idealista basada en la configuración.
 */
export function construirUrlIdealista(config: ConfigBusqueda): string {
    // URL base para venta de pisos en Burgos Capital
    let url = 'https://www.idealista.com/venta-viviendas/burgos-burgos/';

    // Construir parámetros de búsqueda
    const params: string[] = [];

    if (config.min_habitaciones) {
        params.push(`minRooms=${config.min_habitaciones}`);
    }
    if (config.min_banos) {
        params.push(`minBathrooms=${config.min_banos}`);
    }
    if (config.min_metros) {
        params.push(`minSize=${config.min_metros}`);
    }

    // Añadir parámetros a la URL
    if (params.length > 0) {
        url += '?' + params.join('&');
    }

    return url;
}

/**
 * Logger estructurado para el scraper.
 */
export const logger = {
    info: (msg: string, data?: unknown) => {
        console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`, data || '');
    },
    warn: (msg: string, data?: unknown) => {
        console.warn(`[${new Date().toISOString()}] ⚠️  ${msg}`, data || '');
    },
    error: (msg: string, data?: unknown) => {
        console.error(`[${new Date().toISOString()}] ❌ ${msg}`, data || '');
    },
    success: (msg: string, data?: unknown) => {
        console.log(`[${new Date().toISOString()}] ✅ ${msg}`, data || '');
    },
};
