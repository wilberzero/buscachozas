'use client'

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import L from 'leaflet'
import { BedDouble, Scaling, User, ExternalLink, Euro, MapPin } from 'lucide-react'

// Fix para los iconos de Leaflet
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// Componente interno para forzar el re-escalado del mapa y evitar barras blancas
function ResizeMap() {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize()
    }, 500)
  }, [map])
  return null
}

const neighborhoodCoords: Record<string, [number, number]> = {
  'Villatoro': [42.3789, -3.6969],
  'Gamonal': [42.3508, -3.6686],
  'Villafría': [42.3614, -3.6265],
  'Villimar': [42.3650, -3.6650],
  'Casco Antiguo': [42.3400, -3.7040],
  'Fuentecillas': [42.3450, -3.7250],
  'San Pedro': [42.3420, -3.7150],
  'Reyes Católicos': [42.3480, -3.6980],
  'Illera': [42.3580, -3.6920],
  'Plantío': [42.3450, -3.6820],
  'San Agustín': [42.3350, -3.6980],
  'Universidad': [42.3380, -3.7180]
}

export default function Map({ properties }: { properties: any[] }) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return <div className="h-[650px] bg-slate-100 animate-pulse rounded-[40px] flex items-center justify-center text-slate-400 font-bold">Cargando mapa interactivo...</div>

  const center: [number, number] = [42.3439, -3.6969]

  return (
    <div className="h-[650px] w-full rounded-[40px] overflow-hidden border-8 border-white shadow-2xl relative z-0 mt-4 leaflet-container-fix">
      {/* Estilo local para arreglar las líneas blancas en los cuadros del mapa */}
      <style jsx global>{`
        .leaflet-container-fix img.leaflet-tile {
          max-width: none !important;
          max-height: none !important;
        }
        .leaflet-container {
          height: 100% !important;
          width: 100% !important;
          background: #f8fafc !important;
        }
      `}</style>

      <MapContainer center={center} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <ResizeMap />
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {properties.map((piso) => {
          let pos: [number, number] = [center[0] + (Math.random() - 0.5) * 0.02, center[1] + (Math.random() - 0.5) * 0.02]
          const searchStr = ((piso.neighborhood || "") + " " + (piso.address || "") + " " + (piso.title || "")).toLowerCase()
          
          for (const [name, coord] of Object.entries(neighborhoodCoords)) {
            if (searchStr.includes(name.toLowerCase())) {
              pos = [coord[0] + (Math.random() - 0.5) * 0.008, coord[1] + (Math.random() - 0.5) * 0.008]
              break
            }
          }
          
          const sortedHistory = [...(piso.price_history || [])].sort((a: any, b: any) => 
            new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
          )
          const precioActual = sortedHistory[0]?.price || 0

          return (
            <Marker key={piso.id} position={pos} icon={customIcon}>
              <Popup className="custom-popup-wide">
                <div className="p-3 w-64">
                  <div className="flex justify-between items-start mb-2">
                    <span className="bg-slate-900 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">{piso.type || 'Inmueble'}</span>
                    <span className="text-blue-600 font-black text-sm flex items-center gap-0.5"><Euro className="w-3 h-3" />{precioActual.toLocaleString('es-ES')}</span>
                  </div>
                  
                  <h4 className="font-bold text-slate-800 text-sm mb-3 leading-tight line-clamp-2">{piso.title}</h4>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3 border-y border-slate-100 py-2">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <BedDouble className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold text-slate-700">{piso.rooms} hab</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Scaling className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold text-slate-700">{piso.size_m2} m²</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 mb-4 text-[10px] font-bold text-slate-500">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-blue-400" />
                      <span className="truncate">{piso.address} {piso.neighborhood ? `(${piso.neighborhood})` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="truncate">{piso.advertiser}</span>
                    </div>
                  </div>

                  <a 
                    href={piso.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white font-black py-2.5 rounded-xl text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    ABRIR ANUNCIO <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
