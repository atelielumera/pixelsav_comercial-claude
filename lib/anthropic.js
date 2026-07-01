import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function gerarResposta({ systemPrompt, historico, mensagemAtual, maxTokens = 400 }) {
  const messages = (historico || []).map(m => ({
    role: m.tipo_autor === 'cliente' ? 'user' : 'assistant',
    content: m.conteudo
  }))

  const ultima = messages[messages.length - 1]
  if (!ultima || ultima.role !== 'user') {
    messages.push({ role: 'user', content: mensagemAtual })
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages
  })

  return response.content[0].text.trim()
}

export async function gerarJSON({ prompt, maxTokens = 1024 }) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = response.content[0].text.trim()
  return JSON.parse(text)
}
