export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' })
  }

  const { whatsapp, texto } = req.body || {}
  if (!whatsapp || !texto) {
    return res.status(400).json({ erro: 'whatsapp e texto obrigatórios' })
  }

  const number = whatsapp.replace(/\D/g, '')

  try {
    const response = await fetch(
      `${process.env.EVOLUTION_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.EVOLUTION_API_KEY
        },
        body: JSON.stringify({
          number,
          text: texto
        })
      }
    )

    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({ erro: 'Erro ao enviar', details: data })
    }

    return res.status(200).json({ ok: true, data })
  } catch (err) {
    return res.status(500).json({ erro: 'Falha ao conectar com Evolution API', details: err.message })
  }
}
