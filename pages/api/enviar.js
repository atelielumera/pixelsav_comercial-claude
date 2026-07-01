import { enviarMensagem } from '../../lib/evolution'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' })
  }

  const { whatsapp, texto } = req.body || {}
  if (!whatsapp || !texto) {
    return res.status(400).json({ erro: 'whatsapp e texto obrigatórios' })
  }

  try {
    const data = await enviarMensagem(whatsapp, texto)
    return res.status(200).json({ ok: true, data })
  } catch (err) {
    return res.status(500).json({ erro: 'Falha ao conectar com Evolution API', details: err.message })
  }
}
