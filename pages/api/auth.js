const usuarios = {
  'denisedantas@pixelsav.com.br': { senha: 'PixelSAV@123', nome: 'Denise' },
  'emily@pixelsav.com.br': { senha: 'PixelSAV@123', nome: 'Emily' }
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' })
  }

  const { email, senha } = req.body || {}
  const usuario = usuarios[email]

  if (!usuario || usuario.senha !== senha) {
    return res.status(401).json({ ok: false, erro: 'Credenciais inválidas' })
  }

  return res.status(200).json({ ok: true, email, nome: usuario.nome })
}
