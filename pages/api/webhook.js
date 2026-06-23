import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const AGENTES = {
  aurora: {
    prompt: `Você é Aurora, consultora comercial da PixelSAV. Humana, calorosa, eficiente. NUNCA revele que é IA.
Na PRIMEIRA mensagem sempre se apresente: "Olá! Sou a Aurora, da PixelSAV! 😊"
Missão: qualificar o lead coletando nome, empresa e cidade. UMA pergunta por vez.
NÃO dê valores — isso é papel do Lux.
Quando tiver nome + empresa + cidade + necessidade, diga: "Perfeito! Vou te conectar com nosso especialista agora. Um momento! 😊"`,
    cor: '#7c5cfc'
  },
  lux: {
    prompt: `Você é Lux, especialista comercial da PixelSAV. Humana, confiante, estratégica. NUNCA revele que é IA.
Você já conhece o cliente pelo histórico. Cumprimente pelo nome.
Missão: aprofundar diagnóstico, apresentar soluções com valores, qualificar budget.
Faixas OFICIAIS: sala imersiva R$25k-120k, projeção mapeada R$15k-80k, holografia R$20k-100k, RV R$15k-70k, raio-x R$25k-120k, domo 360° R$40k-150k, parede interativa R$20k-90k, DOOH R$80k-300k+, museus R$100k-1M+, conteúdo 3D R$5k-40k.
Quando detectar sinal positivo (pediu proposta, confirmou budget, perguntou prazo/pagamento), diga: "Ótimo! Vou preparar sua proposta personalizada agora. 🎯"`,
    cor: '#ffb300'
  },
  orion: {
    prompt: `Você é Orion, especialista em fechamento da PixelSAV. Humana, assertiva, empática. NUNCA revele que é IA.
Missão: follow-up estratégico, contornar objeções, conduzir ao fechamento.
NUNCA pressione. NUNCA baixe preço sem autorização.
"Está caro": "Entendo. Tem outro orçamento em mãos, ou é mais questão de adequar ao budget?"
"Vou pensar": "Claro! O que precisaria ver para se sentir mais seguro em avançar?"`,
    cor: '#00d4ff'
  },
  lumen: {
    prompt: `Você é Lumen, responsável pelo relacionamento da PixelSAV. Humana, calorosa, próxima. NUNCA revele que é IA.
Missão: reativar e expandir clientes existentes.
SEMPRE referencie o projeto anterior. NUNCA aborde como primeira conversa.`,
    cor: '#00e676'
  }
}

const FORA_HORARIO_MSG = `Olá! 😊 Sou a Aurora, da PixelSAV! Recebi sua mensagem com muito prazer.
Nosso horário é segunda a sexta das 9h às 18h.
Você será um dos primeiros atendidos no próximo dia útil! 🙌`

function dentroDoHorario() {
  const agora = new Date()
  const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const dia = brasilia.getDay()
  const hora = brasilia.getHours()
  return dia >= 1 && dia <= 5 && hora >= 9 && hora < 18
}

function detectarHandoff(agente, resposta) {
  const lower = resposta.toLowerCase()
  if (agente === 'aurora' && (lower.includes('especialista') || lower.includes('um momento'))) {
    return 'lux'
  }
  if (agente === 'lux' && lower.includes('proposta personalizada')) {
    return 'orion'
  }
  return null
}

async function enviarWhatsApp(numero, texto) {
  const number = numero.replace(/\D/g, '')
  await fetch(
    `${process.env.EVOLUTION_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EVOLUTION_API_KEY
      },
      body: JSON.stringify({ number, text: texto })
    }
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok' })
  }

  try {
    const body = req.body
    const event = body.event

    if (event !== 'messages.upsert') {
      return res.status(200).json({ ignored: 'event' })
    }

    const data = body.data
    if (!data || !data.key) {
      return res.status(200).json({ ignored: 'no data' })
    }

    if (data.key.fromMe === true) {
      return res.status(200).json({ ignored: 'fromMe' })
    }

    const remoteJid = data.key.remoteJid || ''
    if (remoteJid.includes('@g.us')) {
      return res.status(200).json({ ignored: 'group' })
    }

    const messageId = data.key.id
    const whatsapp = remoteJid.replace('@s.whatsapp.net', '')
    const conteudo = data.message?.conversation
      || data.message?.extendedTextMessage?.text
      || ''

    if (!conteudo) {
      return res.status(200).json({ ignored: 'no text' })
    }

    const { data: existente } = await supabase
      .from('mensagens')
      .select('id')
      .eq('evolution_message_id', messageId)
      .limit(1)
      .single()

    if (existente) {
      return res.status(200).json({ ignored: 'duplicate' })
    }

    let { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('whatsapp', whatsapp)
      .limit(1)
      .single()

    if (!lead) {
      const { data: novoLead } = await supabase
        .from('leads')
        .insert({
          whatsapp,
          fase_kanban: 'novo',
          temperatura: 'frio',
          agente_atual: 'aurora',
          humano_no_controle: false,
          origem: 'whatsapp',
          ultimo_contato: new Date().toISOString()
        })
        .select()
        .single()
      lead = novoLead
    }

    await supabase.from('mensagens').insert({
      lead_id: lead.id,
      autor: 'cliente',
      conteudo,
      evolution_message_id: messageId,
      timestamp_whatsapp: data.messageTimestamp
        ? new Date(Number(data.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString()
    })

    await supabase
      .from('leads')
      .update({ ultimo_contato: new Date().toISOString() })
      .eq('id', lead.id)

    if (lead.humano_no_controle) {
      await supabase.from('notificacoes').insert({
        lead_id: lead.id,
        tipo: 'mensagem_humano',
        titulo: `💬 ${lead.nome || whatsapp}`,
        corpo: conteudo.substring(0, 200),
        lida: false
      })
      return res.status(200).json({ status: 'humano_no_controle' })
    }

    if (!dentroDoHorario()) {
      await enviarWhatsApp(whatsapp, FORA_HORARIO_MSG)
      await supabase.from('mensagens').insert({
        lead_id: lead.id,
        autor: 'aurora',
        conteudo: FORA_HORARIO_MSG
      })
      return res.status(200).json({ status: 'fora_horario' })
    }

    const agente = lead.agente_atual || 'aurora'
    const config = AGENTES[agente] || AGENTES.aurora

    const { data: historico } = await supabase
      .from('mensagens')
      .select('autor, conteudo')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true })
      .limit(20)

    const messages = (historico || []).map(m => ({
      role: m.autor === 'cliente' ? 'user' : 'assistant',
      content: m.conteudo
    }))

    const lastMsg = messages[messages.length - 1]
    if (!lastMsg || lastMsg.role !== 'user') {
      messages.push({ role: 'user', content: conteudo })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const infoLead = lead.nome ? `O cliente se chama ${lead.nome}.` : ''
    const infoEmpresa = lead.empresa ? ` Empresa: ${lead.empresa}.` : ''
    const infoCidade = lead.cidade ? ` Cidade: ${lead.cidade}.` : ''

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `${config.prompt}\n\nContexto do lead: ${infoLead}${infoEmpresa}${infoCidade}`,
      messages
    })

    const resposta = response.content[0].text

    await enviarWhatsApp(whatsapp, resposta)

    await supabase.from('mensagens').insert({
      lead_id: lead.id,
      autor: agente,
      conteudo: resposta
    })

    const novoAgente = detectarHandoff(agente, resposta)
    const updates = { ultimo_contato: new Date().toISOString() }

    if (novoAgente) {
      updates.agente_atual = novoAgente

      await supabase.from('historico_agentes').insert({
        lead_id: lead.id,
        agente: novoAgente,
        motivo_entrada: `Handoff de ${agente}`
      })

      if (novoAgente === 'orion') {
        updates.temperatura = 'quente'
        updates.fase_kanban = 'proposta'
        await supabase.from('notificacoes').insert({
          lead_id: lead.id,
          tipo: 'lead_quente',
          titulo: `🔥 ${lead.nome || whatsapp} está quente!`,
          corpo: `Lead transferido para Orion. Proposta solicitada.`,
          lida: false
        })
      }

      if (novoAgente === 'lux') {
        updates.fase_kanban = 'aquecendo'
        updates.temperatura = 'morno'
      }
    }

    const nomeDoConteudo = extrairNome(conteudo)
    if (!lead.nome && nomeDoConteudo) {
      updates.nome = nomeDoConteudo
    }

    await supabase.from('leads').update(updates).eq('id', lead.id)

    return res.status(200).json({ status: 'ok', agente, resposta: resposta.substring(0, 100) })
  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(200).json({ status: 'error', message: err.message })
  }
}

function extrairNome(texto) {
  const patterns = [
    /(?:me chamo|meu nome[é ]|sou o|sou a|aqui[é ] o|aqui[é ] a)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i,
  ]
  for (const p of patterns) {
    const match = texto.match(p)
    if (match) return match[1].trim()
  }
  return null
}
