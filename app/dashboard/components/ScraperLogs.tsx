'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { ScraperLog } from '@/scraper/types';

export default function ScraperLogs() {
    const [logs, setLogs] = useState<ScraperLog[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchLogs = async () => {
        setLoading(true);
        // Casting 'scraper_logs' to any to bypass type check as we haven't regenerated types
        const { data, error } = await supabase
            .from('scraper_logs' as any)
            .select('*')
            .order('started_at', { ascending: false })
            .limit(10);

        if (!error && data) {
            setLogs(data as unknown as ScraperLog[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    🤖 Historial del Scraper
                </h3>
                <button
                    onClick={fetchLogs}
                    className="text-sm px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                    Recargar
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            <th className="px-4 py-3">Estado</th>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3 text-center">Encontrados</th>
                            <th className="px-4 py-3 text-center">Nuevos</th>
                            <th className="px-4 py-3 text-center">Cambios Precio</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                    Cargando historial...
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                    No hay registros de ejecución aún.
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="px-4 py-3">
                                        <StatusBadge status={log.status} />
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                        {new Date(log.started_at).toLocaleString('es-ES', {
                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                        {/* Duración si terminó */}
                                        {log.finished_at && (
                                            <div className="text-xs opacity-70">
                                                {Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center font-medium">
                                        {log.pisos_encontrados}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {log.pisos_nuevos > 0 ? (
                                            <span className="text-emerald-500 font-bold">+{log.pisos_nuevos}</span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {log.pisos_actualizados > 0 ? (
                                            <span className="text-blue-500 font-bold">{log.pisos_actualizados}</span>
                                        ) : '-'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: ScraperLog['status'] }) {
    if (status === 'success') {
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">✅ Éxito</span>;
    }
    if (status === 'error') {
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">❌ Error</span>;
    }
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">🔄 Ejecutando</span>;
}
