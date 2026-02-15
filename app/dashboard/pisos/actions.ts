'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Server Action para actualizar la configuración de búsqueda.
 */
export async function actualizarConfig(formData: FormData) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('No autorizado');
    }

    const min_habitaciones = parseInt(formData.get('min_habitaciones') as string) || 0;
    const min_banos = parseInt(formData.get('min_banos') as string) || 0;
    const min_metros = parseInt(formData.get('min_metros') as string) || 0;
    const garaje = formData.get('garaje') === 'on';
    const trastero = formData.get('trastero') === 'on';

    // Actualizar la configuración singleton
    const { error } = await supabase
        .from('config_busqueda')
        .update({
            min_habitaciones,
            min_banos,
            min_metros,
            garaje,
            trastero,
        })
        .eq('id', (await supabase.from('config_busqueda').select('id').single()).data?.id || '');

    if (error) {
        throw new Error(`Error actualizando configuración: ${error.message}`);
    }

    revalidatePath('/dashboard/pisos');
}
