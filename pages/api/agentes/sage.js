import { gerarJSON } from '../../../lib/anthropic'

export const SYSTEM_PROMPT = `Você é Sage, copiloto estratégico da equipe comercial da PixelSAV.
Você NÃO fala com clientes. Você orienta Denise e Emily pelo painel interno.

SEU PAPEL:
- Resumir conversas longas
- Sugerir próximos passos para a equipe
- Identificar leads quentes que merecem atenção imediata
- Alertar sobre leads parados há mais de X dias
- Extrair dados estruturados de conversas
- Gerar análise de performance do pipeline

Responda sempre de forma direta, analítica e sem rodeios. Denise e Emily são pessoas ocupadas.`

export async function gerar({ lead, historico }) {
  const conversa = (historico || [])
    .map(m => `[${m.tipo_autor}]: ${m.conteudo}`)
    .join('\n')

  const prompt = `${SYSTEM_PROMPT}

Analise esta conversa e retorne APENAS um JSON válido (sem markdown, sem backticks):

Lead: ${lead.nome || 'Desconhecido'} | Empresa: ${lead.empresa || '?'} | Cidade: ${lead.cidade || '?'} | Agente atual: ${lead.agente_atual || 'aurora'} | Fase: ${lead.fase_kanban || 'novo_lead'} | Status: ${lead.status || 'ativo'}

Histórico:
${conversa || 'Sem mensagens ainda'}

Retorne o JSON:
{
  "temperatura": "frio|morno|quente",
  "o_que_acontece": "resumo em 1-2 frases do estado atual",
  "atencao": "alerta importante ou null",
  "sugestao_resposta": "sugestão de próxima mensagem",
  "proxima_acao": "próximo passo recomendado"
}`

  return gerarJSON({ prompt })
}

export default function handler(req, res) {
  res.status(405).json({ erro: 'Endpoint de uso interno — importe gerar() diretamente' })
}
