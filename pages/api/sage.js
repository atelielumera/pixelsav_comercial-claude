import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' })
  }

  const { lead_id } = req.query
  if (!lead_id) return res.status(400).json({ erro: 'lead_id obrigatório' })

  const { data: cached } = await supabase
    .from('sage_analises')
    .select('*')
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (cached && new Date() - new Date(cached.created_at) < 5 * 60 * 1000) {
    return res.status(200).json(cached)
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', lead_id)
    .single()

  if (!lead) return res.status(404).json({ erro: 'Lead não encontrado' })

  const { data: mensagens } = await supabase
    .from('mensagens')
    .select('*')
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: true })
    .limit(30)

  const historico = (mensagens || [])
    .map(m => `[${m.autor}]: ${m.conteudo}`)
    .join('\n')

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Você é o Sage, analista de inteligência comercial da PixelSAV.

Analise esta conversa e retorne APENAS um JSON válido (sem markdown, sem backticks):

Lead: ${lead.nome || 'Desconhecido'} | Empresa: ${lead.empresa || '?'} | Cidade: ${lead.cidade || '?'} | Agente: ${lead.agente_atual || 'aurora'} | Fase: ${lead.fase_kanban || 'novo'}

Histórico:
${historico || 'Sem mensagens ainda'}

Retorne o JSON:
{
  "temperatura": "frio|morno|quente|fechado",
  "o_que_acontece": "resumo em 1-2 frases do estado atual",
  "atencao": "alerta importante ou null",
  "sugestao_resposta": "sugestão de próxima mensagem",
  "proxima_acao": "próximo passo recomendado"
}`
      }]
    })

    const text = response.content[0].text.trim()
    let analise
    try {
      analise = JSON.parse(text)
    } catch {
      analise = {
        temperatura: lead.temperatura || 'frio',
        o_que_acontece: 'Não foi possível analisar',
        atencao: null,
        sugestao_resposta: '',
        proxima_acao: 'Revisar manualmente'
      }
    }

    const { data: saved } = await supabase
      .from('sage_analises')
      .insert({
        lead_id,
        temperatura: analise.temperatura,
        o_que_acontece: analise.o_que_acontece,
        atencao: analise.atencao,
        sugestao_resposta: analise.sugestao_resposta,
        proxima_acao: analise.proxima_acao
      })
      .select()
      .single()

    return res.status(200).json(saved || analise)
  } catch (err) {
    if (cached) return res.status(200).json(cached)
    return res.status(500).json({ erro: 'Erro ao analisar', details: err.message })
  }
}
