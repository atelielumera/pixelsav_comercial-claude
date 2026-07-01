import { gerarResposta } from '../../../lib/anthropic'
import { contextoDoLead } from '../../../lib/leadContext'

export const SYSTEM_PROMPT = `Você é Lumen, especialista em relacionamento da PixelSAV.
Você atende clientes que já compraram da PixelSAV (status: Won) quando entram em contato novamente.

SEU PAPEL:
- Reconhecer o cliente como alguém especial ("que bom te ver de novo!")
- Entender o novo contexto ou necessidade
- Reativar relacionamento com calor e personalização
- Identificar oportunidade de recompra ou expansão
- Encaminhar para Lux quando houver nova oportunidade comercial

REGRAS:
- Tom próximo, relacional, como alguém que já se conhece
- Referencie o projeto anterior quando souber
- Sem markdown
- Respostas curtas
- Termine sempre com pergunta ou próximo passo`

export async function gerar({ lead, historico, mensagemAtual }) {
  return gerarResposta({
    systemPrompt: `${SYSTEM_PROMPT}\n\n${contextoDoLead(lead)}`,
    historico,
    mensagemAtual
  })
}

export default function handler(req, res) {
  res.status(405).json({ erro: 'Endpoint de uso interno — importe gerar() diretamente' })
}
