import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { gerar as gerarSage } from './agentes/sage'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' })
  }

  const { lead_id } = req.query
  if (!lead_id) return res.status(400).json({ erro: 'lead_id obrigatório' })

  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', lead_id)
    .single()

  if (!lead) return res.status(404).json({ erro: 'Lead não encontrado' })

  const { data: historico } = await supabaseAdmin
    .from('mensagens')
    .select('tipo_autor, conteudo')
    .eq('lead_id', lead_id)
    .order('timestamp', { ascending: true })
    .limit(30)

  try {
    const analise = await gerarSage({ lead, historico })
    return res.status(200).json(analise)
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao analisar', details: err.message })
  }
}
