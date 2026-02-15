'use client';

import Image from 'next/image';
import { Tables } from '@/lib/database.types';

type Piso = Tables<'pisos'>;

interface GridPisosProps {
    pisos: Piso[];
}

/**
 * Grid de tarjetas de pisos con foto, precio grande y badges.
 */
export default function GridPisos({ pisos }: GridPisosProps) {
    if (pisos.length === 0) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                <span className="text-4xl mb-4 block">🏠</span>
                <p className="text-slate-400 text-lg">No hay pisos disponibles</p>
                <p className="text-slate-500 text-sm mt-1">Ejecuta el scraper para buscar pisos nuevos</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {pisos.map((piso) => (
                <TarjetaPiso key={piso.id} piso={piso} />
            ))}
        </div>
    );
}

function TarjetaPiso({ piso }: { piso: Piso }) {
    const precioFormateado = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
    }).format(Number(piso.precio));

    return (
        <a
            href={piso.url_anuncio}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/30 hover:bg-white/[0.07] transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5"
        >
            {/* Imagen */}
            <div className="relative h-48 bg-slate-800 overflow-hidden">
                {piso.foto_principal ? (
                    <Image
                        src={piso.foto_principal}
                        alt={piso.titulo}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        unoptimized
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <span className="text-4xl opacity-30">🏠</span>
                    </div>
                )}

                {/* Badge activo/inactivo */}
                <div className="absolute top-3 right-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full backdrop-blur-md ${piso.activo
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                        {piso.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </div>
            </div>

            {/* Contenido */}
            <div className="p-5">
                {/* Precio */}
                <p className="text-2xl font-bold text-white mb-1">
                    {precioFormateado}
                </p>

                {/* Título */}
                <h3 className="text-sm text-slate-300 line-clamp-2 mb-3 group-hover:text-white transition-colors">
                    {piso.titulo}
                </h3>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                    {piso.metros && (
                        <Badge icon="📐" valor={`${piso.metros} m²`} />
                    )}
                    {piso.habitaciones && (
                        <Badge icon="🛏️" valor={`${piso.habitaciones} hab.`} />
                    )}
                    {piso.banos && (
                        <Badge icon="🚿" valor={`${piso.banos} baños`} />
                    )}
                </div>
            </div>
        </a>
    );
}

function Badge({ icon, valor }: { icon: string; valor: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300">
            <span>{icon}</span>
            {valor}
        </span>
    );
}
