import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { propertyId, action } = await request.json()
    if (!propertyId || !action) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (action === 'delete') {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('property_id', propertyId)
        .eq('user_id', user.id)
      
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ 
          property_id: propertyId,
          user_id: user.id
        })
      
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in favorites API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
