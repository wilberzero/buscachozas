import * as cheerio from 'cheerio';
import { PisoParsed } from './types';

/**
 * Parsea el precio de un string con formato europeo (ej: "185.000€", "1.250.000€")
 * Devuelve 0 si no se puede extraer un número válido.
 */
function parsePrecio(textoPreio: string): number {
    if (!textoPreio) return 0;
    // Eliminar todo excepto dígitos y comas (para decimales)
    const limpio = textoPreio.replace(/[^\d,]/g, '');
    if (!limpio) return 0;
    // Reemplazar coma decimal por punto
    const numero = parseFloat(limpio.replace(',', '.'));
    return isNaN(numero) ? 0 : numero;
}

/**
 * Extrae un número de un string (ej: "3 hab." → 3, "95 m²" → 95)
 * Devuelve null si no se encuentra un número.
 */
function extraerNumero(texto: string): number | null {
    if (!texto) return null;
    const match = texto.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Detecta si una palabra clave aparece en el texto (case-insensitive).
 */
function detectarPalabraClave(texto: string, palabras: string[]): boolean {
    if (!texto) return false;
    const textoLower = texto.toLowerCase();
    return palabras.some(palabra => textoLower.includes(palabra.toLowerCase()));
}

/**
 * Parsea una tarjeta individual de un anuncio de Idealista.
 * 
 * @param html - El HTML de la tarjeta del anuncio
 * @param baseUrl - La URL base del portal (ej: "https://www.idealista.com")
 * @returns PisoParsed con los datos extraídos, o null si no se puede parsear
 */
export function parseProperty(html: string, baseUrl: string): PisoParsed | null {
    try {
        const $ = cheerio.load(html);
        const articulo = $('article[data-adid]').first();

        // Si no hay artículo con data-adid, no podemos parsear
        if (articulo.length === 0) return null;

        // Extraer portal_id del data-adid
        const portalId = articulo.attr('data-adid');
        if (!portalId) return null;

        // Título del anuncio
        const titulo = articulo.find('.item-link').text().trim() || 'Sin título';

        // Precio
        const precioTexto = articulo.find('.item-price').text().trim();
        const precio = parsePrecio(precioTexto);

        // Detalles (habitaciones, metros, baños)
        const detalles = articulo.find('.item-detail');
        let habitaciones: number | null = null;
        let metros: number | null = null;
        let banos: number | null = null;

        detalles.each((_, el) => {
            const texto = $(el).text().trim().toLowerCase();
            if (texto.includes('hab')) {
                habitaciones = extraerNumero(texto);
            } else if (texto.includes('m²') || texto.includes('m2')) {
                metros = extraerNumero(texto);
            } else if (texto.includes('baño') || texto.includes('bano')) {
                banos = extraerNumero(texto);
            }
        });

        // Descripción
        const descripcion = articulo.find('.item-description').text().trim() || null;

        // URL del anuncio
        const hrefRelativo = articulo.find('.item-link').attr('href') || '';
        const urlAnuncio = hrefRelativo.startsWith('http')
            ? hrefRelativo
            : `${baseUrl}${hrefRelativo}`;

        // Foto principal
        const fotoSrc = articulo.find('img').first().attr('src') || null;

        // Detección de garaje y trastero en la descripción
        const textoCompleto = `${titulo} ${descripcion || ''}`;
        const garaje = detectarPalabraClave(textoCompleto, ['garaje', 'garage', 'plaza de garaje', 'parking']);
        const trastero = detectarPalabraClave(textoCompleto, ['trastero', 'almacén', 'almacen', 'storage']);

        return {
            portal_id: portalId,
            titulo,
            precio,
            habitaciones,
            metros,
            banos,
            descripcion,
            url_anuncio: urlAnuncio,
            foto_principal: fotoSrc,
            garaje,
            trastero,
        };
    } catch (error) {
        console.error(`Error parseando propiedad:`, error);
        return null;
    }
}

/**
 * Parsea una página completa de resultados de búsqueda.
 * Extrae todas las tarjetas y devuelve un array de pisos parseados.
 * Si una tarjeta falla, la ignora y continúa con las demás.
 * 
 * @param html - El HTML completo de la página de resultados
 * @param baseUrl - La URL base del portal
 * @returns Array de PisoParsed
 */
export function parseListPage(html: string, baseUrl: string): PisoParsed[] {
    const resultados: PisoParsed[] = [];

    try {
        const $ = cheerio.load(html);
        const tarjetas = $('article[data-adid]');

        tarjetas.each((_, el) => {
            try {
                const tarjetaHtml = $.html(el);
                const piso = parseProperty(tarjetaHtml, baseUrl);
                if (piso) {
                    resultados.push(piso);
                }
            } catch (error) {
                // Si falla una tarjeta, logueamos y seguimos con la siguiente
                console.warn('Error parseando tarjeta individual, continuando...', error);
            }
        });
    } catch (error) {
        console.error('Error parseando página de listado:', error);
    }

    return resultados;
}
