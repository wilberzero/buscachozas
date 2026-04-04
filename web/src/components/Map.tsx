'use client'

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
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

const BURGOS_CENTER: [number, number] = [42.3439, -3.6969]

// Función asíncrona para geocodificar usando Nominatim con caché en localStorage
async function geocodeAddress(address: string, id: string): Promise<[number, number] | null> {
  if (!address) return null;
  const cacheKey = `geo_${id}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) return JSON.parse(cached)

  try {
    const query = `${address.replace(/[\dººª-]/g, '').trim()}, Burgos, Spain`
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`)
    const data = await res.json()
    if (data && data.length > 0) {
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)]
      localStorage.setItem(cacheKey, JSON.stringify(coords))
      return coords
    }
  } catch (e) {
    console.error('Error geocoding', address, e)
  }
  
  // Guardar un valor nulo para no volver a intentar fallos
  localStorage.setItem(cacheKey, JSON.stringify(null))
  return null
}

export default function Map({ properties }: { properties: any[] }) {
  const [isMounted, setIsMounted] = useState(false)
  const [coordsMap, setCoordsMap] = useState<Record<string, [number, number]>>({})

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return;
    
    // Función para procesar en lotes con retraso para respetar límite de Nominatim (1 req/sec)
    const processGeocoding = async () => {
      const newCoords = { ...coordsMap }
      let index = 0;
      
      for (const piso of properties) {
        if (coordsMap[piso.id]) continue; // Ya lo tenemos en memoria
        
        const fullAddr = `${piso.address || ''} ${piso.neighborhood || ''}`.trim()
        if (fullAddr) {
          const cached = localStorage.getItem(`geo_${piso.id}`)
          if (cached) {
            const parsed = JSON.parse(cached)
            if (parsed) {
               newCoords[piso.id] = parsed
               continue;
            }
          } else {
             // Retraso intencionado de 1 segundo entre peticiones a Nominatim
             await new Promise(r => setTimeout(r, 1100))
             const result = await geocodeAddress(fullAddr, piso.id)
             if (result) {
               newCoords[piso.id] = result
               // Actualizar estado por cada nuevo para que aparezca fluidamente
               setCoordsMap(prev => ({ ...prev, [piso.id]: result }))
             }
          }
        }
        index++;
        // Actualizar el estado por lotes de los cacheados
        if (index % 10 === 0) {
           setCoordsMap({ ...newCoords })
        }
      }
      setCoordsMap(newCoords)
    }

    processGeocoding()
  }, [properties, isMounted])

  if (!isMounted) return <div className="h-[650px] bg-slate-100 animate-pulse rounded-[40px] flex items-center justify-center text-slate-400 font-bold">Cargando mapa interactivo...</div>

  return (
    <div className="h-[650px] w-full rounded-[40px] overflow-hidden border-8 border-white shadow-2xl relative z-0 mt-4 leaflet-container-fix">
      <MapContainer center={BURGOS_CENTER} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%', minHeight: '650px' }}>
        <ResizeMap />
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {properties.map((piso) => {
          // Si no tiene coords reales, usar una aproximación aleatoria sobre el centro para que no se superpongan
          const pos: [number, number] = coordsMap[piso.id] || [
            BURGOS_CENTER[0] + (Math.random() - 0.5) * 0.04, 
            BURGOS_CENTER[1] + (Math.random() - 0.5) * 0.04
          ]
          
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
