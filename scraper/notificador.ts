/**
 * Notificador de cambios: envía alertas por Telegram y Email.
 * 
 * Recibe arrays de pisos nuevos y bajadas de precio del scraper
 * y envía notificaciones al canal/email configurado.
 */

import TelegramBot from 'node-telegram-bot-api';
import { Resend } from 'resend';
import { ResultadoProcesamiento } from './dbService';
import { logger } from './utils';

// ============================================================
// Configuración
// ============================================================

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_TO = process.env.NOTIFICATION_EMAIL || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'BuscaChozas <onboarding@resend.dev>';

// ============================================================
// Formateo de mensajes
// ============================================================

/**
 * Genera el mensaje de Telegram con formato Markdown.
 */
function formatearMensajeTelegram(
    nuevos: ResultadoProcesamiento[],
    bajadasPrecio: ResultadoProcesamiento[]
): string {
    const lineas: string[] = ['🏠 *BuscaChozas — Resumen*\n'];

    if (nuevos.length > 0) {
        lineas.push(`✨ *${nuevos.length} pisos nuevos:*`);
        nuevos.forEach((p) => {
            lineas.push(`  • \`${p.portal_id}\``);
        });
        lineas.push('');
    }

    if (bajadasPrecio.length > 0) {
        lineas.push(`📉 *${bajadasPrecio.length} bajadas de precio:*`);
        bajadasPrecio.forEach((p) => {
            const anterior = p.precioAnterior?.toLocaleString('es-ES') || '?';
            const nuevo = p.precioNuevo?.toLocaleString('es-ES') || '?';
            lineas.push(`  • \`${p.portal_id}\`: ${anterior}€ → ${nuevo}€`);
        });
        lineas.push('');
    }

    if (nuevos.length === 0 && bajadasPrecio.length === 0) {
        lineas.push('😴 Sin novedades en esta ejecución.');
    }

    lineas.push(`\n🕐 ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`);

    return lineas.join('\n');
}

/**
 * Genera el HTML del email de resumen.
 */
function formatearEmailHTML(
    nuevos: ResultadoProcesamiento[],
    bajadasPrecio: ResultadoProcesamiento[]
): string {
    let html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1e293b;">🏠 BuscaChozas — Resumen</h1>
  `;

    if (nuevos.length > 0) {
        html += `<h2 style="color: #059669;">✨ ${nuevos.length} pisos nuevos</h2><ul>`;
        nuevos.forEach((p) => {
            html += `<li><code>${p.portal_id}</code></li>`;
        });
        html += '</ul>';
    }

    if (bajadasPrecio.length > 0) {
        html += `<h2 style="color: #2563eb;">📉 ${bajadasPrecio.length} bajadas de precio</h2><ul>`;
        bajadasPrecio.forEach((p) => {
            const anterior = p.precioAnterior?.toLocaleString('es-ES') || '?';
            const nuevo = p.precioNuevo?.toLocaleString('es-ES') || '?';
            html += `<li><code>${p.portal_id}</code>: ${anterior}€ → <strong>${nuevo}€</strong></li>`;
        });
        html += '</ul>';
    }

    if (nuevos.length === 0 && bajadasPrecio.length === 0) {
        html += '<p style="color: #64748b;">😴 Sin novedades en esta ejecución.</p>';
    }

    html += `
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">
        🕐 ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
      </p>
    </div>
  `;

    return html;
}

// ============================================================
// Envío de notificaciones
// ============================================================

/**
 * Envía notificación por Telegram.
 */
async function enviarTelegram(mensaje: string): Promise<boolean> {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
        logger.warn('Telegram no configurado (faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID)');
        return false;
    }

    try {
        const bot = new TelegramBot(TELEGRAM_TOKEN);
        await bot.sendMessage(TELEGRAM_CHAT_ID, mensaje, { parse_mode: 'Markdown' });
        logger.success('Notificación de Telegram enviada');
        return true;
    } catch (error) {
        logger.error('Error enviando Telegram', error);
        return false;
    }
}

/**
 * Envía notificación por Email via Resend.
 */
async function enviarEmail(html: string): Promise<boolean> {
    if (!RESEND_API_KEY || !EMAIL_TO) {
        logger.warn('Email no configurado (faltan RESEND_API_KEY o NOTIFICATION_EMAIL)');
        return false;
    }

    try {
        const resend = new Resend(RESEND_API_KEY);
        await resend.emails.send({
            from: EMAIL_FROM,
            to: EMAIL_TO,
            subject: `🏠 BuscaChozas — Resumen ${new Date().toLocaleDateString('es-ES')}`,
            html,
        });
        logger.success('Email de resumen enviado');
        return true;
    } catch (error) {
        logger.error('Error enviando email', error);
        return false;
    }
}

// ============================================================
// Función principal
// ============================================================

/**
 * Envía notificaciones de nuevos pisos y bajadas de precio.
 * 
 * @param nuevos - Array de pisos nuevos encontrados
 * @param bajadasPrecio - Array de pisos con bajada de precio
 */
export async function notificar(
    nuevos: ResultadoProcesamiento[],
    bajadasPrecio: ResultadoProcesamiento[]
): Promise<void> {
    // Si no hay novedades, no enviar nada
    if (nuevos.length === 0 && bajadasPrecio.length === 0) {
        logger.info('Sin novedades, no se envían notificaciones');
        return;
    }

    logger.info(`Enviando notificaciones: ${nuevos.length} nuevos, ${bajadasPrecio.length} bajadas`);

    const mensajeTelegram = formatearMensajeTelegram(nuevos, bajadasPrecio);
    const htmlEmail = formatearEmailHTML(nuevos, bajadasPrecio);

    // Enviar ambas notificaciones en paralelo
    const [telegramOk, emailOk] = await Promise.all([
        enviarTelegram(mensajeTelegram),
        enviarEmail(htmlEmail),
    ]);

    if (!telegramOk && !emailOk) {
        logger.warn('No se pudo enviar ninguna notificación. Verifica la configuración.');
    }
}
