import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('ultimo_contato', { ascending: false })

    if (error) return res.status(500).json({ erro: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body || {}
    if (!id) return res.status(400).json({ erro: 'ID obrigatório' })

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ erro: error.message })
    return res.status(200).json(data)
  }

  return res.status(405).json({ erro: 'Método não permitido' })
}
