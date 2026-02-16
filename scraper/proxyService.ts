import { logger } from './utils';

/**
 * Obtiene el HTML de una URL usando ZenRows API para evadir captchas y bloqueos.
 * Si no hay API Key, intenta un fetch directo (que fallará en Idealista, pero sirve de fallback o dev).
 */
export async function fetchHtmlViaProxy(url: string): Promise<string> {
    const zenrowsKey = process.env.ZENROWS_API_KEY;

    if (zenrowsKey) {
        logger.info('🌐 Usando ZenRows API para navegación...');

        try {
            const params = new URLSearchParams({
                'apikey': zenrowsKey,
                'url': url,
                'js_render': 'true',
                'antibot': 'true',
                'premium_proxy': 'true', // IPs residenciales
                'location': 'es',        // Geolocalización España
            });

            const response = await fetch(`https://api.zenrows.com/v1/?${params.toString()}`);

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`ZenRows API error: ${response.status} - ${text}`);
            }

            const html = await response.text();
            logger.success('✅ HTML obtenido vía ZenRows');
            return html;

        } catch (error) {
            logger.error('❌ Error llamando a ZenRows', error);
            throw error;
        }
    } else {
        logger.warn('⚠️ No se detectó ZENROWS_API_KEY. Usando Playwright local...');
        return ''; // Retornamos vacío para indicar que se debe usar el fallback local
    }
}
