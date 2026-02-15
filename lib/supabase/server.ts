import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '../database.types';

/**
 * Cliente de Supabase para uso en Server Components, Route Handlers y Server Actions.
 * Requiere el acceso a cookies de Next.js para manejar la sesión.
 */
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // setAll puede fallar en Server Components (read-only context)
                        // Esto es esperado y manejado por el middleware
                    }
                },
            },
        }
    );
}
