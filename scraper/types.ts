import { Tables } from '../lib/database.types';

/**
 * Tipo parcial de un piso extraído del HTML.
 * No incluye campos generados por la DB como id, created_at, etc.
 */
export type PisoParsed = Pick<
    Tables<'pisos'>,
    'titulo' | 'precio' | 'metros' | 'habitaciones' | 'banos' | 'descripcion' | 'url_anuncio' | 'foto_principal' | 'portal_id'
> & {
    trastero: boolean;
};

export interface ScraperLog {
    id: string;
    started_at: string;
    finished_at?: string;
    status: 'running' | 'success' | 'error';
    pisos_encontrados: number;
    pisos_nuevos: number;
    pisos_actualizados: number;
    error_message?: string;
}
