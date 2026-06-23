import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { createClient } from '@supabase/supabase-js'

const FASES = ['todos', 'novo', 'aquecendo', 'proposta', 'negociando', 'fechado']
const FASE_LABELS = { todos: 'Todos', novo: 'Novos', aquecendo: 'Aquecendo', proposta: 'Proposta', negociando: 'Negociando', fechado: 'Fechados' }
const TEMP_ICONS = { frio: '❄️', morno: '🌤', quente: '🔥', fechado: '✅' }
const AGENT_COLORS = { aurora: '#7c5cfc', lux: '#ffb300', lumen: '#00e676', orion: '#00d4ff', denise: '#ff6b9d', emily: '#ff9a3c', cliente: '#7c5cfc' }

export async function getServerSideProps() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('ultimo_contato', { ascending: false })

  const { data: mensagens } = await supabase
    .from('mensagens')
    .select('*')
    .order('created_at', { ascending: true })

  const { data: notificacoes } = await supabase
    .from('notificacoes')
    .select('*')
    .eq('lida', false)
    .order('created_at', { ascending: false })
    .limit(50)

  return {
    props: {
      initialLeads: leads || [],
      initialMensagens: mensagens || [],
      initialNotificacoes: notificacoes || []
    }
  }
}

function tempoRelativo(data) {
  if (!data) return ''
  const diff = Date.now() - new Date(data).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

export default function Painel({ initialLeads, initialMensagens, initialNotificacoes }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [leads, setLeads] = useState(initialLeads)
  const [mensagens, setMensagens] = useState(initialMensagens)
  const [notificacoes, setNotificacoes] = useState(initialNotificacoes)
  const [faseAtiva, setFaseAtiva] = useState('todos')
  const [leadSelecionado, setLeadSelecionado] = useState(null)
  const [textoMsg, setTextoMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sageAberto, setSageAberto] = useState(false)
  const [sageData, setSageData] = useState(null)
  const [sageLoading, setSageLoading] = useState(false)
  const chatRef = useRef(null)

  useEffect(() => {
    const stored = localStorage.getItem('pixelsav_user')
    if (!stored) {
      router.push('/')
      return
    }
    setUser(JSON.parse(stored))
  }, [router])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [leadSelecionado, mensagens])

  function logout() {
    localStorage.removeItem('pixelsav_user')
    router.push('/')
  }

  const leadsFiltrados = faseAtiva === 'todos'
    ? leads
    : leads.filter(l => l.fase_kanban === faseAtiva)

  const msgsDoLead = leadSelecionado
    ? mensagens.filter(m => m.lead_id === leadSelecionado.id)
    : []

  const stats = {
    total: leads.length,
    quentes: leads.filter(l => l.temperatura === 'quente').length,
    hoje: leads.filter(l => {
      if (!l.created_at) return false
      const d = new Date(l.created_at)
      const now = new Date()
      return d.toDateString() === now.toDateString()
    }).length
  }

  async function assumirLead() {
    if (!leadSelecionado) return
    const res = await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: leadSelecionado.id,
        humano_no_controle: true,
        humano_assumiu_em: new Date().toISOString()
      })
    })
    const updated = await res.json()
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
    setLeadSelecionado(updated)
  }

  async function devolverLead() {
    if (!leadSelecionado) return
    const res = await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: leadSelecionado.id,
        humano_no_controle: false,
        humano_devolveu_em: new Date().toISOString(),
        agente_atual: 'orion'
      })
    })
    const updated = await res.json()
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
    setLeadSelecionado(updated)
  }

  async function enviarMensagem() {
    if (!textoMsg.trim() || !leadSelecionado || enviando) return
    setEnviando(true)

    const autor = user?.nome?.toLowerCase() || 'denise'

    try {
      const msgRes = await fetch('/api/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadSelecionado.id,
          autor,
          conteudo: textoMsg
        })
      })
      const novaMsg = await msgRes.json()
      setMensagens(prev => [...prev, novaMsg])

      await fetch('/api/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp: leadSelecionado.whatsapp,
          texto: textoMsg
        })
      })

      setTextoMsg('')
    } catch (err) {
      console.error('Erro ao enviar:', err)
    } finally {
      setEnviando(false)
    }
  }

  async function abrirSage() {
    if (!leadSelecionado) return
    setSageAberto(true)
    setSageLoading(true)
    try {
      const res = await fetch(`/api/sage?lead_id=${leadSelecionado.id}`)
      const data = await res.json()
      setSageData(data)
    } catch {
      setSageData(null)
    } finally {
      setSageLoading(false)
    }
  }

  async function marcarNotificacaoLida(notif) {
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'notif' })
    }).catch(() => {})

    const leadNotif = leads.find(l => l.id === notif.lead_id)
    if (leadNotif) setLeadSelecionado(leadNotif)

    setNotificacoes(prev => prev.filter(n => n.id !== notif.id))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensagem()
    }
  }

  if (!user) return null

  const notifsNaoLidas = notificacoes.length

  return (
    <>
      <Head>
        <title>PixelSAV Comercial - Painel</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0a0a0f; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        textarea { font-family: inherit; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* HEADER */}
        <header style={{
          background: '#12121a',
          borderBottom: '1px solid #1e1e2e',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#7c5cfc' }}>⚡ PixelSAV Comercial</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Stat label="Total" value={stats.total} />
            <Stat label="Quentes" value={stats.quentes} color="#ff6b35" />
            <Stat label="Hoje" value={stats.hoje} color="#00e676" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#7c5cfc', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff'
            }}>
              {user.nome?.[0] || '?'}
            </div>
            <span style={{ fontSize: 14, color: '#aaa' }}>{user.nome}</span>
            <button onClick={logout} style={{
              background: 'transparent', border: '1px solid #333',
              color: '#888', padding: '6px 14px', borderRadius: 6,
              cursor: 'pointer', fontSize: 13
            }}>Sair</button>
          </div>
        </header>

        {/* MAIN */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* SIDEBAR */}
          <aside style={{
            width: 320, background: '#0e0e16', borderRight: '1px solid #1e1e2e',
            display: 'flex', flexDirection: 'column', flexShrink: 0
          }}>
            <div style={{ padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Pipeline</span>
              <span style={{
                background: '#1a1a2e', padding: '2px 10px', borderRadius: 12,
                fontSize: 12, color: '#7c5cfc'
              }}>{leadsFiltrados.length}</span>
            </div>

            {/* TABS */}
            <div style={{
              display: 'flex', gap: 4, padding: '0 16px 12px',
              overflowX: 'auto', flexShrink: 0
            }}>
              {FASES.map(f => (
                <button key={f} onClick={() => setFaseAtiva(f)} style={{
                  background: faseAtiva === f ? '#7c5cfc' : '#1a1a2e',
                  color: faseAtiva === f ? '#fff' : '#888',
                  border: 'none', padding: '6px 12px', borderRadius: 6,
                  fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                  fontWeight: faseAtiva === f ? 600 : 400
                }}>{FASE_LABELS[f]}</button>
              ))}
            </div>

            {/* LEAD CARDS */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
              {leadsFiltrados.map(lead => (
                <div
                  key={lead.id}
                  onClick={() => { setLeadSelecionado(lead); setSageAberto(false); setSageData(null) }}
                  style={{
                    background: leadSelecionado?.id === lead.id ? '#1a1a2e' : '#12121a',
                    border: leadSelecionado?.id === lead.id ? '1px solid #7c5cfc' : '1px solid #1a1a2e',
                    borderRadius: 10, padding: '12px 14px', marginBottom: 6, cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>
                      {lead.nome || lead.whatsapp}
                    </span>
                    <span style={{ fontSize: 16 }}>{TEMP_ICONS[lead.temperatura] || '❄️'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                    {[lead.empresa, lead.cidade].filter(Boolean).join(' • ') || 'Não qualificado'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 4,
                      background: AGENT_COLORS[lead.agente_atual] || '#333',
                      color: '#fff', fontWeight: 600, textTransform: 'uppercase'
                    }}>
                      {lead.agente_atual || 'aurora'}
                    </span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{
                        fontSize: 10, color: '#555', padding: '2px 6px',
                        background: '#1a1a2e', borderRadius: 4
                      }}>
                        {lead.fase_kanban || 'novo'}
                      </span>
                      <span style={{ fontSize: 11, color: '#444' }}>
                        {tempoRelativo(lead.ultimo_contato)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {leadsFiltrados.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#444', fontSize: 13 }}>
                  Nenhum lead nesta fase
                </div>
              )}
            </div>
          </aside>

          {/* CHAT AREA */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0a0f' }}>
            {!leadSelecionado ? (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 8, color: '#333'
              }}>
                <span style={{ fontSize: 48 }}>💬</span>
                <span style={{ fontSize: 16 }}>Selecione um lead</span>
              </div>
            ) : (
              <>
                {/* CHAT HEADER */}
                <div style={{
                  padding: '12px 20px', borderBottom: '1px solid #1e1e2e',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#12121a', flexShrink: 0
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {leadSelecionado.nome || leadSelecionado.whatsapp}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {[leadSelecionado.empresa, leadSelecionado.cidade, leadSelecionado.whatsapp].filter(Boolean).join(' • ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!leadSelecionado.humano_no_controle ? (
                      <button onClick={assumirLead} style={{
                        background: '#ff6b9d', color: '#fff', border: 'none',
                        padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
                        fontSize: 13, fontWeight: 600
                      }}>🎯 Assumir</button>
                    ) : (
                      <button onClick={devolverLead} style={{
                        background: '#00d4ff', color: '#000', border: 'none',
                        padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
                        fontSize: 13, fontWeight: 600
                      }}>🤖 Devolver à IA</button>
                    )}
                    <button onClick={abrirSage} style={{
                      background: sageAberto ? '#7c5cfc' : '#1a1a2e',
                      color: '#fff', border: '1px solid #2a2a3e',
                      padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
                      fontSize: 13, fontWeight: 600
                    }}>🔮 Sage</button>
                  </div>
                </div>

                {/* HUMANO BANNER */}
                {leadSelecionado.humano_no_controle && (
                  <div style={{
                    background: 'linear-gradient(90deg, #ff6b9d22, #ff6b9d11)',
                    borderBottom: '1px solid #ff6b9d33',
                    padding: '8px 20px', fontSize: 13, color: '#ff6b9d',
                    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0
                  }}>
                    🎯 Você está no controle deste lead. A IA não responderá automaticamente.
                  </div>
                )}

                {/* MESSAGES */}
                <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  {msgsDoLead.map(msg => {
                    const isCliente = msg.autor === 'cliente'
                    const agentColor = AGENT_COLORS[msg.autor] || '#555'
                    return (
                      <div key={msg.id} style={{
                        display: 'flex',
                        justifyContent: isCliente ? 'flex-end' : 'flex-start',
                        marginBottom: 10
                      }}>
                        <div style={{
                          maxWidth: '65%',
                          background: isCliente ? '#7c5cfc' : '#1a1a2e',
                          borderRadius: isCliente ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          padding: '10px 14px',
                          borderLeft: isCliente ? 'none' : `3px solid ${agentColor}`
                        }}>
                          {!isCliente && (
                            <div style={{
                              fontSize: 11, fontWeight: 700, marginBottom: 4,
                              color: agentColor, textTransform: 'uppercase'
                            }}>{msg.autor}</div>
                          )}
                          <div style={{
                            fontSize: 14, lineHeight: 1.5, color: '#e0e0e0',
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                          }}>{msg.conteudo}</div>
                          <div style={{
                            fontSize: 10, color: isCliente ? '#ffffff88' : '#555',
                            marginTop: 4, textAlign: 'right'
                          }}>
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {msgsDoLead.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40, color: '#333', fontSize: 13 }}>
                      Nenhuma mensagem ainda
                    </div>
                  )}
                </div>

                {/* INPUT */}
                <div style={{
                  padding: '12px 20px', borderTop: '1px solid #1e1e2e',
                  display: 'flex', gap: 10, background: '#12121a', flexShrink: 0
                }}>
                  <textarea
                    value={textoMsg}
                    onChange={e => setTextoMsg(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua mensagem..."
                    rows={1}
                    style={{
                      flex: 1, background: '#1a1a2e', border: '1px solid #2a2a3e',
                      borderRadius: 8, padding: '10px 14px', color: '#fff',
                      fontSize: 14, resize: 'none', outline: 'none'
                    }}
                  />
                  <button
                    onClick={enviarMensagem}
                    disabled={enviando || !textoMsg.trim()}
                    style={{
                      background: '#7c5cfc', color: '#fff', border: 'none',
                      borderRadius: 8, padding: '10px 20px', cursor: 'pointer',
                      fontSize: 14, fontWeight: 600, opacity: enviando ? 0.5 : 1
                    }}
                  >
                    {enviando ? '...' : 'Enviar'}
                  </button>
                </div>
              </>
            )}
          </main>

          {/* SAGE PANEL */}
          {sageAberto && leadSelecionado && (
            <aside style={{
              width: 280, background: '#0e0e16', borderLeft: '1px solid #1e1e2e',
              padding: 16, overflowY: 'auto', flexShrink: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>🔮 Sage</span>
                <button onClick={() => setSageAberto(false)} style={{
                  background: 'transparent', border: 'none', color: '#666',
                  cursor: 'pointer', fontSize: 18
                }}>✕</button>
              </div>

              {sageLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>Analisando...</div>
              ) : sageData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Temperatura */}
                  <SageSection title="Temperatura">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{TEMP_ICONS[sageData.temperatura] || '❄️'}</span>
                      <span style={{
                        textTransform: 'capitalize', fontWeight: 600,
                        color: sageData.temperatura === 'quente' ? '#ff6b35' :
                               sageData.temperatura === 'morno' ? '#ffb300' :
                               sageData.temperatura === 'fechado' ? '#00e676' : '#6ac4f7'
                      }}>{sageData.temperatura}</span>
                    </div>
                    <div style={{
                      height: 4, borderRadius: 2, background: '#1a1a2e', marginTop: 8
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: sageData.temperatura === 'frio' ? '25%' :
                               sageData.temperatura === 'morno' ? '50%' :
                               sageData.temperatura === 'quente' ? '75%' : '100%',
                        background: sageData.temperatura === 'quente' ? '#ff6b35' :
                                    sageData.temperatura === 'morno' ? '#ffb300' :
                                    sageData.temperatura === 'fechado' ? '#00e676' : '#6ac4f7'
                      }} />
                    </div>
                  </SageSection>

                  {/* O que acontece */}
                  <SageSection title="O que está acontecendo">
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: '#bbb' }}>
                      {sageData.o_que_acontece}
                    </p>
                  </SageSection>

                  {/* Alerta */}
                  {sageData.atencao && (
                    <SageSection title="⚠️ Atenção">
                      <div style={{
                        background: '#ffb30015', border: '1px solid #ffb30033',
                        borderRadius: 8, padding: '10px 12px', fontSize: 13,
                        color: '#ffb300', lineHeight: 1.5
                      }}>{sageData.atencao}</div>
                    </SageSection>
                  )}

                  {/* Sugestão */}
                  <SageSection title="Sugestão de resposta">
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: '#bbb', marginBottom: 8 }}>
                      {sageData.sugestao_resposta}
                    </p>
                    {sageData.sugestao_resposta && (
                      <button onClick={() => { setTextoMsg(sageData.sugestao_resposta) }} style={{
                        background: '#7c5cfc22', border: '1px solid #7c5cfc44',
                        color: '#7c5cfc', padding: '6px 12px', borderRadius: 6,
                        cursor: 'pointer', fontSize: 12, fontWeight: 600
                      }}>↩ Usar</button>
                    )}
                  </SageSection>

                  {/* Próxima ação */}
                  <SageSection title="Próxima ação">
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: '#bbb' }}>
                      {sageData.proxima_acao}
                    </p>
                  </SageSection>

                  {/* Notificações */}
                  {notifsNaoLidas > 0 && (
                    <SageSection title={`🔔 Notificações (${notifsNaoLidas})`}>
                      {notificacoes.slice(0, 5).map(n => (
                        <div key={n.id} onClick={() => marcarNotificacaoLida(n)} style={{
                          background: '#1a1a2e', borderRadius: 6, padding: '8px 10px',
                          marginBottom: 6, cursor: 'pointer', fontSize: 12,
                          borderLeft: '3px solid #ff6b9d'
                        }}>
                          <div style={{ fontWeight: 600, color: '#ddd', marginBottom: 2 }}>{n.titulo}</div>
                          <div style={{ color: '#888' }}>{n.corpo?.substring(0, 80)}</div>
                        </div>
                      ))}
                    </SageSection>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: '#555', fontSize: 13 }}>
                  Erro ao carregar análise
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || '#fff' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

function SageSection({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase',
        marginBottom: 8, letterSpacing: 1
      }}>{title}</div>
      {children}
    </div>
  )
}
