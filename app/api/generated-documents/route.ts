import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TablesUpdate } from '@/types/supabase'

// GET /api/generated-documents or GET /api/generated-documents?id=...
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const { data: document, error } = await supabaseAdmin
        .from('generated_documents')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (error || !document) {
        return NextResponse.json({ success: false, error: 'Documento no encontrado' }, { status: 404 })
      }

      return NextResponse.json({ success: true, document })
    }

    // List all user's generated documents
    const { data: documents, error } = await supabaseAdmin
      .from('generated_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, documents: documents || [] })
  } catch (error) {
    console.error('Error fetching generated documents:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

// PATCH /api/generated-documents (update content/title)
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { id, content, title } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID de documento requerido' }, { status: 400 })
    }

    const updatePayload: TablesUpdate<'generated_documents'> = {
      updated_at: new Date().toISOString(),
    }
    if (content !== undefined) updatePayload.content = content
    if (title !== undefined) updatePayload.title = title

    const { data: updated, error } = await supabaseAdmin
      .from('generated_documents')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, document: updated })
  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

// DELETE /api/generated-documents?id=...
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('generated_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting generated document:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
