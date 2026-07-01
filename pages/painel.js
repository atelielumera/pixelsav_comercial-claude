import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabaseAdmin } from '../lib/supabaseAdmin'

const FASES = ['todos', 'novo_lead', 'aquecimento', 'proposta', 'negociando', 'fechado']
const FASE_LABELS = {
  todos: 'Todos',
  novo_lead: 'Novos',
  aquecimento: 'Aquecendo',
  proposta: 'Proposta',
  negociando: 'Negociando',
  fechado: 'Fechados'
}
const AGENTES_FILTRO = ['todos', 'aurora', 'lux', 'lumen', 'orion']
const TEMP_ICONS = { frio: '❄️', morno: '🌤', quente: '🔥' }
const AGENT_COLORS = {
  aurora: '#7c5cfc',
  lux: '#ffb300',
  lumen: '#00e676',
  orion: '#00d4ff',
  sage: '#a78bfa',
  denise: '#ff6b9d',
  emily: '#ff9a3c',
  cliente: '#555'
}
const STATUS_LABELS = { ativo: 'Ativo', won: 'Cliente (Won)', perdido: 'Perdido', bloqueado: 'Bloqueado' }

export async function getServerSideProps() {
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('*')
    .order('updated_at', { ascending: false })

  return { props: { initialLeads: leads || [] } }
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

export default function Painel({ initialLeads }) {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [leads, setLeads] = useState(initialLeads)
  const [mensagens, setMensagens] = useState([])
  const [carregandoMsgs, setCarregandoMsgs] = useState(false)
  const [faseAtiva, setFaseAtiva] = useState('todos')
  const [agenteAtivo, setAgenteAtivo] = useState('todos')
  const [leadSelecionado, setLeadSelecionado] = useState(null)
  const [textoMsg, setTextoMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
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
  }, [mensagens])

  useEffect(() => {
    if (!leadSelecionado) return
    setCarregandoMsgs(true)
    setSageData(null)
    fetch(`/api/mensagens?lead_id=${leadSelecionado.id}`)
      .then(r => r.json())
      .then(data => setMensagens(Array.isArray(data) ? data : []))
      .catch(() => setMensagens([]))
      .finally(() => setCarregandoMsgs(false))
  }, [leadSelecionado?.id])

  function logout() {
    localStorage.removeItem('pixelsav_user')
    router.push('/')
  }

  const leadsFiltrados = leads.filter(l => {
    if (faseAtiva !== 'todos' && l.fase_kanban !== faseAtiva) return false
    if (agenteAtivo !== 'todos' && l.agente_atual !== agenteAtivo) return false
    return true
  })

  async function atualizarLead(updates) {
    if (!leadSelecionado) return
    const res = await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadSelecionado.id, ...updates })
    })
    const updated = await res.json()
    setLeads(prev => prev.map(l => (l.id === updated.id ? updated : l)))
    setLeadSelecionado(updated)
  }

  const assumirLead = () =>
    atualizarLead({ humano_no_controle: true, humano_responsavel: user?.nome?.toLowerCase() })

  const devolverLead = () => atualizarLead({ humano_no_controle: false })

  async function enviarMensagem() {
    if (!textoMsg.trim() || !leadSelecionado || enviando) return
    setEnviando(true)

    const tipoAutor = user?.nome?.toLowerCase() || 'denise'

    try {
      const msgRes = await fetch('/api/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadSelecionado.id,
          autor: user?.nome || 'Denise',
          tipo_autor: tipoAutor,
          conteudo: textoMsg
        })
      })
      const novaMsg = await msgRes.json()
      setMensagens(prev => [...prev, novaMsg])

      await fetch('/api/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: leadSelecionado.whatsapp, texto: textoMsg })
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

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensagem()
    }
  }

  if (!user) return null

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
        select { font-family: inherit; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <header style={{
          background: '#12121a', borderBottom: '1px solid #1e1e2e', padding: '12px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#7c5cfc' }}>⚡ PixelSAV Comercial</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: '#7c5cfc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff'
            }}>{user.nome?.[0] || '?'}</div>
            <span style={{ fontSize: 14, color: '#aaa' }}>{user.nome}</span>
            <button onClick={logout} style={{
              background: 'transparent', border: '1px solid #333', color: '#888',
              padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13
            }}>Sair</button>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* SIDEBAR — lista de leads com filtros por fase/agente */}
          <aside style={{
            width: 320, background: '#0e0e16', borderRight: '1px solid #1e1e2e',
            display: 'flex', flexDirection: 'column', flexShrink: 0
          }}>
            <div style={{ padding: '16px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Pipeline</span>
              <span style={{ background: '#1a1a2e', padding: '2px 10px', borderRadius: 12, fontSize: 12, color: '#7c5cfc' }}>
                {leadsFiltrados.length}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 4, padding: '0 16px 8px', overflowX: 'auto', flexShrink: 0 }}>
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

            <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
              <select value={agenteAtivo} onChange={e => setAgenteAtivo(e.target.value)} style={{
                width: '100%', background: '#1a1a2e', border: '1px solid #2a2a3e',
                color: '#ccc', padding: '6px 10px', borderRadius: 6, fontSize: 12
              }}>
                {AGENTES_FILTRO.map(a => (
                  <option key={a} value={a}>{a === 'todos' ? 'Todos os agentes' : a.charAt(0).toUpperCase() + a.slice(1)}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
              {leadsFiltrados.map(lead => (
                <div
                  key={lead.id}
                  onClick={() => setLeadSelecionado(lead)}
                  style={{
                    background: leadSelecionado?.id === lead.id ? '#1a1a2e' : '#12121a',
                    border: leadSelecionado?.id === lead.id ? '1px solid #7c5cfc' : '1px solid #1a1a2e',
                    borderRadius: 10, padding: '12px 14px', marginBottom: 6, cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>{lead.nome || lead.whatsapp}</span>
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
                    }}>{lead.agente_atual || 'aurora'}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#555', padding: '2px 6px', background: '#1a1a2e', borderRadius: 4 }}>
                        {FASE_LABELS[lead.fase_kanban] || lead.fase_kanban}
                      </span>
                      <span style={{ fontSize: 11, color: '#444' }}>{tempoRelativo(lead.updated_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {leadsFiltrados.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#444', fontSize: 13 }}>Nenhum lead nesta fase</div>
              )}
            </div>
          </aside>

          {/* CENTRO — histórico de mensagens */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0a0f' }}>
            {!leadSelecionado ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#333' }}>
                <span style={{ fontSize: 48 }}>💬</span>
                <span style={{ fontSize: 16 }}>Selecione um lead</span>
              </div>
            ) : (
              <>
                <div style={{
                  padding: '12px 20px', borderBottom: '1px solid #1e1e2e', background: '#12121a', flexShrink: 0
                }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{leadSelecionado.nome || leadSelecionado.whatsapp}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{leadSelecionado.whatsapp}</div>
                </div>

                {leadSelecionado.humano_no_controle && (
                  <div style={{
                    background: 'linear-gradient(90deg, #ff6b9d22, #ff6b9d11)', borderBottom: '1px solid #ff6b9d33',
                    padding: '8px 20px', fontSize: 13, color: '#ff6b9d', flexShrink: 0
                  }}>
                    🎯 {leadSelecionado.humano_responsavel || 'Um humano'} está no controle. A IA não responderá automaticamente.
                  </div>
                )}

                <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  {carregandoMsgs ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#444', fontSize: 13 }}>Carregando...</div>
                  ) : (
                    <>
                      {mensagens.map(msg => {
                        const isCliente = msg.tipo_autor === 'cliente'
                        const agentColor = AGENT_COLORS[msg.tipo_autor] || '#555'
                        return (
                          <div key={msg.id} style={{ display: 'flex', justifyContent: isCliente ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                            <div style={{
                              maxWidth: '65%', background: isCliente ? '#7c5cfc' : '#1a1a2e',
                              borderRadius: isCliente ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              padding: '10px 14px', borderLeft: isCliente ? 'none' : `3px solid ${agentColor}`
                            }}>
                              {!isCliente && (
                                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: agentColor, textTransform: 'uppercase' }}>
                                  {msg.autor}
                                </div>
                              )}
                              <div style={{ fontSize: 14, lineHeight: 1.5, color: '#e0e0e0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {msg.conteudo}
                              </div>
                              <div style={{ fontSize: 10, color: isCliente ? '#ffffff88' : '#555', marginTop: 4, textAlign: 'right' }}>
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {mensagens.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 40, color: '#333', fontSize: 13 }}>Nenhuma mensagem ainda</div>
                      )}
                    </>
                  )}
                </div>

                <div style={{ padding: '12px 20px', borderTop: '1px solid #1e1e2e', display: 'flex', gap: 10, background: '#12121a', flexShrink: 0 }}>
                  <textarea
                    value={textoMsg}
                    onChange={e => setTextoMsg(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua mensagem..."
                    rows={1}
                    style={{
                      flex: 1, background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8,
                      padding: '10px 14px', color: '#fff', fontSize: 14, resize: 'none', outline: 'none'
                    }}
                  />
                  <button onClick={enviarMensagem} disabled={enviando || !textoMsg.trim()} style={{
                    background: '#7c5cfc', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px',
                    cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: enviando ? 0.5 : 1
                  }}>{enviando ? '...' : 'Enviar'}</button>
                </div>
              </>
            )}
          </main>

          {/* DIREITA — dados do lead + ações */}
          {leadSelecionado && (
            <aside style={{ width: 300, background: '#0e0e16', borderLeft: '1px solid #1e1e2e', padding: 16, overflowY: 'auto', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Dados do lead</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, fontSize: 13 }}>
                <Campo label="Empresa" valor={leadSelecionado.empresa} />
                <Campo label="Cidade" valor={leadSelecionado.cidade} />
                <Campo label="Segmento" valor={leadSelecionado.segmento} />
                <Campo label="Solução de interesse" valor={leadSelecionado.solucao_interesse} />
                <Campo label="Valor estimado" valor={leadSelecionado.valor_estimado} />
                <Campo label="Status" valor={STATUS_LABELS[leadSelecionado.status] || leadSelecionado.status} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {!leadSelecionado.humano_no_controle ? (
                  <button onClick={assumirLead} style={{
                    background: '#ff6b9d', color: '#fff', border: 'none', padding: '10px 16px',
                    borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600
                  }}>🎯 Assumir conversa</button>
                ) : (
                  <button onClick={devolverLead} style={{
                    background: '#00d4ff', color: '#000', border: 'none', padding: '10px 16px',
                    borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600
                  }}>🤖 Devolver para IA</button>
                )}
                <button onClick={abrirSage} style={{
                  background: '#1a1a2e', color: '#fff', border: '1px solid #2a2a3e', padding: '10px 16px',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600
                }}>🔮 Consultar Sage</button>
              </div>

              {sageLoading && <div style={{ textAlign: 'center', padding: 20, color: '#555', fontSize: 13 }}>Analisando...</div>}

              {sageData && !sageLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SageSection title="O que está acontecendo">
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: '#bbb' }}>{sageData.o_que_acontece}</p>
                  </SageSection>
                  {sageData.atencao && (
                    <SageSection title="⚠️ Atenção">
                      <div style={{
                        background: '#ffb30015', border: '1px solid #ffb30033', borderRadius: 8,
                        padding: '10px 12px', fontSize: 13, color: '#ffb300', lineHeight: 1.5
                      }}>{sageData.atencao}</div>
                    </SageSection>
                  )}
                  <SageSection title="Sugestão de resposta">
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: '#bbb', marginBottom: 8 }}>{sageData.sugestao_resposta}</p>
                    {sageData.sugestao_resposta && (
                      <button onClick={() => setTextoMsg(sageData.sugestao_resposta)} style={{
                        background: '#7c5cfc22', border: '1px solid #7c5cfc44', color: '#7c5cfc',
                        padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600
                      }}>↩ Usar</button>
                    )}
                  </SageSection>
                  <SageSection title="Próxima ação">
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: '#bbb' }}>{sageData.proxima_acao}</p>
                  </SageSection>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </>
  )
}

function Campo({ label, valor }) {
  return (
    <div>
      <div style={{ color: '#666', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#ddd' }}>{valor || '—'}</div>
    </div>
  )
}

function SageSection({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>{title}</div>
      {children}
    </div>
  )
}
