import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ScraperLogs from './components/ScraperLogs';

/**
 * Página principal del dashboard con resumen y navegación.
 */
export default async function DashboardPage() {
    const supabase = await createClient();

    // Obtener conteos
    const { count: totalPisos } = await supabase
        .from('pisos')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true);

    const { count: totalHistorico } = await supabase
        .from('historico_precios')
        .select('*', { count: 'exact', head: true });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-slate-400 mt-1">
                    Bienvenido a BuscaChozas. Tu buscador de pisos en Burgos.
                </p>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <p className="text-sm text-slate-400">Pisos activos</p>
                    <p className="text-3xl font-bold text-white mt-1">{totalPisos ?? 0}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <p className="text-sm text-slate-400">Cambios de precio registrados</p>
                    <p className="text-3xl font-bold text-emerald-400 mt-1">{totalHistorico ?? 0}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-500/10 border border-blue-500/20 rounded-xl p-6">
                    <p className="text-sm text-blue-300">Acceso rápido</p>
                    <Link
                        href="/dashboard/pisos"
                        className="inline-flex items-center gap-2 mt-2 text-white font-medium hover:text-blue-300 transition-colors"
                    >
                        Ver pisos →
                    </Link>
                </div>
            </div>

            {/* Logs del Scraper */}
            <div className="pt-6">
                <ScraperLogs />
            </div>
        </div>
    );
}
