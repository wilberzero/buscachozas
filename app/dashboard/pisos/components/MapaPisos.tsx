'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Tables } from '@/lib/database.types';

type Piso = Tables<'pisos'>;

// Fix para los iconos de Leaflet en Next.js
const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

interface MapaPisosProps {
    pisos: Piso[];
}

/**
 * Mapa interactivo con pines de los pisos.
 * Usa react-leaflet. DEBE importarse con next/dynamic ssr: false.
 */
export default function MapaPisos({ pisos }: MapaPisosProps) {
    // Filtrar pisos con coordenadas válidas
    const pisosConCoords = pisos.filter(
        (p) => p.lat != null && p.lng != null && p.lat !== 0 && p.lng !== 0
    );

    // Centro de Burgos por defecto
    const centroDefault: [number, number] = [42.3439, -3.6970];

    // Calcular centro basado en los pisos
    const centro: [number, number] = pisosConCoords.length > 0
        ? [
            pisosConCoords.reduce((sum, p) => sum + (p.lat || 0), 0) / pisosConCoords.length,
            pisosConCoords.reduce((sum, p) => sum + (p.lng || 0), 0) / pisosConCoords.length,
        ]
        : centroDefault;

    const precioFormat = (precio: number) =>
        new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0,
        }).format(precio);

    return (
        <div className="rounded-2xl overflow-hidden border border-white/10">
            <MapContainer
                center={centro}
                zoom={13}
                style={{ height: '500px', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {pisosConCoords.map((piso) => (
                    <Marker
                        key={piso.id}
                        position={[piso.lat!, piso.lng!]}
                    >
                        <Popup>
                            <div className="min-w-[200px]">
                                <p className="font-bold text-lg text-blue-600">
                                    {precioFormat(Number(piso.precio))}
                                </p>
                                <p className="text-sm font-medium mt-1">{piso.titulo}</p>
                                <div className="flex gap-2 mt-2 text-xs text-gray-600">
                                    {piso.metros && <span>{piso.metros} m²</span>}
                                    {piso.habitaciones && <span>• {piso.habitaciones} hab.</span>}
                                    {piso.banos && <span>• {piso.banos} baños</span>}
                                </div>
                                <a
                                    href={piso.url_anuncio}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block mt-2 text-xs text-blue-500 hover:underline"
                                >
                                    Ver anuncio →
                                </a>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {pisosConCoords.length === 0 && (
                <div className="bg-slate-800/50 py-3 px-4 text-center">
                    <p className="text-sm text-slate-400">
                        No hay pisos con coordenadas para mostrar en el mapa
                    </p>
                </div>
            )}
        </div>
    );
}
