'use client';

import { createBrowserClient } from '@supabase/ssr';
import { Database } from '../database.types';

/**
 * Cliente de Supabase para uso en Client Components.
 * Gestiona la sesión automáticamente via cookies del navegador.
 */
export function createClient() {
    return createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}
