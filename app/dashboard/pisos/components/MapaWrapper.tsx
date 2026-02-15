'use client';

import dynamic from 'next/dynamic';
import { Tables } from '@/lib/database.types';

type Piso = Tables<'pisos'>;

/**
 * Wrapper Client Component para importar MapaPisos con ssr: false.
 * Necesario porque next/dynamic con ssr: false solo funciona en Client Components.
 */
const MapaPisos = dynamic(
    () => import('./MapaPisos'),
    {
        ssr: false,
        loading: () => (
            <div className="h-[500px] rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <p className="text-slate-400 text-sm">Cargando mapa...</p>
            </div>
        ),
    }
);

interface MapaWrapperProps {
    pisos: Piso[];
}

export default function MapaWrapper({ pisos }: MapaWrapperProps) {
    return <MapaPisos pisos={pisos} />;
}
