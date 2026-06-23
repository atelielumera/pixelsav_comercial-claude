import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      })
      const data = await res.json()
      if (data.ok) {
        localStorage.setItem('pixelsav_user', JSON.stringify({ email: data.email, nome: data.nome }))
        router.push('/painel')
      } else {
        setErro(data.erro || 'Credenciais inválidas')
      }
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>PixelSAV Comercial</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={styles.container}>
        <form onSubmit={handleLogin} style={styles.card}>
          <div style={styles.logo}>⚡ PixelSAV</div>
          <div style={styles.subtitle}>Comercial</div>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            required
            style={styles.input}
          />

          {erro && <div style={styles.erro}>{erro}</div>}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  card: {
    background: '#12121a',
    borderRadius: 16,
    padding: '48px 40px',
    width: 380,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    border: '1px solid #1e1e2e'
  },
  logo: {
    fontSize: 32,
    fontWeight: 800,
    color: '#7c5cfc',
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 4
  },
  input: {
    background: '#1a1a2e',
    border: '1px solid #2a2a3e',
    borderRadius: 8,
    padding: '14px 16px',
    color: '#fff',
    fontSize: 15,
    outline: 'none'
  },
  btn: {
    background: '#7c5cfc',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '14px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8
  },
  erro: {
    color: '#ff4757',
    fontSize: 13,
    textAlign: 'center'
  }
}
