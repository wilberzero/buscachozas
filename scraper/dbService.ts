import { SupabaseClient } from '@supabase/supabase-js';
import { PisoParsed } from './types';

/**
 * Tipos de resultado del procesamiento de un piso.
 */
export type TipoResultado = 'NUEVO' | 'CAMBIO_PRECIO' | 'SIN_CAMBIOS' | 'ERROR';

/**
 * Resultado del procesamiento de un piso individual.
 */
export interface ResultadoProcesamiento {
    tipo: TipoResultado;
    portal_id: string;
    precioAnterior?: number;
    precioNuevo?: number;
    error?: string;
}

/**
 * Obtiene el cliente de Supabase de forma lazy (solo cuando se necesita).
 * Esto evita errores al importar el módulo en entornos de test.
 */
function getDefaultClient(): SupabaseClient {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('../lib/supabase');
    return supabase;
}

/**
 * Procesa un piso extraído del scraper y lo persiste en la base de datos.
 * 
 * Lógica de negocio:
 * - **Caso A (Nuevo):** Si el portal_id no existe, inserta en `pisos` y registra el precio en `historico_precios`.
 * - **Caso B (Cambio de Precio):** Si existe y el precio es diferente, actualiza `pisos` e inserta en `historico_precios`.
 * - **Caso C (Sin Cambios):** Si existe y el precio es igual, solo actualiza `updated_at`.
 * 
 * @param datos - Los datos del piso parseados del HTML
 * @param client - Cliente de Supabase (opcional, para testing con inyección de dependencias)
 * @returns ResultadoProcesamiento indicando qué ocurrió
 */
export async function procesarPiso(
    datos: PisoParsed,
    client?: SupabaseClient
): Promise<ResultadoProcesamiento> {
    const db = client || getDefaultClient();

    try {
        // 1. Buscar si ya existe el piso por portal_id
        const { data: pisoExistente, error: errorBusqueda } = await db
            .from('pisos')
            .select('id, portal_id, precio, updated_at')
            .eq('portal_id', datos.portal_id)
            .maybeSingle();

        if (errorBusqueda) {
            return {
                tipo: 'ERROR',
                portal_id: datos.portal_id,
                error: `Error buscando piso: ${errorBusqueda.message}`,
            };
        }

        // ----------------------------------------------------------
        // Caso A: Piso NUEVO
        // ----------------------------------------------------------
        if (!pisoExistente) {
            // Preparar datos para inserción (sin garaje/trastero que no son columnas de la tabla)
            const { garaje, trastero, ...datosInsercion } = datos;

            const { data: pisoInsertado, error: errorInsert } = await db
                .from('pisos')
                .insert(datosInsercion)
                .select()
                .single();

            if (errorInsert || !pisoInsertado) {
                return {
                    tipo: 'ERROR',
                    portal_id: datos.portal_id,
                    error: `Error insertando piso nuevo: ${errorInsert?.message}`,
                };
            }

            // Registrar precio inicial en histórico
            await db.from('historico_precios').insert({
                piso_id: pisoInsertado.id,
                precio: datos.precio,
            });

            return {
                tipo: 'NUEVO',
                portal_id: datos.portal_id,
            };
        }

        // ----------------------------------------------------------
        // Caso B: Piso existe y CAMBIÓ de precio
        // ----------------------------------------------------------
        if (pisoExistente.precio !== datos.precio) {
            const precioAnterior = pisoExistente.precio;

            // Actualizar el piso con los nuevos datos
            const { garaje, trastero, ...datosActualizacion } = datos;

            await db
                .from('pisos')
                .update({
                    ...datosActualizacion,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', pisoExistente.id);

            // Registrar el cambio en histórico
            await db.from('historico_precios').insert({
                piso_id: pisoExistente.id,
                precio: datos.precio,
            });

            return {
                tipo: 'CAMBIO_PRECIO',
                portal_id: datos.portal_id,
                precioAnterior,
                precioNuevo: datos.precio,
            };
        }

        // ----------------------------------------------------------
        // Caso C: Piso existe y NO cambió de precio
        // ----------------------------------------------------------
        await db
            .from('pisos')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', pisoExistente.id);

        return {
            tipo: 'SIN_CAMBIOS',
            portal_id: datos.portal_id,
        };

    } catch (error) {
        const mensaje = error instanceof Error ? error.message : 'Error desconocido';
        return {
            tipo: 'ERROR',
            portal_id: datos.portal_id,
            error: mensaje,
        };
    }
}
