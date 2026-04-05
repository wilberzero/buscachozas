import { supabase } from '@/lib/supabase-db'
import ClientDashboard from '@/components/ClientDashboard'

export const revalidate = 0 

export default async function Home() {
  // Traemos todo en paralelo: pisos, tus favoritos y tu configuración
  const [propsRes, favsRes, configRes] = await Promise.all([
    supabase
      .from('properties')
      .select('*, price_history(price, recorded_at)')
      .eq('active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('favorites')
      .select('property_id'),
    supabase
      .from('config')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
  ])

  const properties = propsRes.data || []
  const favoriteIds = (favsRes.data || []).map((f: any) => f.property_id)
  const config = configRes.data || { scraper_url: '', alert_email: '' }

  if (propsRes.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-red-200">
          <h2 className="text-red-600 font-bold text-lg mb-2">Error de Conexión</h2>
          <p className="text-gray-700">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100">
      {/* Todo el contenido, incluido el header, lo gestiona el ClientDashboard para evitar solapamientos */}
      <ClientDashboard 
        properties={properties || []} 
        initialFavorites={favoriteIds}
        initialConfig={config}
      />
    </main>
  )
}
