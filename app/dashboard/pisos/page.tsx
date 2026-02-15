import { createClient } from '@/lib/supabase/server';
import GridPisos from './components/GridPisos';
import EditorConfig from './components/EditorConfig';
import MapaWrapper from './components/MapaWrapper';

export default async function PisosPage() {
    const supabase = await createClient();

    // Obtener pisos activos
    const { data: pisos, error: errorPisos } = await supabase
        .from('pisos')
        .select('*')
        .eq('activo', true)
        .order('created_at', { ascending: false });

    // Obtener configuración de búsqueda
    const { data: config } = await supabase
        .from('config_busqueda')
        .select('*')
        .limit(1)
        .single();

    if (errorPisos) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
                <p className="text-red-400">Error cargando pisos: {errorPisos.message}</p>
            </div>
        );
    }

    const listaPisos = pisos || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Pisos en Burgos</h1>
                    <p className="text-slate-400 mt-1">
                        {listaPisos.length} {listaPisos.length === 1 ? 'piso encontrado' : 'pisos encontrados'}
                    </p>
                </div>

                {/* Editor de configuración */}
                {config && <EditorConfig config={config} />}
            </div>

            {/* Stats rápidos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="Total pisos"
                    valor={listaPisos.length.toString()}
                    icono="🏠"
                />
                <StatCard
                    label="Precio medio"
                    valor={listaPisos.length > 0
                        ? new Intl.NumberFormat('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                            maximumFractionDigits: 0,
                        }).format(
                            listaPisos.reduce((sum, p) => sum + Number(p.precio), 0) / listaPisos.length
                        )
                        : '--'
                    }
                    icono="💰"
                />
                <StatCard
                    label="Precio mín."
                    valor={listaPisos.length > 0
                        ? new Intl.NumberFormat('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                            maximumFractionDigits: 0,
                        }).format(Math.min(...listaPisos.map(p => Number(p.precio))))
                        : '--'
                    }
                    icono="📉"
                />
                <StatCard
                    label="Con coordenadas"
                    valor={`${listaPisos.filter(p => p.lat && p.lng).length}`}
                    icono="📍"
                />
            </div>

            {/* Vista de Mapa */}
            <section>
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span>🗺️</span> Mapa
                </h2>
                <MapaWrapper pisos={listaPisos} />
            </section>

            {/* Vista de Lista */}
            <section>
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span>📋</span> Listado
                </h2>
                <GridPisos pisos={listaPisos} />
            </section>
        </div>
    );
}

function StatCard({ label, valor, icono }: { label: string; valor: string; icono: string }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{icono}</span>
                <p className="text-xs text-slate-400">{label}</p>
            </div>
            <p className="text-xl font-bold text-white">{valor}</p>
        </div>
    );
}
