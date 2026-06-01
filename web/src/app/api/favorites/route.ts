import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-db'

export async function POST(request: Request) {
  try {
    const { propertyId, action } = await request.json()
    if (!propertyId || !action) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (action === 'delete') {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('property_id', propertyId)
      
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ property_id: propertyId })
      
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in favorites API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
