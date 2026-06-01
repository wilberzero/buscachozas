'use client'

import { useState, useMemo, useEffect } from 'react'
import { MapPin, BedDouble, Scaling, ArrowRight, List, MapIcon, Heart, Search, TrendingDown, TrendingUp, Calendar, ChevronDown, ChevronUp, Filter as FilterIcon, X, EyeOff, LayoutGrid, Euro, Info, SlidersHorizontal, Settings, BarChart2, Trash2 } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import dynamic from 'next/dynamic'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LineChart, Line } from 'recharts'
import { createClient } from '@/lib/supabase/client'

const Map = dynamic(() => import('./Map'), { ssr: false })

export default function ClientDashboard({ 
  properties, 
  initialFavorites = [], 
  initialConfig = { scraper_url: '', alert_email: '' } 
}: { 
  properties: any[], 
  initialFavorites?: string[],
  initialConfig?: any
}) {
  const supabase = createClient()
  const [currentTab, setCurrentTab] = useState<'actives' | 'inactives' | 'stats'>('actives')
  const [view, setView] = useState<'list' | 'map'>('list')
  const [favorites, setFavorites] = useState<string[]>(initialFavorites)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [showOnlyFavs, setShowOnlyFavs] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [statsSortBy, setStatsSortBy] = useState<'total-diff-desc' | 'total-diff-asc' | 'last-diff-desc' | 'last-diff-asc' | 'price-asc' | 'price-desc'>('total-diff-desc')
  const [expandedStatsPrices, setExpandedStatsPrices] = useState<string[]>([])
  const [listSortBy, setListSortBy] = useState<'created-desc' | 'price-asc' | 'price-desc' | 'rooms-asc' | 'rooms-desc' | 'size-asc' | 'size-desc'>('created-desc')
  
  // Ajustes de Usuario
  const [config, setConfig] = useState(() => {
    const cfg = { ...initialConfig }
    if (!cfg.scraper_url) {
      cfg.scraper_url = 'https://www.idealista.com/venta-viviendas/burgos-burgos/con-precio-hasta_300000,metros-cuadrados-mas-de_100,de-tres-dormitorios,de-cuatro-cinco-habitaciones-o-mas,dos-banos,tres-banos-o-mas/'
    }
    return cfg
  })
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  // Filtros Avanzados (Solo aplican para activos y de manera general)
  const [includeText, setIncludeText] = useState('')
  const [excludeText, setExcludeText] = useState('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [minSize, setMinSize] = useState<string>('')
  const [minRooms, setMinRooms] = useState<string>('')

  const [expandedPrices, setExpandedPrices] = useState<string[]>([])

  const toggleFavorite = async (id: string) => {
    const isFav = favorites.includes(id)
    
    // Actualización optimista de la UI
    setFavorites(prev => 
      isFav ? prev.filter(fId => fId !== id) : [...prev, id]
    )

    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ propertyId: id, action: isFav ? 'delete' : 'insert' })
      })
      if (!res.ok) {
        throw new Error('Failed to update favorite on server')
      }
    } catch (error) {
      console.error('Error actualizando favoritos:', error)
      // Revertir si falla
      setFavorites(prev => 
        !isFav ? prev.filter(fId => fId !== id) : [...prev, id]
      )
    }
  }

  const saveConfig = async () => {
    setIsSavingConfig(true)
    try {
      await supabase.from('config').upsert({
        id: 1,
        scraper_url: config.scraper_url,
        alert_email: config.alert_email,
        smtp_server: config.smtp_server,
        smtp_port: config.smtp_port,
        smtp_user: config.smtp_user,
        smtp_pass: config.smtp_pass
      })
      setShowSettings(false)
    } catch (error) {
      console.error('Error guardando configuración:', error)
      alert('Error al guardar los ajustes')
    } finally {
      setIsSavingConfig(false)
    }
  }

  const toggleExpandPrice = (id: string) => {
    setExpandedPrices(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    )
  }

  const toggleExpandStatsPrice = (id: string) => {
    setExpandedStatsPrices(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    )
  }

  // Filtrado General de Propiedades
  const allPropertiesParsed = useMemo(() => {
    return properties.map(p => {
      const hist = [...(p.price_history || [])].sort((a,b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      const currentPrice = hist.length > 0 ? hist[hist.length-1].price : 0
      const lastPrice = hist.length > 1 ? hist[hist.length-2].price : currentPrice
      const initialPrice = hist.length > 0 ? hist[0].price : currentPrice
      const priceDiff = currentPrice - lastPrice // Rebaja parcial (último cambio)
      const totalPriceDiff = currentPrice - initialPrice // Rebaja total
      const pricePerM2 = p.size_m2 ? Math.round(currentPrice / p.size_m2) : 0
      return {
        ...p,
        currentPrice,
        lastPrice,
        initialPrice,
        priceDiff,
        totalPriceDiff,
        pricePerM2,
        sortedHist: hist
      }
    })
  }, [properties])

  // Propiedades Activas (Filtradas)
  const filteredActiveProperties = useMemo(() => {
    let results = allPropertiesParsed.filter(p => p.active)
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
      const priceMatch = maxPrice === '' || p.currentPrice <= Number(maxPrice)
      const sizeMatch = minSize === '' || (p.size_m2 || 0) >= Number(minSize)
      const roomsMatch = minRooms === '' || (p.rooms || 0) >= Number(minRooms)
      return priceMatch && sizeMatch && roomsMatch
    })

    // Aplicar ordenación al listado principal
    if (listSortBy === 'created-desc') {
      // Orden predeterminado (por fecha de creación)
    } else if (listSortBy === 'price-asc') {
      results.sort((a, b) => a.currentPrice - b.currentPrice)
    } else if (listSortBy === 'price-desc') {
      results.sort((a, b) => b.currentPrice - a.currentPrice)
    } else if (listSortBy === 'rooms-asc') {
      results.sort((a, b) => (a.rooms || 0) - (b.rooms || 0))
    } else if (listSortBy === 'rooms-desc') {
      results.sort((a, b) => (b.rooms || 0) - (a.rooms || 0))
    } else if (listSortBy === 'size-asc') {
      results.sort((a, b) => (a.size_m2 || 0) - (b.size_m2 || 0))
    } else if (listSortBy === 'size-desc') {
      results.sort((a, b) => (b.size_m2 || 0) - (a.size_m2 || 0))
    }

    return results
  }, [allPropertiesParsed, showOnlyFavs, favorites, includeText, excludeText, maxPrice, minSize, minRooms, listSortBy])

  // Propiedades Inactivas (Bajas)
  const inactiveProperties = useMemo(() => {
    return allPropertiesParsed
      .filter(p => !p.active)
      .sort((a, b) => {
        const dateA = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0
        const dateB = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0
        return dateB - dateA
      })
  }, [allPropertiesParsed])

  // --- ESTADÍSTICAS Y MÉTRICAS DE MERCADO ---
  const marketStats = useMemo(() => {
    const actives = allPropertiesParsed.filter(p => p.active)
    if (actives.length === 0) return null

    const totalActives = actives.length
    const totalPrice = actives.reduce((sum, p) => sum + p.currentPrice, 0)
    const avgPrice = Math.round(totalPrice / totalActives)

    const flatsWithSize = actives.filter(p => p.size_m2 && p.size_m2 > 0)
    const avgSize = flatsWithSize.length > 0 ? Math.round(flatsWithSize.reduce((sum, p) => sum + p.size_m2, 0) / flatsWithSize.length) : 0
    
    const flatsWithPricePerM2 = actives.filter(p => p.pricePerM2 && p.pricePerM2 > 0)
    const avgPricePerM2 = flatsWithPricePerM2.length > 0 ? Math.round(flatsWithPricePerM2.reduce((sum, p) => sum + p.pricePerM2, 0) / flatsWithPricePerM2.length) : 0

    // Distribución y Precio/m2 por Barrio (Neighborhood)
    const neighborhoodDataMap: Record<string, { count: number; totalPricePerM2: number; countForM2: number; avgPricePerM2: number }> = {}
    actives.forEach(p => {
      const neighborhood = p.neighborhood || 'Otros'
      if (!neighborhoodDataMap[neighborhood]) {
        neighborhoodDataMap[neighborhood] = { count: 0, totalPricePerM2: 0, countForM2: 0, avgPricePerM2: 0 }
      }
      neighborhoodDataMap[neighborhood].count += 1
      if (p.pricePerM2 > 0) {
        neighborhoodDataMap[neighborhood].totalPricePerM2 += p.pricePerM2
        neighborhoodDataMap[neighborhood].countForM2 += 1
      }
    })

    const neighborhoodChartData = Object.entries(neighborhoodDataMap).map(([name, data]) => ({
      name,
      cantidad: data.count,
      precioM2: data.countForM2 > 0 ? Math.round(data.totalPricePerM2 / data.countForM2) : 0
    })).sort((a, b) => b.cantidad - a.cantidad)

    // Historial de cambios de precio
    const priceDrops = actives.filter(p => p.priceDiff < 0).length
    const priceIncreases = actives.filter(p => p.priceDiff > 0).length

    return {
      totalActives,
      avgPrice,
      avgSize,
      avgPricePerM2,
      priceDrops,
      priceIncreases,
      neighborhoodChartData,
      totalBajas: inactiveProperties.length
    }
  }, [allPropertiesParsed, inactiveProperties])

  // Variaciones de precios ordenadas para estadísticas
  const sortedVariations = useMemo(() => {
    const variations = allPropertiesParsed.filter(p => p.active && p.sortedHist.length > 1)
    
    return [...variations].sort((a, b) => {
      if (statsSortBy === 'total-diff-desc') {
        return a.totalPriceDiff - b.totalPriceDiff // Mayor rebaja total primero (más negativo)
      } else if (statsSortBy === 'total-diff-asc') {
        return b.totalPriceDiff - a.totalPriceDiff // Menor rebaja total primero
      } else if (statsSortBy === 'last-diff-desc') {
        return a.priceDiff - b.priceDiff // Mayor rebaja parcial primero (más negativo)
      } else if (statsSortBy === 'last-diff-asc') {
        return b.priceDiff - a.priceDiff // Menor rebaja parcial primero
      } else if (statsSortBy === 'price-asc') {
        return a.currentPrice - b.currentPrice
      } else {
        return b.currentPrice - a.currentPrice
      }
    })
  }, [allPropertiesParsed, statsSortBy])

  // Datos para los gráficos de tendencias (Evolución de precios e €/m2)
  const trendsChartData = useMemo(() => {
    const actives = allPropertiesParsed.filter(p => p.active)
    const datePriceMap: Record<string, { sumPrice: number; sumM2Price: number; count: number }> = {}

    actives.forEach(p => {
      p.sortedHist.forEach((h: any) => {
        const dateKey = format(new Date(h.recorded_at), 'yyyy-MM-dd')
        if (!datePriceMap[dateKey]) {
          datePriceMap[dateKey] = { sumPrice: 0, sumM2Price: 0, count: 0 }
        }
        datePriceMap[dateKey].sumPrice += h.price
        if (p.size_m2 > 0) {
          datePriceMap[dateKey].sumM2Price += (h.price / p.size_m2)
        }
        datePriceMap[dateKey].count += 1
      })
    })

    return Object.entries(datePriceMap).map(([date, data]) => ({
      fecha: format(new Date(date), 'dd MMM', { locale: es }),
      rawDate: date,
      precioMedio: Math.round(data.sumPrice / data.count),
      precioM2Medio: Math.round(data.sumM2Price / data.count)
    })).sort((a, b) => a.rawDate.localeCompare(b.rawDate))
  }, [allPropertiesParsed])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      
      {/* CONTADOR FLOTANTE (Esquina inferior derecha) */}
      <div className="fixed bottom-8 right-8 z-[200] pointer-events-none">
        <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 border border-slate-700 pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-sm font-black tracking-widest">
            {currentTab === 'actives' ? filteredActiveProperties.length : currentTab === 'inactives' ? inactiveProperties.length : properties.length} 
            <span className="text-slate-400 font-bold ml-1 uppercase text-[10px]">
              {currentTab === 'actives' ? 'Activas' : currentTab === 'inactives' ? 'Bajas' : 'Total'}
            </span>
          </span>
        </div>
      </div>

      {/* HEADER PRINCIPAL */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-[100] py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-2xl shadow-lg shadow-blue-200">
              <LayoutGrid className="text-white w-6 h-6" />
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">BuscaChozas</h1>
              <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md tracking-widest">v1.3.2</span>
            </div>
          </div>
          
          {/* TABS DE NAVEGACIÓN */}
          <div className="flex bg-slate-100 rounded-2xl p-1 shadow-inner border border-slate-200/50">
            <button 
              onClick={() => setCurrentTab('actives')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wider transition-all ${currentTab === 'actives' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Viviendas
            </button>
            <button 
              onClick={() => setCurrentTab('inactives')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wider transition-all ${currentTab === 'inactives' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Trash2 className="w-3.5 h-3.5" /> Bajas
            </button>
            <button 
              onClick={() => setCurrentTab('stats')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wider transition-all ${currentTab === 'stats' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <BarChart2 className="w-3.5 h-3.5" /> Estadísticas
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-3 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200 text-slate-500 hover:text-slate-800"
              title="Configuración"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            {currentTab === 'actives' && (
              <button 
                onClick={() => setShowFilters(true)}
                className={`flex items-center gap-2 px-5 py-3 border rounded-2xl font-black text-xs tracking-wider transition-all ${showFilters || includeText || excludeText || maxPrice || minSize || minRooms ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-lg shadow-blue-500/5' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                <SlidersHorizontal className="w-4 h-4" /> FILTROS
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MODAL DE FILTROS */}
      {showFilters && currentTab === 'actives' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl border border-slate-100 max-w-2xl w-full overflow-hidden p-6 sm:p-8 animate-in zoom-in-95 duration-200 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800">Filtros Avanzados</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Refina las viviendas activas</p>
              </div>
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
            
            <div className="flex justify-between items-center pt-4">
              <button 
                onClick={() => {
                  setIncludeText('')
                  setExcludeText('')
                  setMaxPrice('')
                  setMinSize('')
                  setMinRooms('')
                  setShowOnlyFavs(false)
                }}
                className="text-[10px] font-black text-rose-600 hover:text-rose-800 underline uppercase tracking-widest"
              >
                Limpiar filtros
              </button>
              <button 
                onClick={() => setShowFilters(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-SELECTOR DE VISTA PARA ACTIVOS (LISTADO / MAPA) */}
      {currentTab === 'actives' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex bg-slate-200/60 rounded-full p-1.5 w-full sm:w-fit shadow-inner">
              <button 
                onClick={() => setView('list')}
                className={`flex-grow sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-8 py-2.5 rounded-full text-[10px] font-black tracking-widest transition-all duration-300 ${view === 'list' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <List className="w-3.5 h-3.5" /> LISTADO
              </button>
              <button 
                onClick={() => setView('map')}
                className={`flex-grow sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-8 py-2.5 rounded-full text-[10px] font-black tracking-widest transition-all duration-300 ${view === 'map' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <MapIcon className="w-3.5 h-3.5" /> MAPA
              </button>
            </div>

            {/* Favoritos y Ordenación Toggle */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Selector de ordenación del listado principal */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-full shadow-sm text-xs font-bold text-slate-700">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Ordenar:</span>
                <select 
                  value={listSortBy} 
                  onChange={(e: any) => setListSortBy(e.target.value)} 
                  className="bg-transparent border-none outline-none font-black text-blue-755 text-[10px] uppercase tracking-wider cursor-pointer"
                >
                  <option value="created-desc">Más Recientes</option>
                  <option value="price-asc">Precio: Menor a Mayor</option>
                  <option value="price-desc">Precio: Mayor a Menor</option>
                  <option value="rooms-asc">Habitaciones: Menor a Mayor</option>
                  <option value="rooms-desc">Habitaciones: Mayor a Menor</option>
                  <option value="size-asc">Superficie: Menor a Mayor</option>
                  <option value="size-desc">Superficie: Mayor a Menor</option>
                </select>
              </div>

              <button 
                onClick={() => setShowOnlyFavs(!showOnlyFavs)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-[10px] tracking-widest border transition-all ${showOnlyFavs ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-800'}`}
              >
                <Heart className={`w-3.5 h-3.5 ${showOnlyFavs ? 'fill-rose-600 text-rose-600' : 'text-slate-400'}`} /> VER SOLO FAVORITOS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        
        {/* TABA DE PROPIEDADES ACTIVAS */}
        {currentTab === 'actives' && (
          view === 'map' ? (
            <div className="animate-in fade-in zoom-in-95 duration-500 bg-white p-4 rounded-[48px] shadow-2xl border border-slate-100 w-full">
              <Map 
                properties={filteredActiveProperties} 
                selectedPropertyId={selectedPropertyId}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 pb-24">
              {filteredActiveProperties.length === 0 && (
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
              
              {filteredActiveProperties.map((piso) => {
                const isFav = favorites.includes(piso.id)
                const isExpanded = expandedPrices.includes(piso.id)

                return (
                  <div key={piso.id} className="bg-white rounded-3xl sm:rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col relative group sm:hover:-translate-y-2 transition-all duration-300 ease-out">
                    <button onClick={() => toggleFavorite(piso.id)} className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-3 sm:p-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-100 hover:scale-110 active:scale-90 transition-all">
                      <Heart className={`w-5 h-5 sm:w-6 sm:h-6 ${isFav ? 'fill-rose-600 text-rose-600' : 'text-slate-300 group-hover:text-rose-400'}`} />
                    </button>

                    {/* Badges de Estado (Esquina Superior Izquierda) */}
                    <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 flex flex-col gap-2 pointer-events-none">
                      {piso.priceDiff !== 0 && (
                        <div className={`px-3 py-1.5 rounded-xl text-[8px] sm:text-[9px] font-black tracking-widest shadow-md flex items-center gap-1 w-fit ${piso.priceDiff < 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                          {piso.priceDiff < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                          {piso.priceDiff < 0 ? 'REBAJADO' : 'SUBIDO'} {Math.abs(piso.priceDiff).toLocaleString('es-ES')}€
                        </div>
                      )}
                      <div className="bg-slate-900/75 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-[8px] font-black tracking-widest shadow-sm flex items-center gap-1 w-fit border border-slate-700/50">
                        <Calendar className="w-2.5 h-2.5 text-blue-400" />
                        REVISADO {piso.last_seen_at ? formatDistanceToNow(new Date(piso.last_seen_at), { addSuffix: true, locale: es }).toUpperCase() : 'HOY'}
                      </div>
                    </div>

                    <div className="p-6 sm:p-8 pt-16 sm:pt-20 flex-grow space-y-6">
                      <div className="space-y-2">
                        <span className="inline-block text-[9px] font-black tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">
                          {piso.type || 'Piso'}
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-slate-800 leading-snug tracking-tight group-hover:text-blue-700 transition-colors">
                          {piso.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                        <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <span className="text-xs font-bold truncate leading-none">
                          {piso.address} {piso.neighborhood && `(${piso.neighborhood})`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <BedDouble className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Habitaciones</span>
                            <span className="text-xs font-black text-slate-800 mt-1">{piso.rooms || 'N/D'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <Scaling className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Superficie</span>
                            <span className="text-xs font-black text-slate-800 mt-1">{piso.size_m2 ? `${Math.round(piso.size_m2)} m²` : 'N/D'}</span>
                          </div>
                        </div>
                      </div>

                      {/* AREA DE PRECIO Y DESPLIEGUE DE HISTÓRICO */}
                      <div className="space-y-4">
                        <div 
                          onClick={() => toggleExpandPrice(piso.id)} 
                          className="flex justify-between items-end bg-slate-50 hover:bg-slate-100/80 p-4 sm:p-5 rounded-3xl border-2 border-slate-100/50 cursor-pointer transition-all active:scale-[0.98]"
                        >
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Precio Actual</span>
                            <span className="text-lg sm:text-2xl font-black text-slate-800 leading-none mt-1.5 flex items-baseline">
                              {piso.currentPrice.toLocaleString('es-ES')}€
                              {piso.pricePerM2 > 0 && (
                                <span className="text-[9px] font-bold text-slate-400 ml-1.5 tracking-normal">
                                  ({piso.pricePerM2.toLocaleString('es-ES')}€/m²)
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest">
                            <span>HISTORIAL</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-4 sm:p-6 space-y-3 animate-in slide-in-from-top-4 duration-300">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100/80">Línea de Tiempo de Cambios</h4>
                            {piso.sortedHist.map((h: any, idx: number) => {
                              const isOriginal = idx === 0
                              return (
                                <div key={h.recorded_at} className="flex justify-between items-center py-2 px-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-100 transition-all">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                      {format(new Date(h.recorded_at), "dd MMMM yyyy", { locale: es })}
                                    </span>
                                    {isOriginal && <span className="text-[8px] font-bold text-blue-600 uppercase mt-0.5">Precio Inicial</span>}
                                    {!isOriginal && <span className="text-[8px] font-bold text-emerald-600 uppercase mt-0.5">Cambio detectado</span>}
                                  </div>
                                  <span className={`text-sm sm:text-base font-black ${isOriginal ? 'text-slate-600' : 'text-slate-900'}`}>
                                    {h.price.toLocaleString('es-ES')}€
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="px-6 py-5 sm:px-8 sm:py-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group/footer">
                       <div className="flex flex-col flex-1 min-w-0 w-full sm:w-auto">
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Anunciante</span>
                         <span className="text-xs sm:text-sm font-black text-slate-800 truncate w-full tracking-tight">{piso.advertiser || 'Particular'}</span>
                       </div>
                       <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
                         <button 
                           onClick={() => {
                             setSelectedPropertyId(piso.id)
                             setView('map')
                             window.scrollTo({ top: 0, behavior: 'smooth' })
                           }}
                           className="flex-1 sm:flex-none text-center bg-white hover:bg-slate-50 text-blue-700 border-2 border-blue-600 font-black px-4 py-3 sm:px-5 sm:py-4 rounded-2xl text-[10px] sm:text-[11px] tracking-[0.1em] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 flex-shrink-0"
                         >
                           <MapPin className="w-3.5 h-3.5" /> VER MAPA
                         </button>
                         <a 
                           href={piso.url} 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           className="flex-1 sm:flex-none text-center bg-blue-700 hover:bg-blue-800 text-white font-black px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl text-[10px] sm:text-[11px] tracking-[0.1em] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-blue-700/20 flex-shrink-0"
                         >
                           PORTAL <ArrowRight className="w-3.5 h-3.5 group-hover/footer:translate-x-1 transition-transform" />
                         </a>
                       </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* TAB DE PROPIEDADES INACTIVAS (LISTADO DE BAJAS) */}
        {currentTab === 'inactives' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-rose-800 text-lg font-black tracking-tight">Registro Histórico de Bajas</h3>
                <p className="text-xs text-rose-600 font-bold mt-1 uppercase tracking-wider">Inmuebles que ya han sido vendidos o retirados de Idealista</p>
              </div>
              <div className="bg-rose-500 text-white font-black px-5 py-2.5 rounded-full text-xs tracking-widest">
                {inactiveProperties.length} VIVIVENDAS VENDIDAS
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 pb-24">
              {inactiveProperties.length === 0 ? (
                <div className="col-span-full py-48 text-center bg-white rounded-[60px] border-4 border-dashed border-slate-100 shadow-inner flex flex-col items-center justify-center">
                  <Trash2 className="w-20 h-20 text-slate-200 mb-8 animate-bounce" />
                  <p className="text-slate-400 text-3xl font-black italic tracking-tighter">No hay bajas registradas todavía...</p>
                </div>
              ) : (
                inactiveProperties.map((piso) => {
                  const isExpanded = expandedPrices.includes(piso.id)
                  return (
                    <div key={piso.id} className="bg-white rounded-3xl sm:rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col relative opacity-85 group sm:hover:opacity-100 transition-all duration-300">
                      
                      {/* Badge de Baja */}
                      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 px-4 py-2 rounded-2xl text-[9px] font-black tracking-widest shadow-md flex items-center gap-1 bg-slate-500 text-white">
                        <Trash2 className="w-3.5 h-3.5" /> FUERA DE MERCADO
                      </div>

                      <div className="p-6 sm:p-8 pt-16 sm:pt-20 flex-grow space-y-6">
                        <div className="space-y-2 pt-6">
                          <span className="inline-block text-[9px] font-black tracking-widest text-slate-600 bg-slate-100 px-3 py-1 rounded-full uppercase">
                            {piso.type || 'Piso'}
                          </span>
                          <h3 className="text-base sm:text-lg font-black text-slate-600 leading-snug tracking-tight">
                            {piso.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 text-slate-400">
                          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="text-xs font-bold truncate leading-none">
                            {piso.address} {piso.neighborhood && `(${piso.neighborhood})`}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                              <BedDouble className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Habitaciones</span>
                              <span className="text-xs font-black text-slate-600 mt-1">{piso.rooms || 'N/D'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                              <Scaling className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Superficie</span>
                              <span className="text-xs font-black text-slate-600 mt-1">{piso.size_m2 ? `${Math.round(piso.size_m2)} m²` : 'N/D'}</span>
                            </div>
                          </div>
                        </div>

                        {/* PRECIO FINAL REGISTRADO */}
                        <div className="space-y-4">
                          <div 
                            onClick={() => toggleExpandPrice(piso.id)} 
                            className="flex justify-between items-end bg-slate-50 hover:bg-slate-100 p-4 sm:p-5 rounded-3xl border-2 border-slate-100/50 cursor-pointer transition-all active:scale-[0.98]"
                          >
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Último Precio</span>
                              <span className="text-lg sm:text-2xl font-black text-slate-500 leading-none mt-1.5 flex items-baseline">
                                {piso.currentPrice.toLocaleString('es-ES')}€
                                {piso.pricePerM2 > 0 && (
                                  <span className="text-[9px] font-bold text-slate-400 ml-1.5 tracking-normal">
                                    ({piso.pricePerM2.toLocaleString('es-ES')}€/m²)
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              <span>HISTORIAL</span>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-4 sm:p-6 space-y-3 animate-in slide-in-from-top-4 duration-300">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100/80">Historial de Precios</h4>
                              {piso.sortedHist.map((h: any, idx: number) => {
                                const isOriginal = idx === 0
                                return (
                                  <div key={h.recorded_at} className="flex justify-between items-center py-2 px-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-100 transition-all">
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        {format(new Date(h.recorded_at), "dd MMMM yyyy", { locale: es })}
                                      </span>
                                      {isOriginal && <span className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">Precio Inicial</span>}
                                      {!isOriginal && <span className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">Cambio</span>}
                                    </div>
                                    <span className="text-sm font-black text-slate-600">
                                      {h.price.toLocaleString('es-ES')}€
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="px-6 py-5 sm:px-8 sm:py-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                         <div className="flex flex-col flex-1 min-w-0 w-full">
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Visto por última vez</span>
                           <span className="text-xs font-black text-slate-600 truncate tracking-tight">
                             {piso.last_seen_at ? formatDistanceToNow(new Date(piso.last_seen_at), { addSuffix: true, locale: es }) : 'Desconocido'}
                           </span>
                         </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* TAB DE ESTADÍSTICAS Y GRÁFICOS */}
        {currentTab === 'stats' && (
          <div className="space-y-10 animate-in fade-in duration-500 pb-24">
            {marketStats ? (
              <>
                {/* 1. CARTAS DE MÉTRICAS (KPIs) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  <div className="bg-white p-6 rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-200 flex items-center justify-between group hover:border-blue-400 transition-colors">
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio Promedio</span>
                      <h4 className="text-xl sm:text-2xl font-black text-slate-800">{marketStats.avgPrice.toLocaleString('es-ES')}€</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">De viviendas activas</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform">
                      <Euro className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-200 flex items-center justify-between group hover:border-emerald-400 transition-colors">
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio por m²</span>
                      <h4 className="text-xl sm:text-2xl font-black text-slate-850">{marketStats.avgPricePerM2.toLocaleString('es-ES')}€</h4>
                      <p className="text-[9px] text-emerald-600 font-black uppercase">Promedio del mercado</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                      <Scaling className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-200 flex items-center justify-between group hover:border-indigo-400 transition-colors">
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tamaño Promedio</span>
                      <h4 className="text-xl sm:text-2xl font-black text-slate-800">{marketStats.avgSize} m²</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Superficie útil media</p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                      <LayoutGrid className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-200 flex items-center justify-between group hover:border-rose-400 transition-colors">
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chozas Vendidas (Bajas)</span>
                      <h4 className="text-xl sm:text-2xl font-black text-slate-800">{marketStats.totalBajas}</h4>
                      <p className="text-[9px] text-rose-600 font-black uppercase">Excluidas del mercado</p>
                    </div>
                    <div className="bg-rose-50 p-4 rounded-2xl text-rose-600 group-hover:scale-110 transition-transform">
                      <Trash2 className="w-6 h-6" />
                    </div>
                  </div>

                </div>

                {/* 2. GRÁFICOS INTERACTIVOS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  
                  {/* Gráfico 1: Viviendas Activas por Barrio */}
                  <div className="bg-white p-6 sm:p-8 rounded-[40px] shadow-2xl border border-slate-100 flex flex-col space-y-6">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">Viviendas Activas por Barrio</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Volumen de oferta actual en Burgos</p>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={marketStats.neighborhoodChartData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }} 
                            cursor={{ fill: '#f8fafc' }}
                          />
                          <Bar dataKey="cantidad" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                            {marketStats.neighborhoodChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#1d4ed8' : '#3b82f6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Gráfico 2: Precio/m² por Barrio */}
                  <div className="bg-white p-6 sm:p-8 rounded-[40px] shadow-2xl border border-slate-100 flex flex-col space-y-6">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">Precio del Metro Cuadrado por Barrio</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Comparativa de valor del suelo (€/m²)</p>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={marketStats.neighborhoodChartData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} tickFormatter={(v) => v.slice(0, 12)} />
                          <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} unit="€" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                            formatter={(v) => [v !== undefined ? `${Number(v).toLocaleString('es-ES')} €/m²` : '', 'Precio m²']}
                            cursor={{ fill: '#f8fafc' }}
                          />
                          <Bar dataKey="precioM2" fill="#10b981" radius={[8, 8, 0, 0]}>
                            {marketStats.neighborhoodChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#047857' : '#10b981'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>

                {/* 2.5. GRÁFICOS DE EVOLUCIÓN HISTÓRICA */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  
                  {/* Evolución del Precio Medio */}
                  <div className="bg-white p-6 sm:p-8 rounded-[40px] shadow-2xl border border-slate-100 flex flex-col space-y-6">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">Evolución de Precio Promedio</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Tendencia histórica del precio promedio de viviendas actuales</p>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendsChartData} margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="fecha" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} unit="€" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                            formatter={(v) => [v !== undefined ? `${Number(v).toLocaleString('es-ES')} €` : '', 'Precio Medio']}
                          />
                          <Line type="monotone" dataKey="precioMedio" stroke="#3b82f6" strokeWidth={4} activeDot={{ r: 8 }} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Evolución del Precio del m² */}
                  <div className="bg-white p-6 sm:p-8 rounded-[40px] shadow-2xl border border-slate-100 flex flex-col space-y-6">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">Evolución del m² (€/m²)</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Tendencia histórica del valor del metro cuadrado</p>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendsChartData} margin={{ top: 20, right: 20, left: -10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="fecha" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} unit="€" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '16px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                            formatter={(v) => [v !== undefined ? `${Number(v).toLocaleString('es-ES')} €/m²` : '', 'm² Medio']}
                          />
                          <Line type="monotone" dataKey="precioM2Medio" stroke="#10b981" strokeWidth={4} activeDot={{ r: 8 }} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>

                {/* 3. EVOLUCIÓN HISTÓRICA & REBAJAS */}
                <div className="bg-white p-6 sm:p-8 rounded-[40px] shadow-2xl border border-slate-100">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">Oportunidades y Rebajas</h3>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Viviendas que han bajado o cambiado de precio en Burgos</p>
                    </div>
                    
                    {/* Controles de Ordenación Avanzados */}
                    <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 text-xs font-bold w-full md:w-auto">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">Ordenar por:</span>
                      
                      <button 
                        onClick={() => setStatsSortBy(statsSortBy === 'price-asc' ? 'price-desc' : 'price-asc')}
                        className={`px-3 py-2 rounded-xl text-[9px] font-black tracking-wider transition-all flex items-center gap-1.5 ${statsSortBy.startsWith('price') ? 'bg-white text-blue-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        PRECIO {statsSortBy === 'price-asc' ? '↑' : statsSortBy === 'price-desc' ? '↓' : ''}
                      </button>

                      <button 
                        onClick={() => setStatsSortBy(statsSortBy === 'last-diff-desc' ? 'last-diff-asc' : 'last-diff-desc')}
                        className={`px-3 py-2 rounded-xl text-[9px] font-black tracking-wider transition-all flex items-center gap-1.5 ${statsSortBy.startsWith('last-diff') ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        REBAJA PARCIAL {statsSortBy === 'last-diff-desc' ? '↓' : statsSortBy === 'last-diff-asc' ? '↑' : ''}
                      </button>

                      <button 
                        onClick={() => setStatsSortBy(statsSortBy === 'total-diff-desc' ? 'total-diff-asc' : 'total-diff-desc')}
                        className={`px-3 py-2 rounded-xl text-[9px] font-black tracking-wider transition-all flex items-center gap-1.5 ${statsSortBy.startsWith('total-diff') ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        REBAJA TOTAL {statsSortBy === 'total-diff-desc' ? '↓' : statsSortBy === 'total-diff-asc' ? '↑' : ''}
                      </button>
                    </div>
                  </div>

                  {/* Listado de variaciones de precio en estadísticas */}
                  <div className="space-y-4">
                    {sortedVariations.length === 0 ? (
                      <p className="text-slate-400 text-xs font-bold text-center py-8 uppercase tracking-widest italic">Aún no se registran variaciones de precio en esta zona</p>
                    ) : (
                      sortedVariations.map((piso) => {
                        const isExpanded = expandedStatsPrices.includes(piso.id)
                        return (
                          <div 
                            key={piso.id} 
                            className="bg-slate-50 border border-slate-200/70 rounded-3xl p-5 hover:border-slate-350 transition-all space-y-4 shadow-sm"
                          >
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                              <div className="space-y-1.5 flex-grow w-full lg:w-auto">
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md uppercase">{piso.neighborhood || 'Burgos'}</span>
                                  {piso.totalPriceDiff !== 0 && (
                                    <span className={`text-[10px] sm:text-[11px] font-extrabold px-3 py-1 rounded-md uppercase tracking-wider ${piso.totalPriceDiff < 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                      Rebaja Total: {piso.totalPriceDiff < 0 ? '📉' : '📈'} {Math.abs(piso.totalPriceDiff).toLocaleString('es-ES')}€ ({Math.round((piso.totalPriceDiff / piso.initialPrice) * 100)}%)
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs sm:text-sm font-black text-slate-850 leading-snug hover:text-blue-700 transition-colors">
                                  <a href={piso.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{piso.title}</a>
                                </h4>
                              </div>

                              <div className="flex flex-wrap items-center gap-4 sm:gap-6 w-full lg:w-auto justify-between lg:justify-end border-t border-slate-200/40 pt-3 lg:border-t-0 lg:pt-0">
                                <div className="flex flex-col text-right">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Precio Inicial</span>
                                  <span className="text-xs font-black text-slate-500 leading-none mt-1">{piso.initialPrice.toLocaleString('es-ES')}€</span>
                                </div>
                                
                                {piso.priceDiff !== 0 && (
                                  <div className="flex flex-col text-right">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Último Cambio</span>
                                    <span className={`text-xs font-black leading-none mt-1 ${piso.priceDiff < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {piso.priceDiff < 0 ? '-' : '+'}{Math.abs(piso.priceDiff).toLocaleString('es-ES')}€
                                    </span>
                                  </div>
                                )}

                                <div className="flex flex-col text-right">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Precio Actual</span>
                                  <span className="text-sm font-black text-slate-800 leading-none mt-1">{piso.currentPrice.toLocaleString('es-ES')}€</span>
                                </div>

                                <div className="flex items-center gap-2 ml-auto lg:ml-0">
                                  <button 
                                    onClick={() => toggleExpandStatsPrice(piso.id)}
                                    className="px-3.5 py-2 bg-slate-200/80 hover:bg-slate-200 text-slate-700 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all flex items-center gap-1.5"
                                  >
                                    <span>Historial</span>
                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                  <a 
                                    href={piso.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl transition-all border border-blue-100/50"
                                    title="Ver en portal"
                                  >
                                    <ArrowRight className="w-4 h-4" />
                                  </a>
                                </div>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="bg-white border border-slate-200/70 rounded-2xl p-4 sm:p-5 space-y-2.5 animate-in slide-in-from-top-4 duration-300">
                                <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-widest pb-1.5 border-b border-slate-100">Desglose completo de precios</h5>
                                {piso.sortedHist.map((h: any, idx: number) => {
                                  const isOriginal = idx === 0
                                  const prevPrice = idx > 0 ? piso.sortedHist[idx-1].price : h.price
                                  const diff = h.price - prevPrice
                                  return (
                                    <div key={h.recorded_at} className="flex justify-between items-center py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-all text-xs">
                                      <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                          {format(new Date(h.recorded_at), "dd MMMM yyyy", { locale: es })}
                                        </span>
                                        {isOriginal && <span className="text-[8px] font-bold text-blue-600 uppercase mt-0.5 leading-none">Precio de salida</span>}
                                        {!isOriginal && (
                                          <span className={`text-[8px] font-bold uppercase mt-0.5 leading-none ${diff < 0 ? 'text-emerald-600' : diff > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                            {diff < 0 ? 'Rebaja' : diff > 0 ? 'Subida' : 'Mantener'} {diff !== 0 && `(${diff > 0 ? '+' : ''}${diff.toLocaleString('es-ES')}€)`}
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-black text-slate-700">
                                        {h.price.toLocaleString('es-ES')}€
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-48 bg-white border border-slate-150 rounded-[48px] shadow-inner">
                <BarChart2 className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                <p className="text-slate-400 font-bold italic uppercase tracking-wider text-sm">Cargando estadísticas de mercado...</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL DE AJUSTES */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Panel de Control</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configuración del Bot Scraper</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">URL de Búsqueda (Idealista)</label>
                <textarea 
                  rows={3}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold focus:border-blue-400 outline-none transition-all text-slate-700 leading-relaxed"
                  placeholder="Pega aquí la URL de búsqueda de Idealista..."
                  value={config.scraper_url || ''}
                  onChange={(e) => setConfig({...config, scraper_url: e.target.value})}
                />
                <p className="text-[9px] text-slate-400 italic ml-1">* El bot usará esta URL cada mañana a las 08:00.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Email de Alertas</label>
                <input 
                  type="email" 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-blue-400 outline-none transition-all text-slate-700"
                  placeholder="tu@email.com"
                  value={config.alert_email || ''}
                  onChange={(e) => setConfig({...config, alert_email: e.target.value})}
                />
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuración SMTP (Envío)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Servidor</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold focus:border-blue-400 outline-none transition-all text-slate-700"
                      placeholder="smtp.gmail.com"
                      value={config.smtp_server || ''}
                      onChange={(e) => setConfig({...config, smtp_server: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Puerto</label>
                    <input 
                      type="number" 
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold focus:border-blue-400 outline-none transition-all text-slate-700"
                      placeholder="587"
                      value={config.smtp_port || ''}
                      onChange={(e) => setConfig({...config, smtp_port: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Usuario SMTP</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold focus:border-blue-400 outline-none transition-all text-slate-700"
                    placeholder="tu-email@gmail.com"
                    value={config.smtp_user || ''}
                    onChange={(e) => setConfig({...config, smtp_user: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Contraseña Aplicación</label>
                  <input 
                    type="password" 
                    className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold focus:border-blue-400 outline-none transition-all text-slate-700"
                    placeholder="xxxx xxxx xxxx xxxx"
                    value={config.smtp_pass || ''}
                    onChange={(e) => setConfig({...config, smtp_pass: e.target.value})}
                  />
                </div>
              </div>

              <button 
                onClick={saveConfig}
                disabled={isSavingConfig}
                className="w-full bg-slate-900 hover:bg-blue-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
              >
                {isSavingConfig ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
