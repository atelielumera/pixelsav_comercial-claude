import { supabaseAdmin } from './supabaseAdmin'

const DIA_MAP = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
const DEFAULTS = { horario_inicio: '09:00', horario_fim: '18:00', dias_uteis: 'seg,ter,qua,qui,sex' }

export async function dentroDoHorarioComercial() {
  const agora = new Date()
  const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const dataStr = brasilia.toISOString().slice(0, 10)

  const { data: feriado } = await supabaseAdmin
    .from('feriados')
    .select('data')
    .eq('data', dataStr)
    .maybeSingle()

  if (feriado) return false

  const { data: configRows } = await supabaseAdmin
    .from('configuracoes')
    .select('chave, valor')
    .in('chave', ['horario_inicio', 'horario_fim', 'dias_uteis'])

  const cfg = { ...DEFAULTS, ...Object.fromEntries((configRows || []).map(c => [c.chave, c.valor])) }
  const diasUteis = cfg.dias_uteis.split(',').map(d => d.trim())

  const diaAtual = DIA_MAP[brasilia.getDay()]
  if (!diasUteis.includes(diaAtual)) return false

  const [hi, mi] = cfg.horario_inicio.split(':').map(Number)
  const [hf, mf] = cfg.horario_fim.split(':').map(Number)
  const minutosAgora = brasilia.getHours() * 60 + brasilia.getMinutes()

  return minutosAgora >= hi * 60 + mi && minutosAgora < hf * 60 + mf
}
