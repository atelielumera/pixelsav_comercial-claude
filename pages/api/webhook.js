import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { enviarMensagem, iniciarComposing, pararComposing } from '../../lib/evolution'
import { dentroDoHorarioComercial } from '../../lib/horario'
import * as aurora from './agentes/aurora'
import * as lux from './agentes/lux'
import * as lumen from './agentes/lumen'
import * as orion from './agentes/orion'

const AGENTES = { aurora, lux, lumen, orion }

const FORA_HORARIO_MSG = `Olá! 😊 Sou a Aurora, da PixelSAV! Recebi sua mensagem com muito prazer.
Nosso horário é segunda a sexta das 9h às 18h.
Você será um dos primeiros atendidos no próximo dia útil! 🙌`

const LUX_LIMITE_INTERACOES = 4

function extrairNome(texto) {
  const patterns = [
    /(?:me chamo|meu nome[é ]|sou o|sou a|aqui[é ] o|aqui[é ] a)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i
  ]
  for (const p of patterns) {
    const match = texto.match(p)
    if (match) return match[1].trim()
  }
  return null
}

function escolherAgente(lead) {
  if (!lead.fase_kanban || lead.fase_kanban === 'novo_lead') return 'aurora'
  if (lead.status === 'won') return 'lumen'
  if (['negociando', 'proposta'].includes(lead.fase_kanban)) return 'orion'
  if (lead.fase_kanban === 'aquecimento') return 'lux'
  return lead.agente_atual || 'aurora'
}

async function salvarMensagem({ lead_id, autor, tipo_autor, conteudo, evolution_message_id }) {
  const payload = { lead_id, autor, tipo_autor, conteudo }
  if (evolution_message_id) payload.evolution_message_id = evolution_message_id
  const { data } = await supabaseAdmin.from('mensagens').insert(payload).select().single()
  return data
}

async function registrarBriefing({ lead_id, gerado_por, sinal_positivo }) {
  await supabaseAdmin.from('briefings').insert({
    lead_id,
    gerado_por,
    sinal_positivo,
    created_at: new Date().toISOString()
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok' })
  }

  try {
    const body = req.body
    if (body?.event !== 'messages.upsert') {
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
    const conteudo = data.message?.conversation || data.message?.extendedTextMessage?.text || ''

    if (!conteudo) {
      return res.status(200).json({ ignored: 'no text' })
    }

    // Deduplicação via banco (serverless não persiste memória entre requisições)
    const { data: existente } = await supabaseAdmin
      .from('mensagens')
      .select('id')
      .eq('evolution_message_id', messageId)
      .maybeSingle()

    if (existente) {
      return res.status(200).json({ ignored: 'duplicate' })
    }

    let { data: lead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('whatsapp', whatsapp)
      .maybeSingle()

    if (!lead) {
      const { data: novoLead } = await supabaseAdmin
        .from('leads')
        .insert({ whatsapp })
        .select()
        .single()
      lead = novoLead
    }

    await salvarMensagem({
      lead_id: lead.id,
      autor: lead.nome || whatsapp,
      tipo_autor: 'cliente',
      conteudo,
      evolution_message_id: messageId
    })

    await supabaseAdmin
      .from('leads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', lead.id)

    // 1. Blacklist — silêncio + alerta visível no painel (status do lead)
    const { data: bloqueado } = await supabaseAdmin
      .from('blacklist')
      .select('whatsapp')
      .eq('whatsapp', whatsapp)
      .maybeSingle()

    if (bloqueado) {
      await supabaseAdmin.from('leads').update({ status: 'bloqueado' }).eq('id', lead.id)
      return res.status(200).json({ status: 'blacklist' })
    }

    // 2. Humano no controle — agentes ficam em silêncio
    if (lead.humano_no_controle) {
      return res.status(200).json({ status: 'humano_no_controle' })
    }

    // 3. Horário comercial
    const dentroDoHorario = await dentroDoHorarioComercial()
    if (!dentroDoHorario) {
      await iniciarComposing(whatsapp)
      await enviarMensagem(whatsapp, FORA_HORARIO_MSG)
      await pararComposing(whatsapp)
      await salvarMensagem({
        lead_id: lead.id,
        autor: 'Aurora',
        tipo_autor: 'aurora',
        conteudo: FORA_HORARIO_MSG
      })
      return res.status(200).json({ status: 'fora_horario' })
    }

    // 4. Roteador de agentes
    const nomeAgente = escolherAgente(lead)
    const modulo = AGENTES[nomeAgente] || AGENTES.aurora

    const { data: historico } = await supabaseAdmin
      .from('mensagens')
      .select('tipo_autor, conteudo')
      .eq('lead_id', lead.id)
      .order('timestamp', { ascending: true })
      .limit(20)

    // 5. Composing → 6. Claude → 7. Enviar → 8. Salvar → 9. Atualizar lead → 10. Parar composing
    await iniciarComposing(whatsapp)

    let resposta = await modulo.gerar({ lead, historico, mensagemAtual: conteudo })

    const sinalPositivo = resposta.includes('[SINAL_POSITIVO]')
    const fechado = resposta.includes('[FECHADO]')
    resposta = resposta.replace('[SINAL_POSITIVO]', '').replace('[FECHADO]', '').trim()

    await enviarMensagem(whatsapp, resposta)
    await pararComposing(whatsapp)

    await salvarMensagem({
      lead_id: lead.id,
      autor: nomeAgente.charAt(0).toUpperCase() + nomeAgente.slice(1),
      tipo_autor: nomeAgente,
      conteudo: resposta
    })

    const updates = { updated_at: new Date().toISOString() }

    const nomeDetectado = extrairNome(conteudo)
    if (!lead.nome && nomeDetectado) updates.nome = nomeDetectado

    if (nomeAgente === 'aurora' && /especialista/i.test(resposta)) {
      updates.fase_kanban = 'aquecimento'
      updates.temperatura = 'morno'
      updates.agente_atual = 'lux'
    }

    if (nomeAgente === 'lux') {
      if (sinalPositivo) {
        updates.fase_kanban = 'proposta'
        updates.temperatura = 'quente'
        updates.agente_atual = 'orion'
        await registrarBriefing({ lead_id: lead.id, gerado_por: 'lux', sinal_positivo: true })
      } else {
        const interacoesLux = (historico || []).filter(m => m.tipo_autor === 'lux').length + 1
        if (interacoesLux >= LUX_LIMITE_INTERACOES) {
          updates.fase_kanban = 'proposta'
          updates.agente_atual = 'orion'
        }
      }
    }

    if (nomeAgente === 'orion' && fechado) {
      updates.status = 'won'
      updates.fase_kanban = 'fechado'
      updates.temperatura = 'quente'
    }

    if (nomeAgente === 'lumen' && /oportunidade|nova proposta|especialista/i.test(resposta)) {
      updates.agente_atual = 'lux'
      updates.fase_kanban = 'aquecimento'
      updates.status = 'ativo'
    }

    await supabaseAdmin.from('leads').update(updates).eq('id', lead.id)

    return res.status(200).json({ status: 'ok', agente: nomeAgente })
  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(200).json({ status: 'error', message: err.message })
  }
}
