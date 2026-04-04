'use client'

import { useState, useMemo, useEffect } from 'react'
import { MapPin, BedDouble, Scaling, ArrowRight, List, MapIcon, Heart, Search, TrendingDown, TrendingUp, Calendar, ChevronDown, ChevronUp, Filter as FilterIcon, X, EyeOff, LayoutGrid, Euro, Info, SlidersHorizontal } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import dynamic from 'next/dynamic'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

const Map = dynamic(() => import('./Map'), { ssr: false })

export default function ClientDashboard({ properties }: { properties: any[] }) {
  const [view, setView] = useState<'list' | 'map'>('list')
  const [favorites, setFavorites] = useState<string[]>([])
  const [showOnlyFavs, setShowOnlyFavs] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  
  // Filtros Avanzados
  const [includeText, setIncludeText] = useState('')
  const [excludeText, setExcludeText] = useState('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [minSize, setMinSize] = useState<string>('')
  const [minRooms, setMinRooms] = useState<string>('')

  const [expandedPrices, setExpandedPrices] = useState<string[]>([])

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    )
  }

  const toggleExpandPrice = (id: string) => {
    setExpandedPrices(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    )
  }

  const filteredProperties = useMemo(() => {
    let results = [...properties]
    if (showOnlyFavs) results = results.filter(p => favorites.includes(p.id))
    if (includeText.trim()) {
      const words = includeText.split(',').map(w => w.trim().toLowerCase()).filter(w => w !== '')
      if (words.length > 0) {
        results = results.filter(p => {
          const content = ((p.title || "") + " " + (p.address || "") + " " + (p.neighborhood || "") + " " + (p.advertiser || "")).toLowerCase()
          return words.some(word => content.includes(word))
        })
      }
    }
    if (excludeText.trim()) {
      const words = excludeText.split(',').map(w => w.trim().toLowerCase()).filter(w => w !== '')
      if (words.length > 0) {
        results = results.filter(p => {
          const content = ((p.title || "") + " " + (p.address || "") + " " + (p.neighborhood || "") + " " + (p.advertiser || "")).toLowerCase()
          return !words.some(word => content.includes(word))
        })
      }
    }
    results = results.filter(p => {
      const hist = [...(p.price_history || [])].sort((a,b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      const currentPrice = hist[0]?.price || 0
      const priceMatch = maxPrice === '' || currentPrice <= Number(maxPrice)
      const sizeMatch = minSize === '' || (p.size_m2 || 0) >= Number(minSize)
      const roomsMatch = minRooms === '' || (p.rooms || 0) >= Number(minRooms)
      return priceMatch && sizeMatch && roomsMatch
    })
    return results
  }, [properties, showOnlyFavs, favorites, includeText, excludeText, maxPrice, minSize, minRooms])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      
      {/* CONTADOR FLOTANTE (Esquina inferior derecha) */}
      <div className="fixed bottom-8 right-8 z-[200] pointer-events-none">
        <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 border border-slate-700 pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-sm font-black tracking-widest">{filteredProperties.length} <span className="text-slate-400 font-bold ml-1 uppercase text-[10px]">Chozas</span></span>
        </div>
      </div>

      {/* HEADER PRINCIPAL */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-[100] py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-2xl shadow-lg shadow-blue-200">
              <LayoutGrid className="text-white w-6 h-6" />
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">BuscaChozas</h1>
              <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md tracking-widest">v1.0.10</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-2 ${showFilters ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200' : 'bg-white text-slate-600 border-slate-100 hover:border-slate-200 shadow-sm'}`}
            >
              <SlidersHorizontal className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-wider hidden sm:block">Filtros</span>
            </button>
            <button 
              onClick={() => setShowOnlyFavs(!showOnlyFavs)}
              className={`p-3 rounded-2xl border-2 transition-all ${showOnlyFavs ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-inner' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 shadow-sm'}`}
            >
              <Heart className={`w-5 h-5 ${showOnlyFavs ? 'fill-rose-600' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* PANEL DE FILTROS DESPLEGABLE */}
      {showFilters && (
        <div className="bg-white border-b border-slate-200 animate-in slide-in-from-top duration-300 z-[90]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Configuración de Búsqueda</h2>
              <button onClick={() => setShowFilters(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Incluir palabras (casa, terraza...)</label>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  <input 
                    type="text" 
                    placeholder="Escribe palabras separadas por comas"
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-emerald-400 outline-none transition-all text-black"
                    value={includeText}
                    onChange={(e) => setIncludeText(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Omitir palabras (particular, urge...)</label>
                <div className="relative group">
                  <EyeOff className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400" />
                  <input 
                    type="text" 
                    placeholder="Escribe palabras separadas por comas"
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rose-400 outline-none transition-all text-black"
                    value={excludeText}
                    onChange={(e) => setExcludeText(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Euro className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase">Precio Máx</span>
                </div>
                <input type="number" placeholder="300000" className="w-24 bg-transparent text-right font-black text-sm text-slate-800 outline-none" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Scaling className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase">Mín m²</span>
                </div>
                <input type="number" placeholder="100" className="w-16 bg-transparent text-right font-black text-sm text-slate-800 outline-none" value={minSize} onChange={(e) => setMinSize(e.target.value)} />
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BedDouble className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase">Mín Hab</span>
                </div>
                <input type="number" placeholder="3" className="w-12 bg-transparent text-right font-black text-sm text-slate-800 outline-none" value={minRooms} onChange={(e) => setMinRooms(e.target.value)} />
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <button 
                onClick={() => {setIncludeText(''); setExcludeText(''); setMaxPrice(''); setMinSize(''); setMinRooms(''); setShowOnlyFavs(false)}}
                className="text-[10px] font-black text-blue-600 hover:text-blue-800 underline uppercase tracking-widest"
              >
                Limpiar todos los filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELECTOR DE VISTA CENTRALIZADO */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8">
        <div className="flex bg-slate-200/60 rounded-full p-1.5 w-full sm:w-fit mx-auto sm:mx-0 shadow-inner">
          <button 
            onClick={() => setView('list')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-10 py-3 rounded-full text-[10px] sm:text-xs font-black tracking-widest transition-all duration-300 ${view === 'list' ? 'bg-white text-blue-700 shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <List className="w-4 h-4" /> LISTADO
          </button>
          <button 
            onClick={() => setView('map')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-10 py-3 rounded-full text-[10px] sm:text-xs font-black tracking-widest transition-all duration-300 ${view === 'map' ? 'bg-white text-blue-700 shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <MapIcon className="w-4 h-4" /> MAPA
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        {view === 'map' ? (
          <div className="animate-in fade-in zoom-in-95 duration-700 bg-white p-4 rounded-[48px] shadow-2xl border border-slate-100 w-full">
            <Map properties={filteredProperties} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 pb-24">
            {filteredProperties.length === 0 && (
              <div className="col-span-full py-48 text-center bg-white rounded-[60px] border-4 border-dashed border-slate-100 shadow-inner flex flex-col items-center justify-center">
                <div className="bg-slate-50 p-10 rounded-full mb-8 shadow-sm">
                  <FilterIcon className="w-20 h-20 text-slate-200" />
                </div>
                <p className="text-slate-400 text-3xl font-black italic tracking-tighter">Ninguna choza encaja...</p>
                <button 
                  onClick={() => setShowFilters(true)}
                  className="mt-8 px-10 py-4 bg-slate-900 text-white rounded-[24px] font-black text-xs tracking-[0.2em] hover:bg-blue-600 transition-all shadow-2xl shadow-slate-200 uppercase"
                >
                  Ajustar Filtros
                </button>
              </div>
            )}
            
            {filteredProperties.map((piso) => {
              const isFav = favorites.includes(piso.id)
              const isExpanded = expandedPrices.includes(piso.id)
              const sortedHist = [...(piso.price_history || [])].sort((a,b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
              const currentPrice = sortedHist.length > 0 ? sortedHist[sortedHist.length-1].price : 0
              const lastPrice = sortedHist.length > 1 ? sortedHist[sortedHist.length-2].price : currentPrice
              const diff = currentPrice - lastPrice

              return (
                <div key={piso.id} className="bg-white rounded-3xl sm:rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col relative group sm:hover:-translate-y-2 transition-all duration-300 ease-out">
                  <button onClick={() => toggleFavorite(piso.id)} className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-3 sm:p-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-100 hover:scale-110 active:scale-90 transition-all">
                    <Heart className={`w-5 h-5 sm:w-6 sm:h-6 ${isFav ? 'fill-rose-600 text-rose-600' : 'text-slate-300 group-hover:text-rose-400'}`} />
                  </button>

                  <div className="p-6 sm:p-8 flex-grow">
                    <div className="flex justify-between items-center mb-4 pr-12 sm:pr-16">
                      <span className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] bg-slate-900 text-white shadow-md shadow-slate-300">{piso.type || 'Choza'}</span>
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-slate-100 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-2xl border border-slate-200">
                        {formatDistanceToNow(new Date(piso.last_seen_at), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                    
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-tight mb-3 group-hover:text-blue-700 transition-colors line-clamp-2 min-h-[3rem] tracking-tight">{piso.title}</h3>
                    
                    <div className="flex items-start gap-2 text-slate-500 mb-5 font-bold text-sm">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                      <span className="line-clamp-2">{piso.address} {piso.neighborhood ? `· ${piso.neighborhood}` : ''}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
                      <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 flex items-center gap-3 sm:gap-4 group-hover:bg-white group-hover:border-blue-200 group-hover:shadow-sm transition-all">
                        <div className="bg-white p-2.5 sm:p-3 rounded-xl shadow-sm text-blue-600"><BedDouble className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                        <div><p className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-tighter">Hab</p><p className="text-lg sm:text-xl font-black text-slate-800">{piso.rooms}</p></div>
                      </div>
                      <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 flex items-center gap-3 sm:gap-4 group-hover:bg-white group-hover:border-blue-200 group-hover:shadow-sm transition-all">
                        <div className="bg-white p-2.5 sm:p-3 rounded-xl shadow-sm text-blue-600"><Scaling className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                        <div><p className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-tighter">Área</p><p className="text-lg sm:text-xl font-black text-slate-800">{piso.size_m2}<span className="text-xs font-bold text-slate-500 ml-1">m²</span></p></div>
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-3xl sm:rounded-[36px] p-6 sm:p-8 text-white relative overflow-hidden cursor-pointer hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 group/price" onClick={() => toggleExpandPrice(piso.id)}>
                      <div className="flex justify-between items-end relative z-10">
                        <div className="flex-1">
                          <p className="text-[9px] sm:text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-1 sm:mb-2">Precio de Mercado</p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <span className="text-2xl sm:text-3xl font-black tracking-tighter">{currentPrice.toLocaleString('es-ES')}€</span>
                            {diff !== 0 && (
                              <div className={`flex items-center text-[10px] sm:text-xs font-black px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl ${diff < 0 ? 'bg-emerald-600 text-white shadow-md' : 'bg-rose-600 text-white shadow-md'}`}>
                                {diff < 0 ? <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> : <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />}
                                {Math.abs(diff).toLocaleString('es-ES')}€
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="bg-white/10 p-2 sm:p-3 rounded-full backdrop-blur-sm group-hover/price:-translate-y-1 transition-transform ml-2 flex-shrink-0">
                          {isExpanded ? <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300" /> : <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300" />}
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-12 sm:h-16 opacity-40 pointer-events-none">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sortedHist}><Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={4} dot={false} animationDuration={1000} /></LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-2 animate-in slide-in-from-top-4 duration-500">
                        {[...sortedHist].reverse().map((h: any, idx) => (
                          <div key={idx} className="flex justify-between items-center px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 rounded-2xl sm:rounded-[24px] border border-slate-200 hover:border-blue-300 hover:bg-white transition-all shadow-sm group/hist">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">{format(new Date(h.recorded_at), "dd MMMM yyyy", { locale: es })}</span>
                            <span className="text-sm sm:text-base font-black text-slate-800 group-hover/hist:text-blue-700 transition-colors">{h.price.toLocaleString('es-ES')}€</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="px-6 py-5 sm:px-8 sm:py-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group/footer">
                     <div className="flex flex-col flex-1 min-w-0 w-full sm:w-auto">
                       <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Inmobiliaria</span>
                       <span className="text-xs sm:text-sm font-black text-slate-800 truncate w-full tracking-tight">{piso.advertiser || 'Particular'}</span>
                     </div>
                     <a href={piso.url} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto text-center bg-blue-700 hover:bg-blue-800 text-white font-black px-5 py-3.5 sm:px-6 sm:py-4 rounded-2xl text-[10px] sm:text-[11px] tracking-[0.1em] sm:tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-blue-700/30 active:scale-95 hover:shadow-blue-700/50 flex-shrink-0">VER EN PORTAL <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover/footer:translate-x-1 transition-transform" /></a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
