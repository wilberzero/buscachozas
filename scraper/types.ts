import { Tables } from '../lib/database.types';

/**
 * Tipo parcial de un piso extraído del HTML.
 * No incluye campos generados por la DB como id, created_at, etc.
 */
export type PisoParsed = Pick<
    Tables<'pisos'>,
    'titulo' | 'precio' | 'metros' | 'habitaciones' | 'banos' | 'descripcion' | 'url_anuncio' | 'foto_principal' | 'portal_id'
> & {
    garaje: boolean;
    trastero: boolean;
};
