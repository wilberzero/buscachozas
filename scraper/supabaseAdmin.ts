/**
 * Cliente de Supabase para el scraper.
 * 
 * Usa la SERVICE_ROLE key que ignora RLS, necesario porque el scraper
 * necesita INSERT/UPDATE en pisos e historico_precios sin estar autenticado.
 * 
 * ⚠️ NUNCA exponer esta key en el frontend. Solo usar server-side.
 */
import { createClient } from '@supabase/supabase-js';
import { Database } from '../lib/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn(
        '⚠️ SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas. ' +
        'El scraper no podrá conectarse a la base de datos.'
    );
}

export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);
