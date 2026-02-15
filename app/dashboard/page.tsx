/**
 * Página principal del dashboard (placeholder).
 * Será reemplazada por el listado de pisos en el Prompt 6.
 */
export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-slate-400 mt-1">
                    Bienvenido a BuscaChozas. Aquí verás los pisos recopilados.
                </p>
            </div>

            {/* Placeholder cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <p className="text-sm text-slate-400">Pisos activos</p>
                    <p className="text-3xl font-bold text-white mt-1">--</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <p className="text-sm text-slate-400">Cambios de precio</p>
                    <p className="text-3xl font-bold text-emerald-400 mt-1">--</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <p className="text-sm text-slate-400">Nuevos hoy</p>
                    <p className="text-3xl font-bold text-blue-400 mt-1">--</p>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <p className="text-slate-400">
                    🏗️ El listado de pisos y mapa se implementarán en el Prompt 6.
                </p>
            </div>
        </div>
    );
}
