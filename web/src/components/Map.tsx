'use client'

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useEffect, useState, useRef } from 'react'
import L from 'leaflet'
import { BedDouble, Scaling, User, ExternalLink, Euro, MapPin } from 'lucide-react'

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

// Función asíncrona para geocodificar usando Nominatim con caché en localStorage
async function geocodeAddress(address: string, id: string): Promise<[number, number] | null> {
  if (!address) return null;
  const cacheKey = `geo_v2_${id}` // Nueva versión de caché para no usar los datos rotos anteriores
  const cached = localStorage.getItem(cacheKey)
  if (cached) return JSON.parse(cached)

  try {
    // Limpiamos la dirección pero MANTENEMOS los números de portal. 
    // Quitamos º, ª, s/n, y separamos por coma para quedarnos solo con la calle pura
    let cleanAddress = address.split(',')[0].replace(/[ºª]/g, '').replace(/s\/n/gi, '').trim();
    
    // Si la dirección es muy genérica, evitamos buscar para que directamente use el fallback del barrio
    if (cleanAddress.toLowerCase().includes('barrio') && cleanAddress.length < 15) return null;

    const query = `${cleanAddress}, Burgos, Spain`
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

// Componente Wrapper para cada marcador que escucha selectedPropertyId
function PropertyMarker({ 
  piso, 
  pos, 
  icon, 
  selectedPropertyId 
}: { 
  piso: any; 
  pos: [number, number]; 
  icon: L.DivIcon; 
  selectedPropertyId: string | null 
}) {
  const markerRef = useRef<L.Marker>(null)
  const map = useMap()
  
  useEffect(() => {
    if (piso.id === selectedPropertyId && markerRef.current) {
      // Volar al marcador y abrir el popup con retraso para que termine la animación
      map.setView(pos, 16, { animate: true })
      const timer = setTimeout(() => {
        if (markerRef.current) {
          markerRef.current.openPopup()
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [selectedPropertyId, piso.id, pos, map])

  const sortedHistory = [...(piso.price_history || [])].sort((a: any, b: any) => 
    new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  )
  const precioActual = sortedHistory[0]?.price || 0

  return (
    <Marker ref={markerRef} position={pos} icon={icon}>
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
            className="flex items-center justify-center gap-2 w-full bg-blue-600 !text-white font-black py-2.5 rounded-xl text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            style={{ color: 'white' }}
          >
            ABRIR ANUNCIO <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </Popup>
    </Marker>
  )
}

export default function Map({ 
  properties, 
  selectedPropertyId = null 
}: { 
  properties: any[]; 
  selectedPropertyId?: string | null;
}) {
  const [isMounted, setIsMounted] = useState(false)
  const [coordsMap, setCoordsMap] = useState<Record<string, [number, number]>>({})

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return;
    
    const processGeocoding = async () => {
      const newCoords = { ...coordsMap }
      let index = 0;
      
      for (const piso of properties) {
        // Usar lat y lng de la base de datos si existen
        if (piso.lat !== null && piso.lng !== null && piso.lat !== undefined) {
          newCoords[piso.id] = [piso.lat, piso.lng]
          continue;
        }

        if (coordsMap[piso.id]) continue;
        
        const streetAddr = piso.address || '';
        
        if (streetAddr) {
          const cached = localStorage.getItem(`geo_v2_${piso.id}`)
          if (cached) {
            const parsed = JSON.parse(cached)
            if (parsed) {
               newCoords[piso.id] = parsed
               continue;
            }
          } else {
             await new Promise(r => setTimeout(r, 1100))
             const result = await geocodeAddress(streetAddr, piso.id)
             if (result) {
               newCoords[piso.id] = result
               setCoordsMap(prev => ({ ...prev, [piso.id]: result }))
             }
          }
        }
        index++;
        if (index % 10 === 0) {
           setCoordsMap({ ...newCoords })
        }
      }
      setCoordsMap(newCoords)
    }

    processGeocoding()
  }, [properties, isMounted])

  if (!isMounted) return <div className="h-[650px] bg-slate-100 animate-pulse rounded-[40px] flex items-center justify-center text-slate-400 font-bold">Cargando mapa interactivo...</div>

  // Función para crear un pin HTML personalizado basado en el precio
  const createPriceIcon = (price: number) => {
    const priceStr = price >= 1000 ? `${(price / 1000).toFixed(0)}k` : price.toString();
    
    return L.divIcon({
      className: 'bg-transparent border-none',
      html: `<div style="background-color: #1d4ed8; color: white; padding: 4px 8px; border-radius: 999px; font-weight: 900; font-size: 11px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.2); border: 2px solid white; white-space: nowrap; display: inline-block;">
               ${priceStr}€
             </div>
             <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid white; margin: -2px auto 0 auto; filter: drop-shadow(0 2px 1px rgba(0,0,0,0.1));"></div>`,
      iconSize: [48, 30], // Ancho y alto aproximado del div
      iconAnchor: [24, 30], // Anclado en el centro inferior (la punta de la flecha)
      popupAnchor: [0, -32] // El popup se abre justo encima
    });
  }

  // Función para generar un número pseudoaleatorio determinista basado en un string (el ID)
  const seededRandom = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = Math.imul(31, hash) + seed.charCodeAt(i) | 0;
    }
    return () => {
      hash = Math.imul(741103597, hash) + 1;
      return (hash >>> 0) / 4294967296;
    }
  }

  return (
    <div className="h-[650px] w-full rounded-[40px] overflow-hidden border-8 border-white shadow-2xl relative z-0 mt-4 leaflet-container-fix">
      <MapContainer center={BURGOS_CENTER} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%', minHeight: '650px' }}>
        <ResizeMap />
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {properties.map((piso) => {
          // Si no tiene coords reales, usar el centro del barrio exacto, NO una posición aleatoria inventada
          let fallbackPos = BURGOS_CENTER;
          const searchStr = ((piso.neighborhood || "") + " " + (piso.address || "") + " " + (piso.title || "")).toLowerCase()
          
          for (const [name, coord] of Object.entries(neighborhoodCoords)) {
            if (searchStr.includes(name.toLowerCase())) {
              fallbackPos = coord;
              break;
            }
          }

          // Usamos un micro-desplazamiento basado en ID.
          // Si el piso está geocodificado bien, el offset es mínimo (~10m) para no pisar a vecinos del mismo portal.
          // Si el piso usa el fallback del barrio, el offset es grande (~400m) para dispersarlos visualmente por la zona.
          const randomFunc = seededRandom(piso.id)
          const isGeocoded = !!coordsMap[piso.id]
          const offset = isGeocoded ? 0.0001 : 0.004; 
          
          const pos: [number, number] = isGeocoded 
            ? [coordsMap[piso.id][0] + (randomFunc() - 0.5) * offset, coordsMap[piso.id][1] + (randomFunc() - 0.5) * offset]
            : [fallbackPos[0] + (randomFunc() - 0.5) * offset, fallbackPos[1] + (randomFunc() - 0.5) * offset]

          return (
            <PropertyMarker 
              key={piso.id} 
              piso={piso} 
              pos={pos} 
              icon={createPriceIcon(0)} // createPriceIcon se llama dentro de PropertyMarker ahora con el precio correcto
              selectedPropertyId={selectedPropertyId}
            />
          )
        })}
      </MapContainer>
    </div>
  )
}
