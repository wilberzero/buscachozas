import { SupabaseClient } from '@supabase/supabase-js';
import { ScraperLog } from './types';

export async function logInicioScraper(supabase: SupabaseClient): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('scraper_logs')
            .insert({ status: 'running' })
            .select()
            .single();

        if (error) {
            console.error('❌ Error iniciando log del scraper:', error.message);
            return null;
        }

        return data.id;
    } catch (e) {
        console.error('❌ Error inesperado iniciando log:', e);
        return null;
    }
}

export async function logFinScraper(
    supabase: SupabaseClient,
    id: string,
    resultado: {
        status: 'success' | 'error';
        pisos_encontrados?: number;
        pisos_nuevos?: number;
        pisos_actualizados?: number;
        error_message?: string;
    }
) {
    if (!id) return;

    try {
        const { error } = await supabase
            .from('scraper_logs')
            .update({
                finished_at: new Date().toISOString(),
                ...resultado
            })
            .eq('id', id);

        if (error) {
            console.error('❌ Error finalizando log del scraper:', error.message);
        }
    } catch (e) {
        console.error('❌ Error inesperado finalizando log:', e);
    }
}
