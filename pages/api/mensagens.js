import { supabaseAdmin } from '../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { lead_id } = req.query
    if (!lead_id) return res.status(400).json({ erro: 'lead_id obrigatório' })

    const { data, error } = await supabaseAdmin
      .from('mensagens')
      .select('*')
      .eq('lead_id', lead_id)
      .order('timestamp', { ascending: true })

    if (error) return res.status(500).json({ erro: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { lead_id, autor, tipo_autor, conteudo } = req.body || {}
    if (!lead_id || !autor || !tipo_autor || !conteudo) {
      return res.status(400).json({ erro: 'lead_id, autor, tipo_autor e conteudo obrigatórios' })
    }

    const { data, error } = await supabaseAdmin
      .from('mensagens')
      .insert({ lead_id, autor, tipo_autor, conteudo })
      .select()
      .single()

    if (error) return res.status(500).json({ erro: error.message })

    await supabaseAdmin
      .from('leads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', lead_id)

    return res.status(201).json(data)
  }

  return res.status(405).json({ erro: 'Método não permitido' })
}
