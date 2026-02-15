import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * API Route para cerrar sesión.
 * Elimina la sesión de Supabase y redirige al login.
 */
export async function POST(request: Request) {
    const supabase = await createClient();
    await supabase.auth.signOut();

    const { origin } = new URL(request.url);
    return NextResponse.redirect(`${origin}/login`, {
        status: 302,
    });
}
