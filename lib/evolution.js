const BASE_URL = process.env.EVOLUTION_API_URL
const INSTANCE = process.env.EVOLUTION_INSTANCE
const API_KEY = process.env.EVOLUTION_API_KEY

function headers() {
  return { 'Content-Type': 'application/json', apikey: API_KEY }
}

function limparNumero(whatsapp) {
  return whatsapp.replace(/\D/g, '')
}

export async function enviarMensagem(whatsapp, texto) {
  const number = limparNumero(whatsapp)
  const res = await fetch(`${BASE_URL}/message/sendText/${INSTANCE}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ number, text: texto })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Evolution API sendText falhou: ${res.status} ${JSON.stringify(data)}`)
  }
  return data
}

export async function enviarPresenca(whatsapp, presence, delay = 1200) {
  const number = limparNumero(whatsapp)
  try {
    await fetch(`${BASE_URL}/chat/sendPresence/${INSTANCE}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ number, presence, delay })
    })
  } catch (err) {
    console.error(`Erro ao enviar presença "${presence}":`, err.message)
  }
}

export const iniciarComposing = (whatsapp) => enviarPresenca(whatsapp, 'composing')
export const pararComposing = (whatsapp) => enviarPresenca(whatsapp, 'paused', 0)
